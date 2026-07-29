import type { MigrationResult, ProjectRecord } from "./types";
import { getProjectId, isRecord } from "./utils";
import { phaseForType } from "@/lib/timeline/text-animation-utils";
import type { TextAnimation } from "@/types/timeline";

/**
 * v5 → v6 migration.
 *
 * v6 replaces the single `textAnimation?: TextAnimation` field on a text
 * element with `textAnimations?: { in?: TextAnimation; out?: TextAnimation }`.
 * Each legacy animation is routed to the correct phase by its type:
 *
 *   - exit types (`fade-out`, `slide-out`)  → `out`
 *   - everything else (entrance/loop/…)     → `in`
 *
 * This keeps a project with an entrance effect animating in (unchanged) and a
 * project with an exit effect now correctly anchored to the element's end
 * rather than its start.
 */
export function transformProjectV5ToV6({
	project,
}: {
	project: ProjectRecord;
}): MigrationResult<ProjectRecord> {
	const projectId = getProjectId({ project });
	if (!projectId) {
		return { project, skipped: true, reason: "no project id" };
	}

	if (isV6Project({ project })) {
		return { project, skipped: true, reason: "already v6" };
	}

	const migratedProject: ProjectRecord = {
		...project,
		version: 6,
		scenes: migrateScenes(project.scenes),
	};

	return { project: migratedProject, skipped: false };
}

function isV6Project({ project }: { project: ProjectRecord }): boolean {
	const versionValue = project.version;
	return typeof versionValue === "number" && versionValue >= 6;
}

/** Walk every scene → track → text element, rewriting `textAnimation`. */
function migrateScenes(scenes: unknown): unknown {
	if (!Array.isArray(scenes)) return scenes;
	return scenes.map((scene) => {
		if (!isRecord(scene)) return scene;
		return {
			...scene,
			tracks: Array.isArray(scene.tracks)
				? scene.tracks.map(migrateTrack)
				: scene.tracks,
		};
	});
}

function migrateTrack(track: unknown): unknown {
	if (!isRecord(track)) return track;
	if (track.type !== "text") return track;
	const elements = track.elements;
	if (!Array.isArray(elements)) return track;
	return { ...track, elements: elements.map(migrateTextElement) };
}

function migrateTextElement(element: unknown): unknown {
	if (!isRecord(element)) return element;
	if (element.type !== "text") return element;
	const legacy = element.textAnimation;
	// Already migrated, or no animation to migrate.
	if (legacy === undefined || legacy === null) {
		// Drop the field for cleanliness if it happens to be null.
		if ("textAnimation" in element) {
			const { textAnimation: _drop, ...rest } = element;
			return rest;
		}
		return element;
	}
	if (!isRecord(legacy)) return element;

	const animation = legacy as unknown as TextAnimation;
	const phase = phaseForType(animation.type);

	const { textAnimation: _drop, ...rest } = element;
	return {
		...rest,
		textAnimations:
			phase === "out" ? { out: animation } : { in: animation },
	};
}
