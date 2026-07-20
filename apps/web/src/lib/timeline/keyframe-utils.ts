/**
 * Keyframe interpolation engine.
 *
 * Pure domain logic (per AGENTS.md → lives in `lib/`). Given a set of
 * keyframes and a time, this module resolves the effective animatable
 * values (position, scale, rotate, opacity) for a visual element.
 *
 * All keyframe `time` values are **local to the element** (seconds from
 * the element's start, i.e. relative to `startTime`).
 */
import type {
	ElementKeyframes,
	Keyframe,
	KeyframeProperty,
	Transform,
} from "@/types/timeline";

/** Tolerance (seconds) for "same time" comparisons (e.g. getKeyframeAtTime). */
const TIME_EPSILON = 1 / 1000;

// ---- Easing ----

/** Cubic-bezier control points for the named easing presets, normalized to [0,1]. */
const EASING_PRESETS: Record<
	Exclude<Keyframe["easing"], "linear" | "bezier">,
	{ p1: { x: number; y: number }; p2: { x: number; y: number } }
> = {
	"ease-in": { p1: { x: 0.42, y: 0 }, p2: { x: 1, y: 1 } },
	"ease-out": { p1: { x: 0, y: 0 }, p2: { x: 0.58, y: 1 } },
	"ease-in-out": { p1: { x: 0.42, y: 0 }, p2: { x: 0.58, y: 1 } },
};

/**
 * Solve the cubic-bezier x-coordinate for a parametric `t` in [0,1].
 *
 * A cubic bezier with control points (0,0), p1, p2, (1,1) has:
 *   x(t) = 3(1-t)²t·p1.x + 3(1-t)t²·p2.x + t³
 *
 * Given a target `progress` (the desired normalized time along the segment),
 * we Newton-Raphson iterate to find `t` such that x(t) = progress, then
 * return y(t). Falls back to bisection if Newton fails to converge.
 */
function cubicBezierY({
	progress,
	p1,
	p2,
}: {
	progress: number;
	p1: { x: number; y: number };
	p2: { x: number; y: number };
}): number {
	// Linear endpoints: progress 0 → 0, progress 1 → 1.
	if (progress <= 0) return 0;
	if (progress >= 1) return 1;

	const bezierX = (t: number): number =>
		3 * (1 - t) * (1 - t) * t * p1.x + 3 * (1 - t) * t * t * p2.x + t * t * t;
	const bezierY = (t: number): number =>
		3 * (1 - t) * (1 - t) * t * p1.y + 3 * (1 - t) * t * t * p2.y + t * t * t;
	const bezierDX = (t: number): number =>
		3 * (1 - t) * (1 - t) * (p1.x - 0) +
		6 * (1 - t) * t * (p2.x - p1.x) +
		3 * t * t * (1 - p2.x);

	// Newton-Raphson (start with a decent guess).
	let t = progress;
	for (let i = 0; i < 8; i++) {
		const x = bezierX(t) - progress;
		if (Math.abs(x) < 1e-6) return bezierY(t);
		const dx = bezierDX(t);
		if (Math.abs(dx) < 1e-6) break;
		t -= x / dx;
	}

	// Bisection fallback.
	let lo = 0;
	let hi = 1;
	t = progress;
	for (let i = 0; i < 30; i++) {
		const x = bezierX(t);
		if (Math.abs(x - progress) < 1e-6) break;
		if (x < progress) lo = t;
		else hi = t;
		t = (lo + hi) / 2;
	}
	return bezierY(t);
}

/**
 * Map a normalized segment progress [0,1] through an easing curve,
 * returning the eased progress [0,1]. The easing is taken from the
 * *outgoing* keyframe (`fromKf`) of the segment.
 */
export function applyEasing(
	progress: number,
	fromKf: Keyframe,
): number {
	switch (fromKf.easing) {
		case "linear":
			return progress;
		case "bezier": {
			const p1 = fromKf.bezierP1 ?? { x: 0.33, y: 0 };
			const p2 = fromKf.bezierP2 ?? { x: 0.67, y: 1 };
			return cubicBezierY({ progress, p1, p2 });
		}
		default: {
			const preset = EASING_PRESETS[fromKf.easing];
			return cubicBezierY({ progress, p1: preset.p1, p2: preset.p2 });
		}
	}
}

