import { expect, test } from "bun:test";
import { ADJUSTMENT_DEFAULTS } from "@/constants/adjustment-constants";
import { computeFilterString } from "./filter-string";

test("adjustment layers emit neutral-safe canvas filters", () => {
	expect(computeFilterString(undefined, ADJUSTMENT_DEFAULTS)).toBe("none");
	expect(
		computeFilterString(undefined, {
			...ADJUSTMENT_DEFAULTS,
			brightness: 1.2,
			hue: 10,
			vignette: 100,
		}),
	).toBe("brightness(1.2) contrast(1) saturate(1) hue-rotate(10deg)");
});
