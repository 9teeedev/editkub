import { expect, test } from "bun:test";
import {
	drawCaptionBoxOutline,
	orderCaptionWordsForPaint,
	type LaidOutWord,
} from "./text-node";

function createRecordingContext() {
	const calls: Array<Record<string, unknown>> = [];
	const stack: Array<Record<string, unknown>> = [];
	type RecordingContext = {
		globalAlpha: number;
		fillStyle: string;
		strokeStyle: string;
		lineWidth: number;
		save(): void;
		restore(): void;
		beginPath(): void;
		roundRect(...args: unknown[]): void;
		fill(): void;
		stroke(): void;
		fillText(text: string): void;
	};
	const context: RecordingContext = {
		globalAlpha: 1,
		fillStyle: "",
		strokeStyle: "",
		lineWidth: 0,
		save() {
			stack.push({
				globalAlpha: this.globalAlpha,
				fillStyle: this.fillStyle,
				strokeStyle: this.strokeStyle,
				lineWidth: this.lineWidth,
			});
		},
		restore() {
			Object.assign(this, stack.pop());
		},
		beginPath() {},
		roundRect(...args: unknown[]) {
			calls.push({ name: "roundRect", args });
		},
		fill() {
			calls.push({
				name: "fill",
				alpha: this.globalAlpha,
				color: this.fillStyle,
			});
		},
		stroke() {
			calls.push({
				name: "stroke",
				alpha: this.globalAlpha,
				color: this.strokeStyle,
			});
		},
		fillText(text: string) {
			calls.push({
				name: "fillText",
				text,
				alpha: this.globalAlpha,
				color: this.fillStyle,
			});
		},
	};

	return { calls, context: context as unknown as CanvasRenderingContext2D };
}

test("box outline is rounded, tinted, and colors the active word", () => {
	const { calls, context } = createRecordingContext();

	drawCaptionBoxOutline({
		context,
		text: "ซับ",
		wordX: 10,
		lineY: 40,
		wordWidth: 30,
		ascent: 12,
		descent: 3,
		scaledFontSize: 20,
		accentColor: "#fbbf24",
		entrance: 0.5,
	});

	const rounded = calls.find((call) => call.name === "roundRect");
	expect((rounded?.args as number[])[4]).toBeGreaterThan(0);
	expect(calls.find((call) => call.name === "fill")).toMatchObject({
		alpha: 0.09,
		color: "#fbbf24",
	});
	expect(calls.find((call) => call.name === "stroke")).toMatchObject({
		alpha: 0.5,
		color: "#fbbf24",
	});
	expect(calls.find((call) => call.name === "fillText")).toMatchObject({
		text: "ซับ",
		alpha: 0.5,
		color: "#fbbf24",
	});
});

test("active caption word paints above its siblings", () => {
	const words = [0, 1, 2].map(
		(index): LaidOutWord => ({
			index,
			x: index * 10,
			width: 10,
			timing: { text: String(index), start: index, end: index + 1 },
		}),
	);

	expect(orderCaptionWordsForPaint(words, 1).map((word) => word.index)).toEqual([
		0, 2, 1,
	]);
});
