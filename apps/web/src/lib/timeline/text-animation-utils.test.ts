import { describe, expect, test } from "bun:test";
import {
	resolveTextAnimation,
	resolveTextAnimations,
	phaseForType,
	TEXT_ANIMATION_TYPES,
	DEFAULT_DURATION,
} from "./text-animation-utils";
import type { TextAnimations } from "@/types/timeline";
import type { TextAnimation } from "@/types/timeline";

const FULL = "Hello World";

function anim(
	overrides: Partial<TextAnimation> & { type: TextAnimation["type"] },
): TextAnimation | undefined {
	if (overrides.type === "none") return undefined;
	return {
		duration: 1,
		intensity: 1,
		...overrides,
	};
}

describe("resolveTextAnimation", () => {
	describe("none / undefined", () => {
		test("undefined animation returns full text, static", () => {
			const r = resolveTextAnimation({
				animation: undefined,
				localTime: 0,
				fullText: FULL,
			});
			expect(r.visibleText).toBe(FULL);
			expect(r.opacity).toBe(1);
			expect(r.offsetX).toBe(0);
			expect(r.offsetY).toBe(0);
			expect(r.scale).toBe(1);
		});

		test("type none returns full text static", () => {
			const r = resolveTextAnimation({
				animation: { type: "none", duration: 1 },
				localTime: 0.5,
				fullText: FULL,
			});
			expect(r.visibleText).toBe(FULL);
			expect(r.opacity).toBe(1);
		});

		test("respects baseScale for offsets (none case)", () => {
			const r = resolveTextAnimation({
				animation: undefined,
				localTime: 0,
				fullText: FULL,
				baseScale: 2,
			});
			expect(r.offsetX).toBe(0);
			expect(r.scale).toBe(1);
		});
	});

	describe("typewriter", () => {
		test("at time 0 shows empty string", () => {
			const r = resolveTextAnimation({
				animation: { type: "typewriter", duration: 1 },
				localTime: 0,
				fullText: FULL,
			});
			expect(r.visibleText).toBe("");
		});

		test("at half progress shows roughly half the characters", () => {
			const r = resolveTextAnimation({
				animation: { type: "typewriter", duration: 1 },
				localTime: 0.5,
				fullText: FULL,
			});
			// "Hello World" has 11 chars; half = 5 or 6
			expect(r.visibleText.length).toBeLessThanOrEqual(6);
			expect(r.visibleText.length).toBeGreaterThanOrEqual(5);
		});

		test("after duration shows full text", () => {
			const r = resolveTextAnimation({
				animation: { type: "typewriter", duration: 1 },
				localTime: 1.5,
				fullText: FULL,
			});
			expect(r.visibleText).toBe(FULL);
		});

		test("handles multibyte characters", () => {
			const text = "你好世界";
			const r = resolveTextAnimation({
				animation: { type: "typewriter", duration: 1 },
				localTime: 0.5,
				fullText: text,
			});
			// Result must be a prefix (code-point-wise) of the original.
			const chars = Array.from(text);
			const visibleChars = Array.from(r.visibleText);
			expect(chars.slice(0, visibleChars.length)).toEqual(visibleChars);
		});
	});

	describe("fade-in", () => {
		test("at time 0 opacity is 0", () => {
			const r = resolveTextAnimation({
				animation: { type: "fade-in", duration: 1 },
				localTime: 0,
				fullText: FULL,
			});
			expect(r.opacity).toBeCloseTo(0, 1);
		});

		test("at full duration opacity is 1", () => {
			const r = resolveTextAnimation({
				animation: { type: "fade-in", duration: 1 },
				localTime: 1,
				fullText: FULL,
			});
			expect(r.opacity).toBeCloseTo(1, 5);
		});

		test("monotonically increases", () => {
			const r1 = resolveTextAnimation({
				animation: { type: "fade-in", duration: 1 },
				localTime: 0.25,
				fullText: FULL,
			});
			const r2 = resolveTextAnimation({
				animation: { type: "fade-in", duration: 1 },
				localTime: 0.75,
				fullText: FULL,
			});
			expect(r2.opacity).toBeGreaterThan(r1.opacity);
		});

		test("past duration stays at 1", () => {
			const r = resolveTextAnimation({
				animation: { type: "fade-in", duration: 1 },
				localTime: 5,
				fullText: FULL,
			});
			expect(r.opacity).toBe(1);
		});
	});

	describe("fade-out", () => {
		test("at time 0 opacity is 1", () => {
			const r = resolveTextAnimation({
				animation: { type: "fade-out", duration: 1 },
				localTime: 0,
				fullText: FULL,
			});
			expect(r.opacity).toBeCloseTo(1, 1);
		});

		test("at full duration opacity is 0", () => {
			const r = resolveTextAnimation({
				animation: { type: "fade-out", duration: 1 },
				localTime: 1,
				fullText: FULL,
			});
			expect(r.opacity).toBeCloseTo(0, 5);
		});

		test("monotonically decreases", () => {
			const r1 = resolveTextAnimation({
				animation: { type: "fade-out", duration: 1 },
				localTime: 0.25,
				fullText: FULL,
			});
			const r2 = resolveTextAnimation({
				animation: { type: "fade-out", duration: 1 },
				localTime: 0.75,
				fullText: FULL,
			});
			expect(r2.opacity).toBeLessThan(r1.opacity);
		});
	});

	describe("slide-in", () => {
		test("at time 0 offset is negative (from left)", () => {
			const r = resolveTextAnimation({
				animation: { type: "slide-in", duration: 1 },
				localTime: 0,
				fullText: FULL,
			});
			expect(r.offsetX).toBeLessThan(0);
			expect(r.opacity).toBeCloseTo(0, 1);
		});

		test("at full duration offset is 0 and opacity 1", () => {
			const r = resolveTextAnimation({
				animation: { type: "slide-in", duration: 1 },
				localTime: 1,
				fullText: FULL,
			});
			expect(r.offsetX).toBeCloseTo(0, 5);
			expect(r.opacity).toBeCloseTo(1, 5);
		});

		test("intensity scales distance", () => {
			const low = resolveTextAnimation({
				animation: { type: "slide-in", duration: 1, intensity: 0.5 },
				localTime: 0,
				fullText: FULL,
			});
			const high = resolveTextAnimation({
				animation: { type: "slide-in", duration: 1, intensity: 1 },
				localTime: 0,
				fullText: FULL,
			});
			expect(Math.abs(high.offsetX)).toBeGreaterThan(
				Math.abs(low.offsetX),
			);
		});
	});

	describe("slide-out", () => {
		test("at time 0 offset is 0 and opacity 1", () => {
			const r = resolveTextAnimation({
				animation: { type: "slide-out", duration: 1 },
				localTime: 0,
				fullText: FULL,
			});
			expect(r.offsetX).toBeCloseTo(0, 5);
			expect(r.opacity).toBeCloseTo(1, 1);
		});

		test("at full duration offset is positive (to right) and opacity 0", () => {
			const r = resolveTextAnimation({
				animation: { type: "slide-out", duration: 1 },
				localTime: 1,
				fullText: FULL,
			});
			expect(r.offsetX).toBeGreaterThan(0);
			expect(r.opacity).toBeCloseTo(0, 5);
		});
	});

	describe("scale-in", () => {
		test("at time 0 scale is small", () => {
			const r = resolveTextAnimation({
				animation: { type: "scale-in", duration: 1 },
				localTime: 0,
				fullText: FULL,
			});
			expect(r.scale).toBeLessThan(0.5);
			expect(r.opacity).toBeCloseTo(0, 1);
		});

		test("at full duration scale is 1", () => {
			const r = resolveTextAnimation({
				animation: { type: "scale-in", duration: 1 },
				localTime: 1,
				fullText: FULL,
			});
			expect(r.scale).toBeCloseTo(1, 5);
			expect(r.opacity).toBeCloseTo(1, 5);
		});

		test("monotonically increases", () => {
			const r1 = resolveTextAnimation({
				animation: { type: "scale-in", duration: 1 },
				localTime: 0.3,
				fullText: FULL,
			});
			const r2 = resolveTextAnimation({
				animation: { type: "scale-in", duration: 1 },
				localTime: 0.7,
				fullText: FULL,
			});
			expect(r2.scale).toBeGreaterThan(r1.scale);
		});
	});

	describe("bounce", () => {
		test("offsetY is non-positive (bounces up)", () => {
			const r = resolveTextAnimation({
				animation: { type: "bounce", duration: 1 },
				localTime: 0.25,
				fullText: FULL,
			});
			expect(r.offsetY).toBeLessThanOrEqual(0);
		});

		test("returns to baseline at bounce boundaries", () => {
			// At integer multiples of the period (0.5s), the arc is 0.
			const r = resolveTextAnimation({
				animation: { type: "bounce", duration: 0 },
				localTime: 0.5,
				fullText: FULL,
			});
			expect(r.offsetY).toBeCloseTo(0, 5);
		});

		test("loops forever when duration is 0", () => {
			const r1 = resolveTextAnimation({
				animation: { type: "bounce", duration: 0 },
				localTime: 0.25,
				fullText: FULL,
			});
			const r2 = resolveTextAnimation({
				animation: { type: "bounce", duration: 0 },
				localTime: 0.75,
				fullText: FULL,
			});
			// Same phase point in next loop → same amplitude.
			expect(r2.offsetY).toBeCloseTo(r1.offsetY, 5);
		});

		test("decays with finite duration", () => {
			const early = resolveTextAnimation({
				animation: { type: "bounce", duration: 1 },
				localTime: 0.25,
				fullText: FULL,
			});
			const late = resolveTextAnimation({
				animation: { type: "bounce", duration: 1 },
				localTime: 0.75,
				fullText: FULL,
			});
			// Same phase, but late has decayed amplitude.
			expect(Math.abs(late.offsetY)).toBeLessThanOrEqual(
				Math.abs(early.offsetY),
			);
		});
	});

	describe("glitch", () => {
		test("produces non-zero offsets", () => {
			const r = resolveTextAnimation({
				animation: { type: "glitch", duration: 0, intensity: 1 },
				localTime: 0.1,
				fullText: FULL,
			});
			// At least one offset should be non-zero over a few time samples.
			let anyNonZero = false;
			for (let t = 0; t < 1; t += 0.05) {
				const sample = resolveTextAnimation({
					animation: { type: "glitch", duration: 0, intensity: 1 },
					localTime: t,
					fullText: FULL,
				});
				if (sample.offsetX !== 0 || sample.offsetY !== 0) {
					anyNonZero = true;
					break;
				}
			}
			expect(anyNonZero || r.offsetX !== 0 || r.offsetY !== 0).toBe(true);
		});

		test("is deterministic for the same time", () => {
			const a = resolveTextAnimation({
				animation: { type: "glitch", duration: 0 },
				localTime: 0.37,
				fullText: FULL,
			});
			const b = resolveTextAnimation({
				animation: { type: "glitch", duration: 0 },
				localTime: 0.37,
				fullText: FULL,
			});
			expect(a).toEqual(b);
		});

		test("intensity 0 produces no jitter", () => {
			const r = resolveTextAnimation({
				animation: { type: "glitch", duration: 0, intensity: 0 },
				localTime: 0.3,
				fullText: FULL,
			});
			expect(r.offsetX).toBe(0);
			expect(r.offsetY).toBe(0);
		});
	});

	describe("karaoke", () => {
		test("returns full text (highlighting handled by TextNode)", () => {
			const r = resolveTextAnimation({
				animation: { type: "karaoke", duration: 0 },
				localTime: 0.5,
				fullText: FULL,
			});
			expect(r.visibleText).toBe(FULL);
			expect(r.opacity).toBe(1);
		});
	});

	describe("duration handling", () => {
		test("duration 0 means infinite (no progress clamping)", () => {
			const r = resolveTextAnimation({
				animation: { type: "fade-in", duration: 0 },
				localTime: 0.5,
				fullText: FULL,
			});
			// Infinite duration → progress is 0 → fade-in stays at opacity 0.
			expect(r.opacity).toBeCloseTo(0, 1);
		});

		test("negative duration treated as infinite", () => {
			const r = resolveTextAnimation({
				animation: { type: "fade-in", duration: -1 },
				localTime: 100,
				fullText: FULL,
			});
			expect(r.opacity).toBeCloseTo(0, 1);
		});
	});

	describe("intensity clamping", () => {
		test("intensity above 1 is clamped", () => {
			const over = resolveTextAnimation({
				animation: { type: "slide-in", duration: 1, intensity: 5 },
				localTime: 0,
				fullText: FULL,
			});
			const normal = resolveTextAnimation({
				animation: { type: "slide-in", duration: 1, intensity: 1 },
				localTime: 0,
				fullText: FULL,
			});
			expect(over.offsetX).toBeCloseTo(normal.offsetX, 5);
		});
	});

	describe("metadata exports", () => {
		test("TEXT_ANIMATION_TYPES includes all types", () => {
			expect(TEXT_ANIMATION_TYPES).toContain("none");
			expect(TEXT_ANIMATION_TYPES).toContain("typewriter");
			expect(TEXT_ANIMATION_TYPES).toContain("glitch");
			expect(TEXT_ANIMATION_TYPES.length).toBeGreaterThanOrEqual(9);
		});

		test("DEFAULT_DURATION has sensible values", () => {
			expect(DEFAULT_DURATION["fade-in"]).toBeGreaterThan(0);
			expect(DEFAULT_DURATION["fade-in"]).toBeLessThan(2);
			expect(DEFAULT_DURATION.bounce).toBe(0);
		});
	});
});

