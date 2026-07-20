import { describe, expect, test } from "bun:test";
import type {
	ElementKeyframes,
	Keyframe,
	Transform,
} from "@/types/timeline";
import {
	applyEasing,
	countKeyframes,
	disableChannel,
	enableChannel,
	generateKeyframeId,
	getKeyframeAtTime,
	hasAnyKeyframes,
	hasChannel,
	removeKeyframeById,
	resolveAnimatedProperties,
	sampleChannel,
	setChannel,
	upsertKeyframe,
} from "./keyframe-utils";

const BASE_TRANSFORM: Transform = {
	scale: 1,
	position: { x: 0, y: 0 },
	rotate: 0,
};

function kf(
	time: number,
	value: number,
	easing: Keyframe["easing"] = "linear",
): Keyframe {
	return { id: `kf-${time}`, time, value, easing };
}

describe("keyframe-utils", () => {
	describe("sampleChannel", () => {
		test("returns hasKeyframe=false for empty/undefined array", () => {
			expect(sampleChannel(undefined, 5)).toEqual({
				value: 0,
				hasKeyframe: false,
			});
			expect(sampleChannel([], 5)).toEqual({
				value: 0,
				hasKeyframe: false,
			});
		});

		test("holds single keyframe value", () => {
			const result = sampleChannel([kf(2, 42)], 10);
			expect(result.hasKeyframe).toBe(true);
			expect(result.value).toBe(42);
		});

		test("holds first value before the first keyframe", () => {
			const result = sampleChannel([kf(5, 10), kf(10, 20)], 2);
			expect(result.value).toBe(10);
		});

		test("holds last value after the last keyframe", () => {
			const result = sampleChannel([kf(5, 10), kf(10, 20)], 15);
			expect(result.value).toBe(20);
		});

		test("linear interpolation between two keyframes", () => {
			const result = sampleChannel([kf(0, 0), kf(10, 100)], 5);
			expect(result.value).toBeCloseTo(50, 5);
		});

		test("linear interpolation at exact keyframe time", () => {
			expect(sampleChannel([kf(0, 0), kf(10, 100)], 0).value).toBe(0);
			expect(sampleChannel([kf(0, 0), kf(10, 100)], 10).value).toBe(100);
		});

		test("interpolates across multiple keyframes", () => {
			const kfs = [kf(0, 0), kf(5, 50), kf(10, 100)];
			expect(sampleChannel(kfs, 2.5).value).toBeCloseTo(25, 5);
			expect(sampleChannel(kfs, 7.5).value).toBeCloseTo(75, 5);
		});

		test("works with unsorted input (sorts internally)", () => {
			const kfs = [kf(10, 100), kf(0, 0)];
			const result = sampleChannel(kfs, 5);
			expect(result.value).toBeCloseTo(50, 5);
		});
	});

	describe("applyEasing", () => {
		test("linear returns progress unchanged", () => {
			expect(applyEasing(0.5, kf(0, 0, "linear"))).toBeCloseTo(0.5, 5);
			expect(applyEasing(0.25, kf(0, 0, "linear"))).toBeCloseTo(0.25, 5);
		});

		test("endpoints map to 0 and 1 for all easings", () => {
			const easings = [
				"linear",
				"ease-in",
				"ease-out",
				"ease-in-out",
			] as const;
			for (const easing of easings) {
				expect(applyEasing(0, kf(0, 0, easing))).toBeCloseTo(0, 5);
				expect(applyEasing(1, kf(0, 0, easing))).toBeCloseTo(1, 5);
			}
		});

		test("ease-in-out produces symmetric midpoint ~0.5", () => {
			const eased = applyEasing(0.5, kf(0, 0, "ease-in-out"));
			expect(eased).toBeCloseTo(0.5, 1);
		});

		test("custom bezier passes through control points sensibly", () => {
			const custom = {
				...kf(0, 0, "bezier"),
				bezierP1: { x: 0, y: 1 }, // y immediately up
				bezierP2: { x: 1, y: 0 }, // y back down
			};
			// Endpoints are still 0 and 1.
			expect(applyEasing(0, custom)).toBeCloseTo(0, 5);
			expect(applyEasing(1, custom)).toBeCloseTo(1, 5);
		});
	});

	describe("resolveAnimatedProperties", () => {
		test("returns base values when keyframes undefined", () => {
			const result = resolveAnimatedProperties({
				keyframes: undefined,
				time: 5,
				baseTransform: BASE_TRANSFORM,
				baseOpacity: 0.8,
			});
			expect(result.transform.scale).toBe(1);
			expect(result.opacity).toBe(0.8);
		});

		test("returns base values when keyframes object is empty", () => {
			const result = resolveAnimatedProperties({
				keyframes: {},
				time: 5,
				baseTransform: BASE_TRANSFORM,
				baseOpacity: 1,
			});
			expect(result.transform.scale).toBe(1);
			expect(result.opacity).toBe(1);
		});

		test("samples animated channels and falls back for others", () => {
			const keyframes: ElementKeyframes = {
				scale: [kf(0, 1), kf(10, 2)],
				opacity: [kf(0, 1), kf(10, 0)],
			};
			const result = resolveAnimatedProperties({
				keyframes,
				time: 5,
				baseTransform: { ...BASE_TRANSFORM, rotate: 30 },
				baseOpacity: 1,
			});
			expect(result.transform.scale).toBeCloseTo(1.5, 5);
			expect(result.opacity).toBeCloseTo(0.5, 5);
			// rotate has no keyframes → base value preserved.
			expect(result.transform.rotate).toBe(30);
		});

		test("preserves flipX/flipY from base transform", () => {
			const base: Transform = {
				...BASE_TRANSFORM,
				flipX: true,
				flipY: false,
			};
			const result = resolveAnimatedProperties({
				keyframes: { scale: [kf(0, 1), kf(10, 2)] },
				time: 5,
				baseTransform: base,
				baseOpacity: 1,
			});
			expect(result.transform.flipX).toBe(true);
			expect(result.transform.flipY).toBe(false);
		});

		test("animates position.x and position.y independently", () => {
			const keyframes: ElementKeyframes = {
				"position.x": [kf(0, 0), kf(10, 100)],
				"position.y": [kf(0, 0), kf(10, -50)],
			};
			const result = resolveAnimatedProperties({
				keyframes,
				time: 5,
				baseTransform: BASE_TRANSFORM,
				baseOpacity: 1,
			});
			expect(result.transform.position.x).toBeCloseTo(50, 5);
			expect(result.transform.position.y).toBeCloseTo(-25, 5);
		});
	});

	describe("channel helpers", () => {
		test("hasChannel detects animated channels", () => {
			const keyframes: ElementKeyframes = {
				scale: [kf(0, 1), kf(10, 2)],
			};
			expect(hasChannel(keyframes, "scale")).toBe(true);
			expect(hasChannel(keyframes, "rotate")).toBe(false);
			expect(hasChannel(undefined, "scale")).toBe(false);
		});

		test("enableChannel creates start+end keyframes", () => {
			const result = enableChannel(undefined, "scale", 1.5, 10);
			expect(hasChannel(result, "scale")).toBe(true);
			expect(result.scale).toHaveLength(2);
			expect(result.scale?.[0].time).toBe(0);
			expect(result.scale?.[0].value).toBe(1.5);
			expect(result.scale?.[1].time).toBe(10);
			expect(result.scale?.[1].value).toBe(1.5);
		});

		test("enableChannel is idempotent when channel already enabled", () => {
			const existing: ElementKeyframes = {
				scale: [kf(0, 1), kf(10, 2)],
			};
			const result = enableChannel(existing, "scale", 99, 10);
			expect(result).toBe(existing);
		});

		test("disableChannel removes the channel", () => {
			const existing: ElementKeyframes = {
				scale: [kf(0, 1)],
				rotate: [kf(0, 0)],
			};
			const result = disableChannel(existing, "scale");
			expect(hasChannel(result, "scale")).toBe(false);
			expect(hasChannel(result, "rotate")).toBe(true);
		});

		test("countKeyframes sums across channels", () => {
			const keyframes: ElementKeyframes = {
				scale: [kf(0, 1), kf(10, 2)],
				opacity: [kf(0, 1)],
			};
			expect(countKeyframes(keyframes)).toBe(3);
			expect(countKeyframes(undefined)).toBe(0);
		});

		test("hasAnyKeyframes", () => {
			expect(hasAnyKeyframes(undefined)).toBe(false);
			expect(hasAnyKeyframes({})).toBe(false);
			expect(hasAnyKeyframes({ scale: [kf(0, 1)] })).toBe(true);
		});
	});

	describe("keyframe mutation helpers", () => {
		test("upsertKeyframe inserts and sorts", () => {
			const result = upsertKeyframe([kf(0, 0), kf(10, 100)], kf(5, 50));
			expect(result).toHaveLength(3);
			expect(result.map((k) => k.time)).toEqual([0, 5, 10]);
		});

		test("upsertKeyframe replaces at same time", () => {
			const result = upsertKeyframe(
				[kf(0, 0), kf(5, 50), kf(10, 100)],
				{ ...kf(5, 75), easing: "ease-in" },
			);
			expect(result).toHaveLength(3);
			expect(result[1].value).toBe(75);
			expect(result[1].easing).toBe("ease-in");
		});

		test("upsertKeyframe works on undefined channel", () => {
			const result = upsertKeyframe(undefined, kf(2, 42));
			expect(result).toHaveLength(1);
			expect(result[0].value).toBe(42);
		});

		test("removeKeyframeById removes by id", () => {
			const result = removeKeyframeById(
				[{ id: "a", time: 0, value: 0, easing: "linear" }, kf(5, 50)],
				"a",
			);
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("kf-5");
		});

		test("getKeyframeAtTime finds a keyframe within epsilon", () => {
			const kfs = [kf(5, 50)];
			expect(getKeyframeAtTime(kfs, 5)).toBeDefined();
			expect(getKeyframeAtTime(kfs, 5.0001)).toBeDefined();
			expect(getKeyframeAtTime(kfs, 6)).toBeUndefined();
		});

		test("setChannel removes channel when array empty", () => {
			const existing: ElementKeyframes = { scale: [kf(0, 1)] };
			const result = setChannel(existing, "scale", []);
			expect(result.scale).toBeUndefined();
		});

		test("generateKeyframeId produces unique-ish ids", () => {
			const a = generateKeyframeId();
			const b = generateKeyframeId();
			expect(a).not.toBe(b);
			expect(a.startsWith("kf-")).toBe(true);
		});
	});
});
