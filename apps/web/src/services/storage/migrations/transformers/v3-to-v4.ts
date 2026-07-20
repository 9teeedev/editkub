import type { MigrationResult, ProjectRecord } from "./types";
import { getProjectId } from "./utils";

/**
 * v3 → v4 migration.
 *
 * v4 adds optional `keyframes?: ElementKeyframes` to the visual element
 * types (video, image, text, sticker). Because the field is optional and
 * its absence is treated identically to "no animation", existing v3
 * projects need no element-level rewriting — we only bump the version so
 * the runner stops re-processing them.
 */
export function transformProjectV3ToV4({
	project,
}: {
	project: ProjectRecord;
}): MigrationResult<ProjectRecord> {
	const projectId = getProjectId({ project });
	if (!projectId) {
		return { project, skipped: true, reason: "no project id" };
	}

	if (isV4Project({ project })) {
		return { project, skipped: true, reason: "already v4" };
	}

	const migratedProject = {
		...project,
		version: 4,
	};

	return { project: migratedProject, skipped: false };
}

export { getProjectId } from "./utils";

function isV4Project({ project }: { project: ProjectRecord }): boolean {
	const versionValue = project.version;
	return typeof versionValue === "number" && versionValue >= 4;
}
