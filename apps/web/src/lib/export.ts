import {
	canEncodeAudio,
	canEncodeVideo,
	type AudioCodec,
	type VideoCodec,
} from "mediabunny";
import { EXPORT_MIME_TYPES } from "@/constants/export-constants";
import type { ExportFormat } from "@/types/export";

export function getExportMimeType({
	format,
}: {
	format: ExportFormat;
}): string {
	return EXPORT_MIME_TYPES[format];
}

export function getExportFileExtension({
	format,
}: {
	format: ExportFormat;
}): string {
	return `.${format}`;
}

const VIDEO_CODEC_BY_FORMAT: Record<ExportFormat, VideoCodec> = {
	mp4: "avc",
	webm: "vp9",
};

const AUDIO_CODEC_BY_FORMAT: Record<ExportFormat, AudioCodec> = {
	mp4: "aac",
	webm: "opus",
};

export function getVideoCodecForFormat(format: ExportFormat): VideoCodec {
	return VIDEO_CODEC_BY_FORMAT[format];
}

export function getAudioCodecForFormat(format: ExportFormat): AudioCodec {
	return AUDIO_CODEC_BY_FORMAT[format];
}

export type ExportCodecCheck = {
	ok: boolean;
	/** Which encoder failed the support probe, if any. */
	failed?: "video" | "audio";
};

/**
 * Pre-flight probe of WebCodecs encoder support for the chosen export config.
 *
 * AAC encoding is unavailable on some browsers (e.g. Linux Chromium without
 * proprietary codecs), which only surfaces as a throw deep inside the muxer.
 * Probing up front lets us fail fast with an actionable message instead.
 *
 * Codec support is all-or-nothing per codec/sampleRate/channels, so we omit
 * bitrate — it won't flip an unsupported codec to supported.
 */
export async function checkExportCodecSupport({
	format,
	includeAudio,
	width,
	height,
}: {
	format: ExportFormat;
	includeAudio?: boolean;
	width: number;
	height: number;
}): Promise<ExportCodecCheck> {
	const videoOk = await canEncodeVideo(getVideoCodecForFormat(format), {
		width,
		height,
	});
	if (!videoOk) {
		return { ok: false, failed: "video" };
	}

	if (includeAudio) {
		const audioOk = await canEncodeAudio(getAudioCodecForFormat(format), {
			sampleRate: 44100,
			numberOfChannels: 2,
		});
		if (!audioOk) {
			return { ok: false, failed: "audio" };
		}
	}

	return { ok: true };
}
