import { describe, expect, test } from "bun:test";
import { transformProjectV4ToV5 } from "../transformers/v4-to-v5";
import { getProjectId } from "../transformers/utils";
import { projectWithNoId, v4Project, v5Project } from "./fixtures";

describe("V4 to V5 Migration", () => {
	describe("transformProjectV4ToV5", () => {
		test("bumps version to 5", () => {
			const result = transformProjectV4ToV5({ project: v4Project });

			expect(result.skipped).toBe(false);
			expect(result.project.version).toBe(5);
		});

		test("preserves existing metadata fields", () => {
			const result = transformProjectV4ToV5({ project: v4Project });

			const metadata = result.project.metadata as Record<string, unknown>;
			expect(metadata.id).toBe(v4Project.metadata.id);
			expect(metadata.name).toBe(v4Project.metadata.name);
			expect(metadata.thumbnail).toBe(v4Project.metadata.thumbnail);
			expect(metadata.duration).toBe(v4Project.metadata.duration);
			expect(metadata.createdAt).toBe(v4Project.metadata.createdAt);
			expect(metadata.updatedAt).toBe(v4Project.metadata.updatedAt);
		});

		test("preserves settings object", () => {
			const result = transformProjectV4ToV5({ project: v4Project });

			expect(result.project.settings).toEqual(v4Project.settings);
		});

		test("preserves scenes array", () => {
			const result = transformProjectV4ToV5({ project: v4Project });

			expect(result.project.scenes).toEqual(v4Project.scenes);
		});

		test("skips project that is already v5", () => {
			const result = transformProjectV4ToV5({ project: v5Project });

			expect(result.skipped).toBe(true);
			expect(result.reason).toBe("already v5");
		});

		test("skips project with no id", () => {
			const result = transformProjectV4ToV5({ project: projectWithNoId });

			expect(result.skipped).toBe(true);
			expect(result.reason).toBe("no project id");
		});
	});

	describe("getProjectId", () => {
		test("returns id from root level", () => {
			const projectWithRootId = { id: "root-id", metadata: {} };
			const id = getProjectId({ project: projectWithRootId });
			expect(id).toBe("root-id");
		});

		test("returns id from metadata when root id missing", () => {
			const id = getProjectId({
				project: { metadata: { id: "metadata-id" } },
			});
			expect(id).toBe("metadata-id");
		});
	});
});
