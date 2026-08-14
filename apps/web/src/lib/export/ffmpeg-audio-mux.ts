import type { FFmpeg } from "@ffmpeg/ffmpeg";

/**
 * Software AAC fallback for MP4 export.
 *
 * Some browsers (notably Linux Chromium without proprietary codecs) have no
 * native AAC encoder, so WebCodecs can't produce MP4 audio. This module muxes
 * timeline audio into an already-rendered video-only MP4 using ffmpeg.wasm
 * (video stream is copied, audio is encoded to AAC in wasm — no upload,
 * everything stays on-device).
 *
 * The 32MB core is served from /public/ffmpeg and lazy-loaded only when this
 * fallback actually runs; browsers with native AAC never touch it.
 */

const FFMPEG_CORE_URL = "/ffmpeg/ffmpeg-core.js";
const FFMPEG_WASM_URL = "/ffmpeg/ffmpeg-core.wasm";
const FFMPEG_WORKER_URL = "/ffmpeg/ffmpeg-worker.js";

let ffmpegInstance: FFmpeg | null = null;

async function getFfmpeg(): Promise<FFmpeg> {
	if (ffmpegInstance) {
		return ffmpegInstance;
	}

	const { FFmpeg } = await import("@ffmpeg/ffmpeg");
	const ffmpeg = new FFmpeg();
	await ffmpeg.load({
		coreURL: new URL(FFMPEG_CORE_URL, window.location.origin).toString(),
		wasmURL: new URL(FFMPEG_WASM_URL, window.location.origin).toString(),
		classWorkerURL: new URL(
			FFMPEG_WORKER_URL,
			window.location.origin,
		).toString(),
	});
	ffmpegInstance = ffmpeg;
	return ffmpeg;
}

/** Convert mixed timeline AudioBuffer to a 16-bit PCM WAV file for ffmpeg. */
export function audioBufferToWav(audioBuffer: AudioBuffer): Uint8Array {
	const numChannels = audioBuffer.numberOfChannels;
	const sampleRate = audioBuffer.sampleRate;
	const numSamples = audioBuffer.length;
	const bitsPerSample = 16;
	const bytesPerSample = bitsPerSample / 8;
	const dataSize = numSamples * numChannels * bytesPerSample;

	const buffer = new ArrayBuffer(44 + dataSize);
	const view = new DataView(buffer);

	const writeString = (offset: number, str: string) => {
		for (let i = 0; i < str.length; i++) {
			view.setUint8(offset + i, str.charCodeAt(i));
		}
	};

	writeString(0, "RIFF");
	view.setUint32(4, 36 + dataSize, true);
	writeString(8, "WAVE");
	writeString(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true); // PCM
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
	view.setUint16(32, numChannels * bytesPerSample, true);
	view.setUint16(34, bitsPerSample, true);
	writeString(36, "data");
	view.setUint32(40, dataSize, true);

	const channels: Float32Array[] = [];
	for (let ch = 0; ch < numChannels; ch++) {
		channels.push(audioBuffer.getChannelData(ch));
	}

	let offset = 44;
	for (let i = 0; i < numSamples; i++) {
		for (let ch = 0; ch < numChannels; ch++) {
			const sample = Math.max(-1, Math.min(1, channels[ch][i]));
			const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
			view.setInt16(offset, int16, true);
			offset += 2;
		}
	}

	return new Uint8Array(buffer);
}

/** Error thrown when the mux is aborted via `shouldAbort`. */
export class MuxAbortedError extends Error {
	constructor() {
		super("Audio mux cancelled");
		this.name = "MuxAbortedError";
	}
}

/**
 * Mux WAV audio into a video-only MP4, encoding audio to AAC in wasm.
 * Video stream is stream-copied — no re-encode, fast.
 */
export async function muxAacAudioIntoMp4({
	videoBuffer,
	audioWav,
	audioBitrate = 192_000,
	onProgress,
	shouldAbort,
}: {
	videoBuffer: ArrayBuffer;
	audioWav: Uint8Array;
	audioBitrate?: number;
	onProgress?: ({ progress }: { progress: number }) => void;
	shouldAbort?: () => boolean;
}): Promise<ArrayBuffer> {
	const ffmpeg = await getFfmpeg();

	const progressHandler = ({ progress }: { progress: number }) => {
		onProgress?.({ progress });
	};
	ffmpeg.on("progress", progressHandler);

	// ffmpeg.exec has no built-in cancellation — watch for abort requests and
	// terminate the whole worker, which rejects the pending exec promise.
	const abortInterval = shouldAbort
		? setInterval(() => {
				if (shouldAbort()) {
					ffmpegInstance = null;
					ffmpeg.terminate();
				}
			}, 100)
		: null;

	try {
		await ffmpeg.writeFile("input.mp4", new Uint8Array(videoBuffer));
		await ffmpeg.writeFile("audio.wav", audioWav);

		const returnCode = await ffmpeg.exec([
			"-i",
			"input.mp4",
			"-i",
			"audio.wav",
			"-c:v",
			"copy",
			"-c:a",
			"aac",
			"-b:a",
			`${audioBitrate}`,
			"-movflags",
			"+faststart",
			"-y",
			"output.mp4",
		]);
		if (shouldAbort?.()) {
			throw new MuxAbortedError();
		}
		if (returnCode !== 0) {
			throw new Error(
				"ffmpeg.wasm failed to mux audio into MP4. Try the WebM format instead.",
			);
		}

		const output = await ffmpeg.readFile("output.mp4");
		if (!(output instanceof Uint8Array)) {
			throw new Error("ffmpeg.wasm produced no output file.");
		}

		// Copy out of wasm-owned memory before freeing the virtual files.
		const result = output.slice().buffer;

		await ffmpeg.deleteFile("input.mp4");
		await ffmpeg.deleteFile("audio.wav");
		await ffmpeg.deleteFile("output.mp4");

		return result;
	} catch (error) {
		// Worker was terminated mid-exec — treat as cancellation.
		if (shouldAbort?.()) {
			ffmpegInstance = null;
			throw new MuxAbortedError();
		}
		throw error;
	} finally {
		if (abortInterval) clearInterval(abortInterval);
		ffmpeg.off("progress", progressHandler);
	}
}
