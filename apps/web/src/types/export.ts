export const EXPORT_QUALITY_VALUES = [
	"low",
	"medium",
	"high",
	"very_high",
] as const;

export const EXPORT_FORMAT_VALUES = ["mp4", "webm"] as const;

export type ExportFormat = (typeof EXPORT_FORMAT_VALUES)[number];
export type ExportQuality = (typeof EXPORT_QUALITY_VALUES)[number];

export interface ExportOptions {
	format: ExportFormat;
	quality: ExportQuality;
	fps?: number;
	includeAudio?: boolean;
	onProgress?: ({ progress }: { progress: number }) => void;
	onCancel?: () => boolean;
}

/** Machine-readable export error category, so the UI can offer recovery. */
export type ExportErrorCode = "unsupported_codec" | "unknown";

export interface ExportResult {
	success: boolean;
	buffer?: ArrayBuffer;
	error?: string;
	code?: ExportErrorCode;
	cancelled?: boolean;
}
