import type { MigrationResult, ProjectRecord } from "./types";
import { getProjectId } from "./utils";

/**
 * v6 → v7 migration.
 *
 * v7 adds an optional `layoutMode` field (`"landscape" | "vertical"`) to the
 * project root. Because the field is optional and defaults to `"landscape"`
 * at the application layer, no data rewriting is needed — we only bump the
 * version so the runner stops re-processing them.
 */
export function transformProjectV6ToV7({
	project,
}: {
	project: ProjectRecord;
}): MigrationResult<ProjectRecord> {
	const projectId = getProjectId({ project });
	if (!projectId) {
		return { project, skipped: true, reason: "no project id" };
	}

	if (isV7Project({ project })) {
		return { project, skipped: true, reason: "already v7" };
	}

	const migratedProject = {
		...project,
		version: 7,
	};

	return { project: migratedProject, skipped: false };
}

function isV7Project({ project }: { project: ProjectRecord }): boolean {
	const versionValue = project.version;
	return typeof versionValue === "number" && versionValue >= 7;
}
