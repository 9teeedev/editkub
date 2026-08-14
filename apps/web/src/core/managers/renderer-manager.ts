import type { EditorCore } from "@/core";
import type { RootNode } from "@/services/renderer/nodes/root-node";
import type { ExportOptions, ExportResult } from "@/types/export";
import { SceneExporter } from "@/services/renderer/scene-exporter";
import { buildScene } from "@/services/renderer/scene-builder";
import { createTimelineAudioBuffer } from "@/lib/media/audio";
import { checkExportCodecSupport } from "@/lib/export";
import {
	MuxAbortedError,
	audioBufferToWav,
	muxAacAudioIntoMp4,
} from "@/lib/export/ffmpeg-audio-mux";

export class RendererManager {
	private renderTree: RootNode | null = null;
	private listeners = new Set<() => void>();

	constructor(private editor: EditorCore) {}

	setRenderTree({ renderTree }: { renderTree: RootNode | null }): void {
		this.renderTree = renderTree;
		this.notify();
	}

	getRenderTree(): RootNode | null {
		return this.renderTree;
	}

	async exportProject({
		options,
	}: {
		options: ExportOptions;
	}): Promise<ExportResult> {
		const { format, quality, fps, includeAudio, onProgress, onCancel } =
			options;

		try {
			const tracks = this.editor.timeline.getTracks();
			const mediaAssets = this.editor.media.getAssets();
			const activeProject = this.editor.project.getActive();

			if (!activeProject) {
				return { success: false, error: "No active project" };
			}

			const duration = this.editor.timeline.getTotalDuration();
			if (duration === 0) {
				return { success: false, error: "Project is empty" };
			}

			const exportFps = fps || activeProject.settings.fps;
			const canvasSize = activeProject.settings.canvasSize;

			// Pre-flight: fail fast if this browser can't encode the chosen codec.
			// AAC (mp4) encoding is unsupported on some browsers and would otherwise
			// throw deep inside the muxer mid-export.
			const codecCheck = await checkExportCodecSupport({
				format,
				includeAudio: !!includeAudio,
				width: canvasSize.width,
				height: canvasSize.height,
			});

			// MP4 + no native AAC encoder → export video-only, then software-encode
			// the audio track with ffmpeg.wasm and mux it in (stays on-device).
			const useFfmpegAudioFallback =
				!codecCheck.ok &&
				codecCheck.failed === "audio" &&
				format === "mp4" &&
				!!includeAudio;

			if (!codecCheck.ok && !useFfmpegAudioFallback) {
				if (codecCheck.failed === "audio") {
					return {
						success: false,
						code: "unsupported_codec",
						error: "Audio encoding isn't supported by this browser. Try disabling audio.",
					};
				}
				return {
					success: false,
					code: "unsupported_codec",
					error: `Video encoding (${format === "mp4" ? "H.264" : "VP9"}) isn't supported by this browser. Try the ${format === "mp4" ? "WebM" : "MP4"} format.`,
				};
			}

			let audioBuffer: AudioBuffer | null = null;
			if (includeAudio) {
				onProgress?.({ progress: 0.05 });
				audioBuffer = await createTimelineAudioBuffer({
					tracks,
					mediaAssets,
					duration,
				});
			}

			const scene = buildScene({
				tracks,
				mediaAssets,
				duration,
				canvasSize,
				background: activeProject.settings.background,
			});

			const exporter = new SceneExporter({
				width: canvasSize.width,
				height: canvasSize.height,
				fps: exportFps,
				format,
				quality,
				shouldIncludeAudio: !!includeAudio && !useFfmpegAudioFallback,
				audioBuffer: audioBuffer || undefined,
			});

			exporter.on("progress", (progress) => {
				const adjustedProgress = includeAudio
					? 0.05 + progress * 0.95
					: progress;
				onProgress?.({ progress: adjustedProgress });
			});

			let cancelled = false;
			const checkCancel = () => {
				if (onCancel?.()) {
					cancelled = true;
					exporter.cancel();
				}
			};

			const cancelInterval = setInterval(checkCancel, 100);

			try {
				const buffer = await exporter.export({ rootNode: scene });
				clearInterval(cancelInterval);

				if (cancelled) {
					return { success: false, cancelled: true };
				}

				if (!buffer) {
					return { success: false, error: "Export failed to produce buffer" };
				}

				if (useFfmpegAudioFallback && audioBuffer) {
					if (cancelled) {
						return { success: false, cancelled: true };
					}

					const audioBitrateByQuality: Record<string, number> = {
						low: 128_000,
						medium: 160_000,
						high: 192_000,
						very_high: 256_000,
					};

					try {
						const muxed = await muxAacAudioIntoMp4({
							videoBuffer: buffer,
							audioWav: audioBufferToWav(audioBuffer),
							audioBitrate: audioBitrateByQuality[quality] ?? 192_000,
							onProgress: ({ progress }) =>
								onProgress?.({ progress: 0.95 + progress * 0.05 }),
							shouldAbort: () => !!onCancel?.(),
						});
						return { success: true, buffer: muxed };
					} catch (error) {
						if (error instanceof MuxAbortedError || onCancel?.()) {
							return { success: false, cancelled: true };
						}
						console.error("ffmpeg.wasm audio mux failed:", error);
						return {
							success: false,
							code: "unsupported_codec",
							error:
								error instanceof Error
									? error.message
									: "Audio encoding failed. Try the WebM format instead.",
						};
					}
				}

				return {
					success: true,
					buffer,
				};
			} finally {
				clearInterval(cancelInterval);
			}
		} catch (error) {
			console.error("Export failed:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown export error",
			};
		}
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		this.listeners.forEach((fn) => fn());
	}
}