// ---- Channel sampling ----

/**
 * Sample a single channel's keyframe array at `time`.
 *
 * - Empty array → `{ hasKeyframe: false }` (caller falls back to base value).
 * - Before the first keyframe → hold the first value.
 * - After the last keyframe → hold the last value.
 * - Between two keyframes → interpolate using the outgoing keyframe's easing.
 */
export function sampleChannel(
	kfs: Keyframe[] | undefined,
	time: number,
): { value: number; hasKeyframe: boolean } {
	if (!kfs || kfs.length === 0) {
		return { value: 0, hasKeyframe: false };
	}

	// Ensure time-sorted without mutating caller's array.
	const sorted =
		kfs.length === 1 || isSorted(kfs)
			? kfs
			: [...kfs].sort((a, b) => a.time - b.time);

	if (sorted.length === 1) {
		return { value: sorted[0].value, hasKeyframe: true };
	}

	const first = sorted[0];
	const last = sorted[sorted.length - 1];

	if (time <= first.time) {
		return { value: first.value, hasKeyframe: true };
	}
	if (time >= last.time) {
		return { value: last.value, hasKeyframe: true };
	}

	// Binary search for the segment [fromKf, toKf] containing `time`.
	let lo = 0;
	let hi = sorted.length - 1;
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1;
		if (sorted[mid].time <= time) lo = mid;
		else hi = mid;
	}

	const fromKf = sorted[lo];
	const toKf = sorted[hi];
	const span = toKf.time - fromKf.time;
	const rawProgress = span > 0 ? (time - fromKf.time) / span : 0;
	const eased = applyEasing(rawProgress, fromKf);
	const value = fromKf.value + (toKf.value - fromKf.value) * eased;
	return { value, hasKeyframe: true };
}

function isSorted(kfs: Keyframe[]): boolean {
	for (let i = 1; i < kfs.length; i++) {
		if (kfs[i].time < kfs[i - 1].time) return false;
	}
	return true;
}

// ---- Full-property resolution ----

/** Read the static (base) value of a channel from the element's transform/opacity. */
export function getBaseValue(
	property: KeyframeProperty,
	baseTransform: Transform,
	baseOpacity: number,
): number {
	switch (property) {
		case "position.x":
			return baseTransform.position.x;
		case "position.y":
			return baseTransform.position.y;
		case "scale":
			return baseTransform.scale;
		case "rotate":
			return baseTransform.rotate;
		case "opacity":
			return baseOpacity;
	}
}

/**
 * Resolve the effective transform + opacity for a visual element at `time`.
 *
 * For each channel: if the element has keyframes for it, sample them;
 * otherwise use the base value. `flipX`/`flipY` are never animated and
 * pass through from the base transform.
 */
export function resolveAnimatedProperties({
	keyframes,
	time,
	baseTransform,
	baseOpacity,
}: {
	keyframes: ElementKeyframes | undefined;
	time: number;
	baseTransform: Transform;
	baseOpacity: number;
}): { transform: Transform; opacity: number } {
	// Fast path: no keyframes at all.
	if (!keyframes) {
		return { transform: baseTransform, opacity: baseOpacity };
	}

	const scaleKfs = keyframes["scale"];
	const pxKfs = keyframes["position.x"];
	const pyKfs = keyframes["position.y"];
	const rotateKfs = keyframes["rotate"];
	const opacityKfs = keyframes["opacity"];

	// If every channel is empty/absent, skip sampling entirely.
	if (
		!hasKeyframes(scaleKfs) &&
		!hasKeyframes(pxKfs) &&
		!hasKeyframes(pyKfs) &&
		!hasKeyframes(rotateKfs) &&
		!hasKeyframes(opacityKfs)
	) {
		return { transform: baseTransform, opacity: baseOpacity };
	}

	const scale = sampleOr(scaleKfs, time, baseTransform.scale);
	const px = sampleOr(pxKfs, time, baseTransform.position.x);
	const py = sampleOr(pyKfs, time, baseTransform.position.y);
	const rotate = sampleOr(rotateKfs, time, baseTransform.rotate);
	const opacity = sampleOr(opacityKfs, time, baseOpacity);

	return {
		transform: {
			scale,
			position: { x: px, y: py },
			rotate,
			// flipX/flipY are not animatable; preserve from the base transform.
			flipX: baseTransform.flipX,
			flipY: baseTransform.flipY,
		},
		opacity,
	};
}

