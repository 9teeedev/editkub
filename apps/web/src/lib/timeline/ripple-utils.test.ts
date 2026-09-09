import { describe, it, expect } from "bun:test";
import { getRippleShift, applyRippleShift } from "./ripple-utils";
import type { TimelineElement } from "@/types/timeline";

function element({
	id,
	startTime,
	duration = 2,
}: {
	id: string;
	startTime: number;
	duration?: number;
}): TimelineElement {
	return {
		id,
		type: "video",
		startTime,
		duration,
		trimStart: 0,
		trimEnd: 0,
		name: id,
		width: 0,
		height: 0,
		x: 0,
		y: 0,
		transform: {},
	} as unknown as TimelineElement;
}

describe("getRippleShift", () => {
	it("closes the gap after a trim", () => {
		const result = getRippleShift({
			elements: [
				element({ id: "a", startTime: 0, duration: 3 }),
				element({ id: "b", startTime: 8 }),
			],
			anchorStartTime: 0,
			targetTime: 3,
		});
		expect(result).toEqual({ shift: 5, elementIds: ["b"] });
	});

	it("shifts right when the trimmed element grows past the next clip", () => {
		const result = getRippleShift({
			elements: [
				element({ id: "a", startTime: 0, duration: 6 }),
				element({ id: "b", startTime: 5 }),
			],
			anchorStartTime: 0,
			targetTime: 6,
		});
		expect(result).toEqual({ shift: -1, elementIds: ["b"] });
	});

	it("keeps spacing between all subsequent clips", () => {
		const result = getRippleShift({
			elements: [
				element({ id: "a", startTime: 0, duration: 2 }),
				element({ id: "b", startTime: 6 }),
				element({ id: "c", startTime: 10 }),
			],
			anchorStartTime: 0,
			targetTime: 2,
		});
		expect(result).toEqual({ shift: 4, elementIds: ["b", "c"] });
	});

	it("ignores clips that start before the anchor", () => {
		const result = getRippleShift({
			elements: [
				element({ id: "a", startTime: 0, duration: 2 }),
				element({ id: "b", startTime: 5 }),
			],
			anchorStartTime: 2,
			targetTime: 3,
		});
		expect(result).toEqual({ shift: 2, elementIds: ["b"] });
	});

	it("returns null when nothing follows the edit point", () => {
		const result = getRippleShift({
			elements: [element({ id: "a", startTime: 0, duration: 2 })],
			anchorStartTime: 0,
			targetTime: 1,
		});
		expect(result).toBeNull();
	});

	it("returns null when no shift is needed", () => {
		const result = getRippleShift({
			elements: [
				element({ id: "a", startTime: 0, duration: 4 }),
				element({ id: "b", startTime: 4 }),
			],
			anchorStartTime: 0,
			targetTime: 4,
		});
		expect(result).toBeNull();
	});
});

describe("applyRippleShift", () => {
	it("shifts only the listed elements and preserves spacing", () => {
		const shifted = applyRippleShift({
			elements: [
				element({ id: "a", startTime: 0, duration: 2 }),
				element({ id: "b", startTime: 6 }),
				element({ id: "c", startTime: 9 }),
			],
			shift: { shift: 4, elementIds: ["b", "c"] },
		});
		expect(shifted[0].startTime).toBe(0);
		expect(shifted[1].startTime).toBe(2);
		expect(shifted[2].startTime).toBe(5);
	});

	it("does not produce negative start times", () => {
		const shifted = applyRippleShift({
			elements: [element({ id: "b", startTime: 1 })],
			shift: { shift: 10, elementIds: ["b"] },
		});
		expect(shifted[0].startTime).toBe(0);
	});
});