describe("resolveTextAnimation integration", () => {
	test("combines with baseScale for offset magnitudes", () => {
		const r1 = resolveTextAnimation({
			animation: { type: "slide-in", duration: 1 },
			localTime: 0,
			fullText: FULL,
			baseScale: 1,
		});
		const r2 = resolveTextAnimation({
			animation: { type: "slide-in", duration: 1 },
			localTime: 0,
			fullText: FULL,
			baseScale: 2,
		});
		expect(Math.abs(r2.offsetX)).toBeGreaterThan(Math.abs(r1.offsetX));
	});

	test("every exported type resolves without throwing", () => {
		for (const type of TEXT_ANIMATION_TYPES) {
			expect(() =>
				resolveTextAnimation({
					animation: anim({ type }),
					localTime: 0.3,
					fullText: FULL,
				}),
			).not.toThrow();
		}
	});
});

describe("phaseForType", () => {
	test("exit types route to out", () => {
		expect(phaseForType("fade-out")).toBe("out");
		expect(phaseForType("slide-out")).toBe("out");
	});

	test("entrance/loop/highlight types route to in", () => {
		expect(phaseForType("typewriter")).toBe("in");
		expect(phaseForType("fade-in")).toBe("in");
		expect(phaseForType("slide-in")).toBe("in");
		expect(phaseForType("scale-in")).toBe("in");
		expect(phaseForType("bounce")).toBe("in");
		expect(phaseForType("glitch")).toBe("in");
		expect(phaseForType("none")).toBe("in");
	});
});

