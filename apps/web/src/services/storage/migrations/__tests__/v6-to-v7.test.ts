import { describe, expect, test } from "bun:test";
import { transformProjectV6ToV7 } from "../transformers/v6-to-v7";
import { projectWithNoId, v6Project, v7Project } from "./fixtures";

describe("V6 to V7 Migration", () => {
	describe("transformProjectV6ToV7", () => {
		test("bumps version to 7", () => {
			const result = transformProjectV6ToV7({ project: v6Project });

			expect(result.skipped).toBe(false);
			expect(result.project.version).toBe(7);
		});

		test("preserves existing metadata fields", () => {
			const result = transformProjectV6ToV7({ project: v6Project });

			const metadata = result.project.metadata as Record<string, unknown>;
			expect(metadata.id).toBe(v6Project.metadata.id);
			expect(metadata.name).toBe(v6Project.metadata.name);
		});

		test("preserves settings object", () => {
			const result = transformProjectV6ToV7({ project: v6Project });

			expect(result.project.settings).toEqual(v6Project.settings);
		});

		test("preserves scenes array", () => {
			const result = transformProjectV6ToV7({ project: v6Project });

			expect(result.project.scenes).toEqual(v6Project.scenes);
		});

		test("skips project that is already v7", () => {
			const result = transformProjectV6ToV7({ project: v7Project });

			expect(result.skipped).toBe(true);
			expect(result.reason).toBe("already v7");
		});

		test("skips project with no id", () => {
			const result = transformProjectV6ToV7({ project: projectWithNoId });

			expect(result.skipped).toBe(true);
			expect(result.reason).toBe("no project id");
		});
	});
});
