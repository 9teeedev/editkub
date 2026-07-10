import type { MigrationResult, ProjectRecord } from "./types";
import { getProjectId } from "./utils";

/**
 * v4 → v5 migration.
 *
 * v5 adds optional `textAnimation?: TextAnimation` to `TextElement`. Because
 * the field is optional and its absence is treated identically to "no text
 * animation" (static text), existing v4 projects need no element-level
 * rewriting — we only bump the version so the runner stops re-processing them.
 */
export function transformProjectV4ToV5({
	project,
}: {
	project: ProjectRecord;
}): MigrationResult<ProjectRecord> {
	const projectId = getProjectId({ project });
	if (!projectId) {
		return { project, skipped: true, reason: "no project id" };
	}

	if (isV5Project({ project })) {
		return { project, skipped: true, reason: "already v5" };
	}

	const migratedProject = {
		...project,
		version: 5,
	};

	return { project: migratedProject, skipped: false };
}

function isV5Project({ project }: { project: ProjectRecord }): boolean {
	const versionValue = project.version;
	return typeof versionValue === "number" && versionValue >= 5;
}