describe("resolveTextAnimations (in + out composer)", () => {
	const ELEMENT_DURATION = 5;

	test("undefined animations returns full text static", () => {
		const r = resolveTextAnimations({
			animations: undefined,
			localTime: 1,
			elementDuration: ELEMENT_DURATION,
			fullText: FULL,
		});
		expect(r.visibleText).toBe(FULL);
		expect(r.opacity).toBe(1);
		expect(r.scale).toBe(1);
		expect(r.offsetX).toBe(0);
		expect(r.offsetY).toBe(0);
	});

	test("both phases absent (empty object) returns full text static", () => {
		const r = resolveTextAnimations({
			animations: {} as TextAnimations,
			localTime: 1,
			elementDuration: ELEMENT_DURATION,
			fullText: FULL,
		});
		expect(r.visibleText).toBe(FULL);
		expect(r.opacity).toBe(1);
	});

	test("in-phase plays from element start", () => {
		// fade-in at time 0 → opacity 0; past duration → opacity 1.
		const atStart = resolveTextAnimations({
			animations: { in: { type: "fade-in", duration: 1 } },
			localTime: 0,
			elementDuration: ELEMENT_DURATION,
			fullText: FULL,
		});
		expect(atStart.opacity).toBe(0);

		const afterIn = resolveTextAnimations({
			animations: { in: { type: "fade-in", duration: 1 } },
			localTime: 2,
			elementDuration: ELEMENT_DURATION,
			fullText: FULL,
		});
		expect(afterIn.opacity).toBe(1);
	});

	test("out-phase plays over the element's final seconds", () => {
		// fade-out duration 1 over a 5s element → window [4, 5].
		const beforeOut = resolveTextAnimations({
			animations: { out: { type: "fade-out", duration: 1 } },
			localTime: 2,
			elementDuration: ELEMENT_DURATION,
			fullText: FULL,
		});
		// Not yet in the out window → opacity 1.
		expect(beforeOut.opacity).toBe(1);

		const atOutStart = resolveTextAnimations({
			animations: { out: { type: "fade-out", duration: 1 } },
			localTime: 4,
			elementDuration: ELEMENT_DURATION,
			fullText: FULL,
		});
		// Start of out window → opacity 1 (fade-out just beginning).
		expect(atOutStart.opacity).toBe(1);

		const midOut = resolveTextAnimations({
			animations: { out: { type: "fade-out", duration: 1 } },
			localTime: 4.5,
			elementDuration: ELEMENT_DURATION,
			fullText: FULL,
		});
		// Mid fade-out → opacity between 0 and 1, strictly less than 1.
		expect(midOut.opacity).toBeGreaterThan(0);
		expect(midOut.opacity).toBeLessThan(1);

		const atOutEnd = resolveTextAnimations({
			animations: { out: { type: "fade-out", duration: 1 } },
			localTime: 5,
			elementDuration: ELEMENT_DURATION,
			fullText: FULL,
		});
		// End of out window → opacity 0 (fully faded).
		expect(atOutEnd.opacity).toBe(0);
	});

	test("in and out compose: opacity multiplies", () => {
		// fade-in (duration 1) at time 0 → opacity 0; multiply by anything → 0.
		const r = resolveTextAnimations({
			animations: {
				in: { type: "fade-in", duration: 1 },
				out: { type: "fade-out", duration: 1 },
			},
			localTime: 0,
			elementDuration: ELEMENT_DURATION,
			fullText: FULL,
		});
		expect(r.opacity).toBe(0);
	});

	test("out longer than element still works (outStart clamped to 0)", () => {
		// out duration 10 on a 5s element → out window starts at max(0, 5-10)=0.
		const atStart = resolveTextAnimations({
			animations: { out: { type: "fade-out", duration: 10 } },
			localTime: 0,
			elementDuration: ELEMENT_DURATION,
			fullText: FULL,
		});
		// localTime 0 in a fade-out → opacity 1 (start of fade).
		expect(atStart.opacity).toBe(1);
	});
});
