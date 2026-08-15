import type { BackgroundRemovalConfig } from "@/types/timeline";
import { createCanvas, type DrawableCanvas } from "@/lib/renderer/chroma-key";

type BackgroundRemovalPipeline = (
	input: HTMLCanvasElement | OffscreenCanvas,
) => Promise<Array<{ toCanvas: () => CanvasImageSource }>>;

export type BackgroundRemovalStatus =
	| "idle"
	| "loading"
	| "processing"
	| "ready"
	| "error";

let pipelinePromise: Promise<BackgroundRemovalPipeline> | null = null;
let status: BackgroundRemovalStatus = "idle";
let requestId = 0;
const listeners = new Set<() => void>();

function setStatus(nextStatus: BackgroundRemovalStatus) {
	if (status === nextStatus) return;
	status = nextStatus;
	for (const listener of listeners) listener();
}

export function subscribeBackgroundRemovalStatus(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function getBackgroundRemovalStatus() {
	return status;
}

export function requestBackgroundRemoval() {
	requestId += 1;
	setStatus("loading");
}

export function cancelBackgroundRemoval() {
	requestId = 0;
	setStatus("idle");
}

function markProcessing() {
	if (requestId) setStatus("processing");
}

function markReady() {
	if (requestId) {
		requestId = 0;
		setStatus("ready");
	}
}

export function reportBackgroundRemovalError() {
	if (requestId) {
		requestId = 0;
		setStatus("error");
	}
}

async function getPipeline(): Promise<BackgroundRemovalPipeline> {
	if (pipelinePromise) return pipelinePromise;

	pipelinePromise = (async () => {
		const { pipeline } = await import("@huggingface/transformers");

		return (await pipeline("background-removal", "Xenova/modnet", {
			// WASM works without browser-specific WebGPU flags or fp16 support.
			device: "wasm",
			dtype: "q8",
		})) as unknown as BackgroundRemovalPipeline;
	})();

	try {
		return await pipelinePromise;
	} catch (error) {
		pipelinePromise = null;
		throw error;
	}
}

/** Run local MODNet matting and write the transparent frame into target. */
export async function applyBackgroundRemoval({
	source,
	sourceWidth,
	sourceHeight,
	config,
	target,
}: {
	source: CanvasImageSource;
	sourceWidth: number;
	sourceHeight: number;
	config: BackgroundRemovalConfig;
	target: DrawableCanvas;
}): Promise<DrawableCanvas> {
	if (!config.enabled) return target;
	if (status === "idle") requestBackgroundRemoval();

	try {
		const input = createCanvas({ width: sourceWidth, height: sourceHeight });
		const inputContext = input.getContext("2d") as
			| CanvasRenderingContext2D
			| OffscreenCanvasRenderingContext2D
			| null;
		if (!inputContext) return target;
		inputContext.drawImage(source, 0, 0, sourceWidth, sourceHeight);

		const pipeline = await getPipeline();
		markProcessing();
		const [result] = await pipeline(input);
		if (!result) return target;

		const output = result.toCanvas() as DrawableCanvas;
		const targetContext = target.getContext("2d") as
			| CanvasRenderingContext2D
			| OffscreenCanvasRenderingContext2D
			| null;
		if (!targetContext) return target;

		targetContext.clearRect(0, 0, sourceWidth, sourceHeight);
		targetContext.drawImage(output, 0, 0, sourceWidth, sourceHeight);
		markReady();
		return target;
	} catch (error) {
		reportBackgroundRemovalError();
		throw error;
	}
}