function hasKeyframes(kfs: Keyframe[] | undefined): boolean {
	return !!kfs && kfs.length > 0;
}

function sampleOr(
	kfs: Keyframe[] | undefined,
	time: number,
	fallback: number,
): number {
	const { value, hasKeyframe } = sampleChannel(kfs, time);
	return hasKeyframe ? value : fallback;
}

// ---- Mutation helpers (immutable) ----

/**
 * Generate a unique keyframe id. Uses crypto.randomUUID when available;
 * falls back to a timestamp + high-entropy random suffix otherwise.
 */
export function generateKeyframeId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return `kf-${crypto.randomUUID()}`;
	}
	// Fallback: pad the random portion to 11 chars so two calls in the same
	// millisecond don't collide. toString(36) on Math.random() can be very
	// short for small mantissas, so we loop until we have enough entropy.
	let rand = "";
	while (rand.length < 11) {
		rand += Math.random().toString(36).slice(2, 11);
	}
	return `kf-${Date.now().toString(36)}-${rand.slice(0, 11)}`;
}

/** Returns a new ElementKeyframes with the channel's array replaced. */
export function setChannel(
	keyframes: ElementKeyframes | undefined,
	property: KeyframeProperty,
	kfs: Keyframe[],
): ElementKeyframes {
	const next: ElementKeyframes = { ...keyframes };
	if (kfs.length === 0) {
		delete next[property];
	} else {
		next[property] = kfs;
	}
	return next;
}

/** Returns true if the channel is animated (has ≥1 keyframe). */
export function hasChannel(
	keyframes: ElementKeyframes | undefined,
	property: KeyframeProperty,
): boolean {
	return !!keyframes?.[property] && keyframes[property].length > 0;
}

/**
 * Insert (or replace if one exists at the same time) a keyframe on a channel.
 * Returns the new channel array. The keyframe's `time`/`value`/`easing` come
 * from the supplied partial; an id is generated if missing.
 */
export function upsertKeyframe(
	kfs: Keyframe[] | undefined,
	keyframe: Keyframe,
): Keyframe[] {
	const next = [...(kfs ?? [])];
	const idx = next.findIndex(
		(k) => Math.abs(k.time - keyframe.time) < TIME_EPSILON,
	);
	if (idx >= 0) {
		next[idx] = { ...next[idx], ...keyframe };
	} else {
		next.push(keyframe);
	}
	return next.sort((a, b) => a.time - b.time);
}

/** Remove a keyframe by id. Returns the new channel array (possibly empty). */
export function removeKeyframeById(
	kfs: Keyframe[] | undefined,
	id: string,
): Keyframe[] {
	return (kfs ?? []).filter((k) => k.id !== id);
}

/**
 * Find the keyframe at (approximately) `time` on a channel, if any.
 * Used by auto-keyframe to decide update-vs-insert.
 */
export function getKeyframeAtTime(
	kfs: Keyframe[] | undefined,
	time: number,
): Keyframe | undefined {
	return (kfs ?? []).find((k) => Math.abs(k.time - time) < TIME_EPSILON);
}

/**
 * Enable a channel: creates two keyframes (at the element's start and end)
 * holding the current base value, so the property is pinned until the user
 * adds more. If the channel already has keyframes, returns unchanged.
 */
export function enableChannel(
	keyframes: ElementKeyframes | undefined,
	property: KeyframeProperty,
	value: number,
	elementDuration: number,
): ElementKeyframes {
	if (hasChannel(keyframes, property)) {
		return keyframes ?? {};
	}
	const startKf: Keyframe = {
		id: generateKeyframeId(),
		time: 0,
		value,
		easing: "linear",
	};
	const endKf: Keyframe = {
		id: generateKeyframeId(),
		time: elementDuration,
		value,
		easing: "linear",
	};
	return setChannel(keyframes, property, [startKf, endKf]);
}

/** Disable a channel by removing all its keyframes. */
export function disableChannel(
	keyframes: ElementKeyframes | undefined,
	property: KeyframeProperty,
): ElementKeyframes {
	return setChannel(keyframes, property, []);
}

