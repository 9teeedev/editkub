import { describe, expect, test } from "bun:test";
import { transformProjectV5ToV6 } from "../transformers/v5-to-v6";
import { projectWithNoId, v5Project, v6Project } from "./fixtures";

describe("V5 to V6 Migration", () => {
	describe("transformProjectV5ToV6", () => {
		test("bumps version to 6", () => {
			const result = transformProjectV5ToV6({ project: v5Project });

			expect(result.skipped).toBe(false);
			expect(result.project.version).toBe(6);
		});

		test("skips project that is already v6", () => {
			const result = transformProjectV5ToV6({ project: v6Project });

			expect(result.skipped).toBe(true);
			expect(result.reason).toBe("already v6");
		});

		test("skips project with no id", () => {
			const result = transformProjectV5ToV6({ project: projectWithNoId });

			expect(result.skipped).toBe(true);
			expect(result.reason).toBe("no project id");
		});

		test("routes a legacy entrance (fade-in) into the in phase", () => {
			const result = transformProjectV5ToV6({ project: v5Project });
			const scene = (result.project.scenes as unknown[])[0] as Record<
				string,
				unknown
			>;
			const track = (scene.tracks as unknown[])[0] as Record<
				string,
				unknown
			>;
			const element = (track.elements as unknown[])[0] as Record<
				string,
				unknown
			>;

			expect(element.textAnimations).toEqual({
				in: { type: "fade-in", duration: 0.5, intensity: 1 },
			});
			// Legacy field must be removed.
			expect(element.textAnimation).toBeUndefined();
		});

		test("routes a legacy exit (fade-out) into the out phase", () => {
			const project = {
				...v5Project,
				scenes: [
					{
						...v5Project.scenes[0],
						tracks: [
							{
								...v5Project.scenes[0].tracks[0],
								elements: [
									{
										...v5Project.scenes[0].tracks[0]
											.elements[0],
										textAnimation: {
											type: "fade-out",
											duration: 0.5,
										},
									},
								],
							},
						],
					},
				],
			};

			const result = transformProjectV5ToV6({ project });
			const scene = (result.project.scenes as unknown[])[0] as Record<
				string,
				unknown
			>;
			const track = (scene.tracks as unknown[])[0] as Record<
				string,
				unknown
			>;
			const element = (track.elements as unknown[])[0] as Record<
				string,
				unknown
			>;

			expect(element.textAnimations).toEqual({
				out: { type: "fade-out", duration: 0.5 },
			});
		});

		test("preserves metadata and settings", () => {
			const result = transformProjectV5ToV6({ project: v5Project });

			expect(result.project.metadata).toEqual(v5Project.metadata);
			expect(result.project.settings).toEqual(v5Project.settings);
		});
	});
});
