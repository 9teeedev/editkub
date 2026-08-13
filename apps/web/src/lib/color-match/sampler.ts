/**
 * Sample an element's source frame as ImageData for color analysis.
 *
 * For video elements, decodes a single frame at the element's local time
 * (trimStart + playhead offset) using mediabunny's VideoSampleSink.
 * For image elements, decodes the full image via the browser's Image
 * decoder.
 *
 * Both paths downscale to a max edge of 256px before getImageData — enough
 * resolution for histogram statistics, fast to process.
 */
import { Input, ALL_FORMATS, BlobSource, VideoSampleSink } from "mediabunny";
import type { ImageElement, VideoElement } from "@/types/timeline";
import { computeStats, type ImageStats } from "./histogram";

const SAMPLE_MAX_EDGE = 256;

/** Decode a video frame and return its pixel statistics. */
export async function sampleVideoFrame({
	file,
	timeInSeconds,
}: {
	file: File;
	timeInSeconds: number;
}): Promise<ImageStats | null> {
	const input = new Input({
		source: new BlobSource(file),
		formats: ALL_FORMATS,
	});

	const videoTrack = await input.getPrimaryVideoTrack();
	if (!videoTrack) return null;

	const canDecode = await videoTrack.canDecode();
	if (!canDecode) return null;

	const sink = new VideoSampleSink(videoTrack);
	const frame = await sink.getSample(Math.max(0, timeInSeconds));
	if (!frame) return null;

	try {
		const srcW = videoTrack.displayWidth;
		const srcH = videoTrack.displayHeight;
		const scale = Math.min(1, SAMPLE_MAX_EDGE / Math.max(srcW, srcH));
		const w = Math.max(1, Math.round(srcW * scale));
		const h = Math.max(1, Math.round(srcH * scale));

		const canvas =
			typeof OffscreenCanvas !== "undefined"
				? new OffscreenCanvas(w, h)
				: (() => {
						const c = document.createElement("canvas");
						c.width = w;
						c.height = h;
						return c;
					})();
		const ctx = canvas.getContext("2d") as
			| CanvasRenderingContext2D
			| OffscreenCanvasRenderingContext2D
			| null;
		if (!ctx) return null;

		frame.draw(ctx as CanvasRenderingContext2D, 0, 0, w, h);
		const imageData = ctx.getImageData(0, 0, w, h);
		return computeStats(imageData.data);
	} finally {
		frame.close();
	}
}

/** Decode an image and return its pixel statistics. */
export async function sampleImageFrame({
	file,
}: {
	file: File;
}): Promise<ImageStats | null> {
	const url = URL.createObjectURL(file);
	try {
		const img = await new Promise<HTMLImageElement | null>((resolve) => {
			const image = new window.Image();
			image.addEventListener("load", () => resolve(image));
			image.addEventListener("error", () => resolve(null));
			image.src = url;
		});
		if (!img) return null;

		const scale = Math.min(
			1,
			SAMPLE_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight),
		);
		const w = Math.max(1, Math.round(img.naturalWidth * scale));
		const h = Math.max(1, Math.round(img.naturalHeight * scale));

		const canvas = document.createElement("canvas");
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext("2d");
		if (!ctx) return null;

		ctx.drawImage(img, 0, 0, w, h);
		const imageData = ctx.getImageData(0, 0, w, h);
		return computeStats(imageData.data);
	} finally {
		URL.revokeObjectURL(url);
	}
}

/** Sample stats for a visual element given its source file + playhead. */
export async function sampleElementStats({
	element,
	file,
	currentTime,
}: {
	element: VideoElement | ImageElement;
	file: File;
	/** Absolute playhead time in seconds. */
	currentTime: number;
}): Promise<ImageStats | null> {
	if (element.type === "image") {
		return sampleImageFrame({ file });
	}

	// Video: local source time = trimStart + offset into element.
	const offsetInto = Math.max(0, currentTime - element.startTime);
	const sourceTime = element.trimStart + offsetInto;
	return sampleVideoFrame({ file, timeInSeconds: sourceTime });
}
