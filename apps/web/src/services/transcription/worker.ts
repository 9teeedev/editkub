import {
	pipeline,
	WhisperTextStreamer,
	type AutomaticSpeechRecognitionPipeline,
} from "@huggingface/transformers";
import type {
	TranscriptionSegment,
	TranscriptionChunk,
} from "@/types/transcription";
import {
	DEFAULT_CHUNK_LENGTH_SECONDS,
	DEFAULT_STRIDE_SECONDS,
} from "@/constants/transcription-constants";

export type WorkerMessage =
	| {
			type: "init";
			modelId: string;
			encoderDtype: "fp16" | "fp32";
	  }
	| {
			type: "transcribe";
			audio: Float32Array;
			language: string;
			subtask: string | null;
			/** Request per-word timestamps (karaoke). Incompatible with streaming. */
			wordTimestamps?: boolean;
	  }
	| { type: "cancel" };

export type WorkerResponse =
	| { type: "init-progress"; progress: number }
	| { type: "init-complete" }
	| { type: "init-error"; error: string }
	| {
			type: "transcribe-update";
			chunks: TranscriptionChunk[];
			tps: number;
	  }
	| { type: "transcribe-progress"; progress: number }
	| {
			type: "transcribe-complete";
			text: string;
			segments: TranscriptionSegment[];
			tps: number;
	  }
	| { type: "transcribe-error"; error: string }
	| { type: "cancelled" };

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;
let currentModelId: string | null = null;
let cancelled = false;
let lastReportedProgress = -1;
const fileBytes = new Map<string, { loaded: number; total: number }>();

type ResolvedBackend = {
	/** "webgpu" if available, otherwise "wasm" */
	device: "webgpu" | "wasm";
	/** Encoder dtype appropriate for the resolved device */
	encoderDtype: "fp16" | "fp32" | "q8";
	/** Signal to send to the service layer (undefined = no fallback) */
	signal?: -1 | -2;
};

/**
 * Detect the best available backend and resolve an appropriate encoder dtype.
 * Progressive fallback chain:
 *
 *  1. navigator.gpu missing          → WASM + q8 (signal: -2)
 *  2. requestAdapter() fails / null  → WASM + q8 (signal: -2)
 *  3. WebGPU OK, fp16 wanted, no shader-f16 → WebGPU + fp32 (signal: -1)
 *  4. WebGPU OK, fp32 wanted         → WebGPU + fp32
 *  5. WebGPU OK, fp16 wanted, has shader-f16 → WebGPU + fp16
 *
 * @param preferredEncoderDtype  "fp16" or "fp32" from the model config.
 */
async function detectBackend(
	preferredEncoderDtype: "fp16" | "fp32",
): Promise<ResolvedBackend> {
	// Check WebGPU availability
	if (typeof navigator === "undefined" || !("gpu" in navigator)) {
		return { device: "wasm", encoderDtype: "q8", signal: -2 };
	}

	let adapter: { features: { has: (f: string) => boolean } } | null = null;
	try {
		const gpu = (
			navigator as unknown as {
				gpu: {
					requestAdapter: () => Promise<{
						features: { has: (f: string) => boolean };
					} | null>;
				};
			}
		).gpu;
		adapter = await gpu.requestAdapter();
	} catch {
		// requestAdapter threw — no usable GPU
	}

	if (!adapter) {
		return { device: "wasm", encoderDtype: "q8", signal: -2 };
	}

	// WebGPU is available — check fp16 support
	if (preferredEncoderDtype === "fp16" && !adapter.features.has("shader-f16")) {
		return { device: "webgpu", encoderDtype: "fp32", signal: -1 };
	}

	return { device: "webgpu", encoderDtype: preferredEncoderDtype };
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
	const message = event.data;

	switch (message.type) {
		case "init":
			await handleInit({
				modelId: message.modelId,
				encoderDtype: message.encoderDtype,
			});
			break;
		case "transcribe":
			await handleTranscribe({
				audio: message.audio,
				language: message.language,
				subtask: message.subtask,
				wordTimestamps: message.wordTimestamps,
			});
			break;
		case "cancel":
			cancelled = true;
			self.postMessage({ type: "cancelled" } satisfies WorkerResponse);
			break;
	}
};

