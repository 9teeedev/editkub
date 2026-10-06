import { describe, expect, mock, test } from "bun:test";

// SceneExporter needs WebCodecs/OffscreenCanvas at runtime; bun has neither.
// Mock mediabunny and the canvas renderer so the export control flow —
// cancel checks, error cleanup, finalization — can be exercised directly.
// Both mocks spread the real module first: bun's mock.module is
// process-global, and a bare-object mock would leak to every later test
// that imports mediabunny (e.g. ALL_FORMATS consumers) and crash them.

import * as realMediabunny from "mediabunny";
import * as realCanvasRenderer from "./canvas-renderer";

class FakeOutput {
	static instances: FakeOutput[] = [];
	started = 0;
	cancelled = 0;
	finalized = 0;
	videoTracks: unknown[] = [];
	target: { buffer?: ArrayBuffer } = {};

	constructor() {
		FakeOutput.instances.push(this);
	}

	addVideoTrack(track: unknown) {
		this.videoTracks.push(track);
	}

	addAudioTrack() {}

	async start() {
		this.started++;
	}

	async cancel() {
		this.cancelled++;
	}

	async finalize() {
		this.finalized++;
		this.target = { buffer: new ArrayBuffer(8) };
	}
}

class FakeCanvasSource {
	added = 0;
	closed = 0;
	async add() {
		this.added++;
	}
	close() {
		this.closed++;
	}
}

mock.module("mediabunny", () => ({
	...realMediabunny,
	Output: FakeOutput,
	Mp4OutputFormat: class {},
	WebMOutputFormat: class {},
	BufferTarget: class {},
	CanvasSource: FakeCanvasSource,
	AudioBufferSource: class {
		async add() {}
		close() {}
	},
}));

mock.module("./canvas-renderer", () => ({
	...realCanvasRenderer,
	CanvasRenderer: class {
		width = 1080;
		height = 1920;
		fps = 30;
		canvas = {};
		context = {};
		async render({
			node,
			time,
		}: {
			node: { render: (p: unknown) => Promise<void> };
			time: number;
		}) {
			await node.render({ renderer: this, time });
		}
	},
}));

const { SceneExporter } = await import("./scene-exporter");
type RootNodeLike = import("./nodes/root-node").RootNode;

// minimal structural stand-in for RootNode (only what export() touches)
function rootNodeThat(render: (time: number) => void): RootNodeLike {
	return {
		duration: 0.2, // 6 frames at 30 fps
		render: async ({ time }: { time: number }) => {
			render(time);
		},
	} as unknown as RootNodeLike;
}

function makeExporter() {
	return new SceneExporter({
		width: 1080,
		height: 1920,
		fps: 30,
		format: "mp4",
		quality: "high",
	});
}

describe("SceneExporter error cleanup", () => {
	test("mid-loop render failure cancels the output and rethrows", async () => {
		FakeOutput.instances.length = 0;
		const exporter = makeExporter();
		// throw once past the first frame (i = 3, time = 0.1)
		const node = rootNodeThat((time) => {
			if (time >= 0.1) throw new Error("boom");
		});

		await expect(exporter.export({ rootNode: node })).rejects.toThrow("boom");

		const output = FakeOutput.instances[0];
		expect(output.started).toBe(1);
		expect(output.cancelled).toBe(1);
		expect(output.finalized).toBe(0);
	});

	test("a failing cleanup keeps the original export error", async () => {
		FakeOutput.instances.length = 0;
		const realCancel = FakeOutput.prototype.cancel;
		FakeOutput.prototype.cancel = async () => {
			throw new Error("cleanup exploded");
		};
		try {
			const exporter = makeExporter();
			const node = rootNodeThat((time) => {
				if (time >= 0.1) throw new Error("boom");
			});
			await expect(exporter.export({ rootNode: node })).rejects.toThrow("boom");
		} finally {
			FakeOutput.prototype.cancel = realCancel;
		}
	});

	test("successful export finalizes without cancelling", async () => {
		FakeOutput.instances.length = 0;
		const exporter = makeExporter();
		const node = rootNodeThat(() => {});

		const buffer = await exporter.export({ rootNode: node });

		const output = FakeOutput.instances[0];
		expect(buffer).toBeInstanceOf(ArrayBuffer);
		expect(output.finalized).toBe(1);
		expect(output.cancelled).toBe(0);
	});

	test("cancellation emits cancelled and cancels the output once", async () => {
		FakeOutput.instances.length = 0;
		const exporter = makeExporter();
		const node = rootNodeThat(() => {
			// flip the cancel flag during the first frame; the loop notices at i=1
			exporter.cancel();
		});

		const events: string[] = [];
		exporter.on("cancelled", () => events.push("cancelled"));

		const buffer = await exporter.export({ rootNode: node });

		expect(buffer).toBeNull();
		expect(events).toEqual(["cancelled"]);
		expect(FakeOutput.instances[0].cancelled).toBe(1);
	});
});
