import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Audio MIME types we try, in priority order. The first one the browser
 * reports as supported via `MediaRecorder.isTypeSupported()` is used.
 */
const PREFERRED_AUDIO_MIME_TYPES = [
	"audio/webm;codecs=opus",
	"audio/webm",
	"audio/mp4",
	"audio/ogg;codecs=opus",
];

/** Pick the best supported audio recording MIME type for the current browser. */
export function pickAudioRecordingMimeType(): string | undefined {
	if (typeof MediaRecorder === "undefined") return undefined;
	for (const type of PREFERRED_AUDIO_MIME_TYPES) {
		if (MediaRecorder.isTypeSupported(type)) return type;
	}
	return undefined;
}

/** File extension to use for a given audio MIME type. */
function extensionForMimeType(mimeType: string | undefined): string {
	if (!mimeType) return "webm";
	if (mimeType.includes("mp4")) return "m4a";
	if (mimeType.includes("ogg")) return "ogg";
	return "webm";
}

interface UseVoiceRecordingOptions {
	/** Called with the completed recording wrapped as a File. */
	onComplete?: (file: File) => void;
	/** Called if the user denies permission or the browser blocks capture. */
	onError?: (error: Error) => void;
}

/**
 * In-browser microphone capture via `getUserMedia()`. The recorded audio is
 * collected into a Blob, wrapped as a `File`, and handed to `onComplete` —
 * ready to feed straight into the existing media import pipeline
 * (`processMediaAssets` → `addMediaAsset` → `insertElement`).
 *
 * The hook is intentionally self-contained: no editor state, no element types.
 * From the editor's perspective a voiceover recording is just another audio file.
 */
export function useVoiceRecording({
	onComplete,
	onError,
}: UseVoiceRecordingOptions = {}) {
	const [isRecording, setIsRecording] = useState(false);
	const [recordingTime, setRecordingTime] = useState(0);
	const [error, setError] = useState<string | null>(null);

	const recorderRef = useRef<MediaRecorder | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const startTimeRef = useRef(0);
	const mimeTypeRef = useRef<string | undefined>(undefined);

	/** Whether microphone capture is available in the current browser. */
	const isSupported =
		typeof navigator !== "undefined" &&
		!!navigator.mediaDevices?.getUserMedia &&
		typeof MediaRecorder !== "undefined";

	const stopTimer = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const stopTracks = useCallback(() => {
		const stream = streamRef.current;
		if (stream) {
			for (const track of stream.getTracks()) track.stop();
		}
		streamRef.current = null;
	}, []);

	/** Stop the active recording, finalize the Blob, and fire `onComplete`. */
	const stopRecording = useCallback(() => {
		const recorder = recorderRef.current;
		if (!recorder || recorder.state === "inactive") {
			// Already stopped.
			return;
		}

		recorder.stop();
		// `onstop` handler finalizes the file. Track cleanup happens there.
	}, [stopTimer]);

	const startRecording = useCallback(async () => {
		if (!isSupported) {
			const message = "Voiceover recording is not supported in this browser";
			setError(message);
			onError?.(new Error(message));
			return;
		}
		if (isRecording) return;

		setError(null);

		let stream: MediaStream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch (err) {
			const message =
				err instanceof DOMException && err.name === "NotAllowedError"
					? "Microphone permission denied"
					: err instanceof Error
						? err.message
						: "Failed to start voiceover recording";
			setError(message);
			onError?.(err instanceof Error ? err : new Error(message));
			return;
		}

		const mimeType = pickAudioRecordingMimeType();
		let recorder: MediaRecorder;
		try {
			recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
		} catch (err) {
			for (const track of stream.getTracks()) track.stop();
			const message =
				err instanceof Error ? err.message : "Failed to start recorder";
			setError(message);
			onError?.(err instanceof Error ? err : new Error(message));
			return;
		}

		streamRef.current = stream;
		recorderRef.current = recorder;
		chunksRef.current = [];
		mimeTypeRef.current = mimeType ?? recorder.mimeType;

		recorder.ondataavailable = (event) => {
			if (event.data.size > 0) {
				chunksRef.current.push(event.data);
			}
		};

		recorder.onstop = () => {
			const blob = new Blob(chunksRef.current, {
				type: mimeTypeRef.current || "audio/webm",
			});
			chunksRef.current = [];

			const extension = extensionForMimeType(mimeTypeRef.current);
			const file = new File([blob], `voiceover-${Date.now()}.${extension}`, {
				type: blob.type,
			});

			stopTimer();
			stopTracks();
			setIsRecording(false);
			setRecordingTime(0);
			recorderRef.current = null;

			if (file.size > 0) {
				onComplete?.(file);
			}
		};

		recorder.start(1000); // collect a chunk every second for safety
		startTimeRef.current = Date.now();
		setIsRecording(true);
		setRecordingTime(0);
		timerRef.current = setInterval(() => {
			setRecordingTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
		}, 1000);
	}, [isSupported, isRecording, onComplete, onError, stopTimer]);

	/** Clean up everything if the component unmounts mid-recording. */
	useEffect(() => {
		return () => {
			stopTimer();
			const recorder = recorderRef.current;
			if (recorder && recorder.state !== "inactive") {
				try {
					recorder.stop();
				} catch {
					// ignore — best-effort cleanup
				}
			}
			stopTracks();
		};
	}, [stopTimer, stopTracks]);

	return {
		isSupported,
		isRecording,
		recordingTime,
		error,
		startRecording,
		stopRecording,
	};
}