async function handleInit({
	modelId,
	encoderDtype,
}: {
	modelId: string;
	encoderDtype: "fp16" | "fp32";
}) {
	if (transcriber && currentModelId === modelId) {
		self.postMessage({ type: "init-complete" } satisfies WorkerResponse);
		return;
	}

	if (transcriber) {
		await transcriber.dispose();
		transcriber = null;
		currentModelId = null;
	}

	lastReportedProgress = -1;
	fileBytes.clear();

	try {
		// Detect the best available backend before loading the model.
		// Falls back from WebGPU → WASM automatically so transcription works
		// even on machines without a usable GPU adapter.
		const backend = await detectBackend(encoderDtype);
		if (backend.signal !== undefined) {
			self.postMessage({
				type: "init-progress",
				progress: backend.signal,
			} satisfies WorkerResponse);
		}

		// Build dtype config per device. WASM uses q8 (smaller, faster to
		// download); WebGPU uses the resolved encoder dtype + q4 decoder.
		const dtypeConfig: Record<
			"encoder_model" | "decoder_model_merged",
			"fp16" | "fp32" | "q8" | "q4"
		> =
			backend.device === "wasm"
				? { encoder_model: "q8", decoder_model_merged: "q8" }
				: {
						encoder_model: backend.encoderDtype,
						decoder_model_merged: "q4",
					};

		transcriber = (await pipeline("automatic-speech-recognition", modelId, {
			dtype: dtypeConfig,
			device: backend.device,
			progress_callback: (progressInfo: {
				status?: string;
				file?: string;
				loaded?: number;
				total?: number;
			}) => {
				const file = progressInfo.file;
				if (!file) return;

				const loaded = progressInfo.loaded ?? 0;
				const total = progressInfo.total ?? 0;

				if (progressInfo.status === "progress" && total > 0) {
					fileBytes.set(file, { loaded, total });
				} else if (progressInfo.status === "done") {
					const existing = fileBytes.get(file);
					if (existing) {
						fileBytes.set(file, {
							loaded: existing.total,
							total: existing.total,
						});
					}
				}

				let totalLoaded = 0;
				let totalSize = 0;
				for (const { loaded, total } of fileBytes.values()) {
					totalLoaded += loaded;
					totalSize += total;
				}

				if (totalSize === 0) return;

				const overallProgress = (totalLoaded / totalSize) * 100;
				const roundedProgress = Math.floor(overallProgress);

				if (roundedProgress !== lastReportedProgress) {
					lastReportedProgress = roundedProgress;
					self.postMessage({
						type: "init-progress",
						progress: roundedProgress,
					} satisfies WorkerResponse);
				}
			},
		})) as unknown as AutomaticSpeechRecognitionPipeline;

		currentModelId = modelId;
		self.postMessage({ type: "init-complete" } satisfies WorkerResponse);
	} catch (error) {
		self.postMessage({
			type: "init-error",
			error: error instanceof Error ? error.message : "Failed to load model",
		} satisfies WorkerResponse);
	}
}

