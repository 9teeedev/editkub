"use client";

import { useEffect, useRef } from "react";
import { useVoiceRecording } from "@/hooks/use-voice-recording";
import { useVoiceoverStore } from "@/stores/voiceover-store";
import { useEditor } from "@/hooks/use-editor";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { toast } from "sonner";
import { processMediaAssets } from "@/lib/media/processing";
import { buildUploadAudioElement } from "@/lib/timeline/element-utils";
import { StopCircleIcon, Mic01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/utils/ui";

function formatRecordingTime(seconds: number) {
	const min = Math.floor(seconds / 60);
	const sec = seconds % 60;
	return `${min}:${sec.toString().padStart(2, "0")}`;
}

interface VoiceoverOverlayProps {
	/** Rendered size of the preview canvas (for overlay positioning). */
	displaySize: { width: number; height: number };
}

/**
 * Preview overlay that coordinates the voiceover recording flow:
 *   countdown (3·2·1) → recording (mic + playback running) → stop → insert.
 *
 * Mounted inside the preview canvas container. Stays invisible during idle.
 */
export function VoiceoverOverlay({ displaySize }: VoiceoverOverlayProps) {
	const { t } = useTranslation();
	const editor = useEditor();
	const {
		mode,
		countdown,
		startTime,
		monitorOriginalAudio,
		beginRecording,
		stop,
	} = useVoiceoverStore();
	const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	// Saved volume to restore after muting during recording.
	const savedVolumeRef = useRef<number | null>(null);

	const handleComplete = async (file: File) => {
		const activeProject = editor.project.getActive();
		if (!activeProject) return;
		const projectId = activeProject.metadata.id;

		try {
			const [processed] = await processMediaAssets({ files: [file] });
			if (!processed) return;
			const mediaId = await editor.media.addMediaAsset({
				projectId,
				asset: processed,
			});
			const element = buildUploadAudioElement({
				mediaId,
				name: file.name,
				duration: processed.duration ?? 0,
				startTime,
				isVoiceover: true,
			});
			editor.timeline.insertElement({
				element,
				placement: { mode: "auto" },
			});
			toast.success(t("Voiceover added to timeline"));
		} catch (error) {
			console.error("Voiceover import failed:", error);
			toast.error(t("Voiceover recording failed"));
		}
	};

	const {
		recordingTime,
		startRecording,
		stopRecording,
		isSupported,
		error,
	} = useVoiceRecording({
		onComplete: handleComplete,
		onError: (err) => toast.error(err.message),
	});

	// Countdown phase: tick 3 → 2 → 1, then arm recording + start playback.
	useEffect(() => {
		if (mode !== "countdown") return;

		countdownTimerRef.current = setInterval(() => {
			const current = useVoiceoverStore.getState().countdown;
			if (current === null) return;
			if (current <= 1) {
				// Countdown finished → begin recording phase.
				if (countdownTimerRef.current) {
					clearInterval(countdownTimerRef.current);
					countdownTimerRef.current = null;
				}
				armRecording();
			} else {
				useVoiceoverStore.setState({ countdown: current - 1 });
			}
		}, 1000);

		return () => {
			if (countdownTimerRef.current) {
				clearInterval(countdownTimerRef.current);
				countdownTimerRef.current = null;
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mode]);

	// Transition from countdown → recording: seek, (optionally mute), play, record.
	const armRecording = async () => {
		beginRecording();
		// Seek to the captured start position.
		editor.playback.seek({ time: startTime });

		// If the user doesn't want to hear the original audio, mute master.
		if (!monitorOriginalAudio) {
			savedVolumeRef.current = editor.playback.getVolume();
			editor.playback.mute();
		}

		editor.playback.play();
		await startRecording();
	};

	// Stop everything (user clicked stop, or playback ended).
	const handleStop = () => {
		stopRecording();
		editor.playback.pause();

		// Restore volume if we muted it.
		if (savedVolumeRef.current !== null) {
			editor.playback.setVolume({ volume: savedVolumeRef.current });
			savedVolumeRef.current = null;
		}
		stop();
	};

	// Auto-stop when playback reaches the end of the timeline.
	useEffect(() => {
		if (mode !== "recording") return;
		const handler = (event: Event) => {
			const detail = (event as CustomEvent).detail as { time: number };
			const duration = editor.timeline.getTotalDuration();
			if (duration > 0 && detail.time >= duration - 0.05) {
				handleStop();
			}
		};
		window.addEventListener("playback-update", handler);
		window.addEventListener("playback-seek", handler);
		return () => {
			window.removeEventListener("playback-update", handler);
			window.removeEventListener("playback-seek", handler);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mode, startTime, monitorOriginalAudio]);

	// Cancel countdown/recording if the hook errors out (e.g. mic denied).
	useEffect(() => {
		if (error && mode !== "idle") {
			stop();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [error]);

	// Surface "not supported" before starting.
	if (!isSupported && mode !== "idle") {
		stop();
		toast.error(t("Voiceover recording is not supported in this browser"));
		return null;
	}

	if (mode === "idle") return null;

	const isCountdown = mode === "countdown";

	return (
		<div
			className="pointer-events-none absolute inset-0 flex items-center justify-center"
			style={{ width: displaySize.width, height: displaySize.height }}
		>
			{isCountdown ? (
				<div
					key={countdown}
					className={cn(
						"flex size-24 items-center justify-center rounded-full bg-black/70 text-7xl font-bold text-white",
						"animate-in fade-in zoom-in duration-300",
					)}
				>
					{countdown}
				</div>
			) : (
				<div className="pointer-events-auto flex flex-col items-center gap-4">
					<div className="flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-white shadow-lg">
						<span className="relative flex size-3">
							<span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
							<span className="relative inline-flex size-3 rounded-full bg-white" />
						</span>
						<span className="font-mono text-sm font-medium">
							REC {formatRecordingTime(recordingTime)}
						</span>
					</div>
					<button
						type="button"
						onClick={handleStop}
						className={cn(
							"flex items-center gap-2 rounded-full bg-black/70 px-6 py-3 text-white shadow-lg transition hover:bg-black/80",
						)}
					>
						<HugeiconsIcon
							icon={StopCircleIcon}
							className="size-5 text-red-500"
						/>
						<span className="text-sm font-medium">{t("Stop recording")}</span>
					</button>
				</div>
			)}

			{/* Mic indicator badge while recording */}
			{!isCountdown && (
				<div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-white shadow">
					<HugeiconsIcon icon={Mic01Icon} className="size-3.5" />
					<span className="text-xs font-medium">{t("Voiceover")}</span>
				</div>
			)}
		</div>
	);
}