/** Total keyframe count across all channels (for UI affordances). */
export function countKeyframes(
	keyframes: ElementKeyframes | undefined,
): number {
	if (!keyframes) return 0;
	let total = 0;
	for (const key of Object.keys(keyframes) as KeyframeProperty[]) {
		total += keyframes[key]?.length ?? 0;
	}
	return total;
}

/** Whether the element has any keyframes at all. */
export function hasAnyKeyframes(
	keyframes: ElementKeyframes | undefined,
): boolean {
	return countKeyframes(keyframes) > 0;
}

export const KEYFRAME_TIME_EPSILON = TIME_EPSILON;

/** All animatable channels, in display order. */
export const KEYFRAME_PROPERTIES: KeyframeProperty[] = [
	"position.x",
	"position.y",
	"scale",
	"rotate",
	"opacity",
];

/**
 * Build the right element-update payload for a transform change, taking
 * keyframes into account.
 *
 * For each changed transform field (`position.x`, `position.y`, `scale`,
 * `rotate`):
 * - If the channel is animated, upsert a keyframe at `localTime` with the new
 *   value (auto-record semantics — same as the property panel).
 * - Otherwise, mutate the static base transform.
 *
 * Returns `{ transform?, keyframes? }` to be merged into an
 * `editor.timeline.updateElements` call. Fields are only included when they
 * change. If the element has keyframes, both may be set: `transform` for the
 * static base (kept in sync so e.g. multi-select / hit-test see sensible
 * values) and `keyframes` for the animated channel.
 *
 * `localTime` is the element-local time (clamped to [0, duration]) at which
 * to record any keyframes. Pass `undefined` (or NaN) when keyframes can't be
 * placed — in that case, animated channels are skipped silently.
 */
export function buildAnimatedTransformUpdate({
	element,
	nextTransform,
	localTime,
}: {
	element: { transform: Transform; keyframes?: ElementKeyframes; duration: number };
	nextTransform: Transform;
	localTime: number | undefined;
}): { transform?: Transform; keyframes?: ElementKeyframes } {
	// Always update the static base so non-animated fields (and downstream
	// consumers like hit-test / multi-select) see the latest position/scale.
	const result: { transform?: Transform; keyframes?: ElementKeyframes } = {
		transform: nextTransform,
	};

	const kfs = element.keyframes;
	if (!kfs) return result;

	// Clamp local time into element bounds; bail if invalid.
	const t =
		localTime === undefined || Number.isNaN(localTime)
			? null
			: Math.max(0, Math.min(element.duration, localTime));
	if (t === null) return result;

	// Find which channels actually changed and are animated.
	const changes: Partial<Record<KeyframeProperty, number>> = {};
	if (nextTransform.position.x !== element.transform.position.x && hasChannel(kfs, "position.x")) {
		changes["position.x"] = nextTransform.position.x;
	}
	if (nextTransform.position.y !== element.transform.position.y && hasChannel(kfs, "position.y")) {
		changes["position.y"] = nextTransform.position.y;
	}
	if (nextTransform.scale !== element.transform.scale && hasChannel(kfs, "scale")) {
		changes.scale = nextTransform.scale;
	}
	if (nextTransform.rotate !== element.transform.rotate && hasChannel(kfs, "rotate")) {
		changes.rotate = nextTransform.rotate;
	}

	const changedKeys = Object.keys(changes) as KeyframeProperty[];
	if (changedKeys.length === 0) return result;

	let nextKfs: ElementKeyframes = { ...kfs };
	for (const property of changedKeys) {
		const channel = nextKfs[property] ?? [];
		const existing = channel.find(
			(k) => Math.abs(k.time - t) < TIME_EPSILON,
		);
		nextKfs = setChannel(
			nextKfs,
			property,
			upsertKeyframe(channel, {
				id: existing?.id ?? generateKeyframeId(),
				time: t,
				value: changes[property] as number,
				easing: existing?.easing ?? "linear",
				...(existing?.bezierP1 ? { bezierP1: existing.bezierP1 } : {}),
				...(existing?.bezierP2 ? { bezierP2: existing.bezierP2 } : {}),
			}),
		);
	}

	result.keyframes = nextKfs;
	return result;
}