async function handleTranscribe({
	audio,
	language,
	subtask,
	wordTimestamps,
}: {
	audio: Float32Array;
	language: string;
	subtask: string | null;
	wordTimestamps?: boolean;
}) {
	if (!transcriber) {
		self.postMessage({
			type: "transcribe-error",
			error: "Model not initialized",
		} satisfies WorkerResponse);
		return;
	}

	cancelled = false;

	try {
		const featureExtractor = transcriber.processor
			.feature_extractor as unknown as {
			config: { chunk_length: number };
		};
		const modelConfig = transcriber.model.config as unknown as {
			max_source_positions: number;
		};
		const timePrecision =
			featureExtractor.config.chunk_length / modelConfig.max_source_positions;

		const chunks: TranscriptionChunk[] = [];
		let chunkCount = 0;
		let startTime: number | null = null;
		let numTokens = 0;
		let tps = 0;

		const isDistilWhisper = currentModelId?.includes("distil") ?? false;
		// Distil models don't produce reliable token-level timestamps — fall
		// back to segment mode even when word timestamps were requested.
		const useWordTimestamps = (wordTimestamps ?? false) && !isDistilWhisper;
		const chunkLengthS = isDistilWhisper ? 20 : DEFAULT_CHUNK_LENGTH_SECONDS;
		const strideLengthS = isDistilWhisper ? 3 : DEFAULT_STRIDE_SECONDS;

		const WHISPER_SAMPLE_RATE = 16000;
		const audioDurationS = audio.length / WHISPER_SAMPLE_RATE;
		const stepS = chunkLengthS - strideLengthS;
		const estimatedTotalChunks = Math.max(1, Math.ceil(audioDurationS / stepS));

		let lastUpdateTime = 0;
		const UPDATE_THROTTLE_MS = 100;

		const tokenizer = transcriber.tokenizer as Parameters<
			typeof WhisperTextStreamer extends new (
				tok: infer T,
				...args: unknown[]
			) => unknown
				? T
				: never
		>;
		const streamer = new WhisperTextStreamer(tokenizer, {
			time_precision: timePrecision,
			on_chunk_start: (x: number) => {
				const offset = stepS * chunkCount;
				chunks.push({
					text: "",
					timestamp: [offset + x, null],
					finalised: false,
					offset,
				});
			},
			token_callback_function: () => {
				startTime ??= performance.now();
				numTokens++;
				if (numTokens > 1) {
					tps = (numTokens / (performance.now() - startTime)) * 1000;
				}
			},
			callback_function: (x: string) => {
				if (chunks.length === 0) return;
				const last = chunks[chunks.length - 1];
				last.text += x;

				const now = performance.now();
				if (now - lastUpdateTime >= UPDATE_THROTTLE_MS) {
					lastUpdateTime = now;
					self.postMessage({
						type: "transcribe-update",
						chunks: [...chunks],
						tps,
					} satisfies WorkerResponse);
				}
			},
			on_chunk_end: (x: number) => {
				const current = chunks[chunks.length - 1];
				current.timestamp[1] = x + current.offset;
				current.finalised = true;
			},
			on_finalize: () => {
				startTime = null;
				numTokens = 0;
				chunkCount++;

				const progress = Math.min(
					99,
					Math.round((chunkCount / estimatedTotalChunks) * 100),
				);
				self.postMessage({
					type: "transcribe-progress",
					progress,
				} satisfies WorkerResponse);
			},
		});

		const output = await transcriber(audio, {
			top_k: 0,
			do_sample: false,
			chunk_length_s: chunkLengthS,
			stride_length_s: strideLengthS,
			language: language === "auto" ? undefined : language,
			task: subtask ?? "transcribe",
			// Word mode returns per-word chunks with [start, end] timestamps,
			// but the generation config disables timestamp tokens — the
			// WhisperTextStreamer relies on those, so streaming is only
			// possible in segment mode.
			return_timestamps: useWordTimestamps ? "word" : true,
			force_full_sequences: false,
			streamer: useWordTimestamps ? undefined : streamer,
		});

		if (cancelled) return;

		// flush final streaming state
		if (chunks.length > 0) {
			self.postMessage({
				type: "transcribe-update",
				chunks: [...chunks],
				tps,
			} satisfies WorkerResponse);
		}

		const result = Array.isArray(output) ? output[0] : output;

		const segments: TranscriptionSegment[] = [];
		if (result.chunks) {
			for (const chunk of result.chunks) {
				if (chunk.timestamp && chunk.timestamp.length >= 2) {
					segments.push({
						text: chunk.text,
						start: chunk.timestamp[0] ?? 0,
						end: chunk.timestamp[1] ?? chunk.timestamp[0] ?? 0,
					});
				}
			}
		}

		self.postMessage({
			type: "transcribe-complete",
			text: result.text,
			segments,
			tps,
		} satisfies WorkerResponse);
	} catch (error) {
		if (cancelled) return;
		self.postMessage({
			type: "transcribe-error",
			error: error instanceof Error ? error.message : "Transcription failed",
		} satisfies WorkerResponse);
	}
}
