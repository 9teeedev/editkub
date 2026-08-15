export interface TScene {
	id: string;
	name: string;
	isMain: boolean;
	tracks: TimelineTrack[];
	bookmarks: number[];
	createdAt: Date;
	updatedAt: Date;
}

export type TrackType = "video" | "text" | "audio" | "sticker" | "effect";

interface BaseTrack {
	id: string;
	name: string;
}

export interface VideoTrack extends BaseTrack {
	type: "video";
	elements: (VideoElement | ImageElement)[];
	transitions?: TrackTransition[];
	isMain: boolean;
	muted: boolean;
	hidden: boolean;
}

export interface TextTrack extends BaseTrack {
	type: "text";
	elements: TextElement[];
	hidden: boolean;
}

export interface AudioTrack extends BaseTrack {
	type: "audio";
	elements: AudioElement[];
	muted: boolean;
}

export interface StickerTrack extends BaseTrack {
	type: "sticker";
	elements: StickerElement[];
	hidden: boolean;
}

export interface EffectTrack extends BaseTrack {
	type: "effect";
	elements: BlurEffectElement[];
	hidden: boolean;
}

export type TimelineTrack =
	| VideoTrack
	| TextTrack
	| AudioTrack
	| StickerTrack
	| EffectTrack;

export interface Transform {
	scale: number;
	position: {
		x: number;
		y: number;
	};
	rotate: number;
	flipX?: boolean;
	flipY?: boolean;
}

export type PictureInPicturePreset =
	| "corner-top-left"
	| "corner-top-right"
	| "corner-bottom-left"
	| "corner-bottom-right"
	| "split-left"
	| "split-right";

export interface PictureInPictureConfig {
	preset: PictureInPicturePreset;
	borderRadius: number;
	borderWidth: number;
	borderColor: string;
	shadow: boolean;
}

// ---- Keyframe Animation ----

/** Animatable property channels. `flipX`/`flipY` are boolean and not animatable. */
export type KeyframeProperty =
	| "position.x"
	| "position.y"
	| "scale"
	| "rotate"
	| "opacity";

/** Easing curve applied between two consecutive keyframes. */
export type Easing =
	| "linear"
	| "ease-in"
	| "ease-out"
	| "ease-in-out"
	| "bezier";

/**
 * A single keyframe. `time` is local to the element (seconds from the
 * element's start, i.e. relative to `startTime`). `bezierP1`/`bezierP2`
 * are the cubic-bezier control points in normalized [0,1] space and are
 * only used when `easing === "bezier"`.
 */
export interface Keyframe {
	id: string;
	time: number;
	value: number;
	easing: Easing;
	bezierP1?: { x: number; y: number };
	bezierP2?: { x: number; y: number };
}

/**
 * Per-channel keyframe arrays for a single element. Absence of a channel
 * means the property is not animated (its static base value is used).
 */
export type ElementKeyframes = Partial<Record<KeyframeProperty, Keyframe[]>>;

// ---- Text Animation ----

/**
 * Built-in text entrance/exit/loop animation presets. These animate
 * properties of the text rendering (visibility, opacity, offset, scale)
 * that are orthogonal to keyframe-driven transform/opacity animation.
 */
export type TextAnimationType =
	| "none"
	| "typewriter"
	| "glitch"
	| "bounce"
	| "slide-in"
	| "slide-out"
	| "fade-in"
	| "fade-out"
	| "scale-in"
	| "karaoke";

/**
 * Per-element text animation config. `duration` is how long (seconds) the
 * animation takes from the element's start; `0` means it runs across the
 * element's whole lifetime. `intensity` (0–1) scales visual jitter for
 * effects like glitch/bounce.
 */
export interface TextAnimation {
	type: TextAnimationType;
	/** Seconds from element start over which the animation runs. 0 = full element. */
	duration: number;
	/** 0–1 multiplier on effect strength (glitch jitter, bounce height). */
	intensity?: number;
}

/**
 * Per-element text animations grouped by phase. `in` plays from the element's
 * start (entrance); `out` plays over the final `out.duration` seconds before
 * the element ends (exit). Either may be omitted for "no animation in that
 * phase". Stored as a single object so the whole animation config travels as
 * one logical unit (e.g. when edited by an AI/MCP tool).
 */
export interface TextAnimations {
	/** Entrance animation, played from element-local time 0. */
	in?: TextAnimation;
	/** Exit animation, played over the final seconds of the element. */
	out?: TextAnimation;
}

/** The two independent phases a text animation can belong to. */
export type TextAnimationPhase = "in" | "out";

// ---- Transitions ----

export type TransitionType =
	| "fade"
	| "dissolve"
	| "wipe-left"
	| "wipe-right"
	| "wipe-up"
	| "wipe-down"
	| "slide-left"
	| "slide-right"
	| "slide-up"
	| "slide-down"
	| "zoom-in"
	| "zoom-out";

export interface TrackTransition {
	id: string;
	type: TransitionType;
	duration: number;
	fromElementId: string;
	toElementId: string;
}

interface BaseAudioElement extends BaseTimelineElement {
	type: "audio";
	volume: number;
	muted?: boolean;
	buffer?: AudioBuffer;
	playbackRate?: number;
	pan?: number;
	fadeIn?: number;
	fadeOut?: number;
	autoDuck?: boolean;
	isVoiceover?: boolean;
}

export interface UploadAudioElement extends BaseAudioElement {
	sourceType: "upload";
	mediaId: string;
}

export interface LibraryAudioElement extends BaseAudioElement {
	sourceType: "library";
	sourceUrl: string;
}

export type AudioElement = UploadAudioElement | LibraryAudioElement;

interface BaseTimelineElement {
	id: string;
	name: string;
	duration: number;
	startTime: number;
	trimStart: number;
	trimEnd: number;
}

export interface VideoElement extends BaseTimelineElement {
	type: "video";
	mediaId: string;
	muted?: boolean;
	hidden?: boolean;
	transform: Transform;
	opacity: number;
	filter?: ElementFilter;
	blendMode?: string;
	adjustments?: AdjustmentControls;
	chromaKey?: ChromaKeyConfig;
	videoEffect?: VideoEffectConfig;
	shapeMask?: ShapeMaskConfig;
	backgroundRemoval?: BackgroundRemovalConfig;
	pip?: PictureInPictureConfig;
	keyframes?: ElementKeyframes;
	playbackRate?: number;
	reversed?: boolean;
}

export interface ImageElement extends BaseTimelineElement {
	type: "image";
	mediaId: string;
	hidden?: boolean;
	transform: Transform;
	opacity: number;
	filter?: ElementFilter;
	blendMode?: string;
	adjustments?: AdjustmentControls;
	chromaKey?: ChromaKeyConfig;
	videoEffect?: VideoEffectConfig;
	shapeMask?: ShapeMaskConfig;
	backgroundRemoval?: BackgroundRemovalConfig;
	pip?: PictureInPictureConfig;
	keyframes?: ElementKeyframes;
}

export interface TextStroke {
	color: string;
	width: number;
}

export interface TextShadow {
	color: string;
	offsetX: number;
	offsetY: number;
	blur: number;
}

export interface ElementFilter {
	presetId: string;
	intensity: number; // 0-1, multiplier on the filter strength
}

/** Chroma key (green/blue screen) configuration. */
export interface ChromaKeyConfig {
	/** Key color as [r, g, b] (0-255 each). */
	keyColor: [number, number, number];
	/** Color-distance threshold (0-1). */
	threshold: number;
	/** Edge softness (0-1). */
	smoothness: number;
	/** Spill suppression strength (0-1). */
	spillSuppression: number;
}

/** AI portrait matting configuration. */
export interface BackgroundRemovalConfig {
	enabled: boolean;
}

/**
 * Video effect (VFX) overlay — per-frame pixel effects that CSS filters
 * cannot express (glitch, VHS, pixelate, etc.).
 */
export interface VideoEffectConfig {
	effect: VideoEffectId;
	/** 0-1 strength multiplier. */
	intensity: number;
}

export type VideoEffectId =
	| "none"
	| "glitch"
	| "vhs"
	| "pixelate"
	| "rgb-split"
	| "halftone";

/** Shape mask types for visual elements. */
export type MaskShape = "circle" | "rect" | "star" | "inverted-circle";

/**
 * Shape mask configuration. Clips the element to a geometric shape with
 * feathered edges. Coordinates are normalized [0,1] relative to the frame.
 */
export interface ShapeMaskConfig {
	shape: MaskShape;
	centerX: number;
	centerY: number;
	/** Size relative to the shorter frame edge (0-1). */
	size: number;
	/** Rotation in degrees. */
	rotation: number;
	/** Edge feather in pixels. */
	feather: number;
	/** Cut a hole instead of keeping the shape. */
	invert: boolean;
}

export interface AdjustmentControls {
	brightness: number; // 0-2, default 1
	contrast: number; // 0-2, default 1
	saturation: number; // 0-2, default 1
	temperature: number; // -100 to 100, default 0 (negative=blue, positive=orange)
	tint: number; // -100 to 100, default 0
	hue: number; // -180 to 180, default 0 (degrees)
	vignette: number; // 0-100, default 0 (edge darkening intensity)
	sharpen: number; // 0-100, default 0 (unsharp convolution strength)
}

export interface TextElement extends BaseTimelineElement {
	type: "text";
	content: string;
	fontSize: number;
	fontFamily: string;
	color: string;
	backgroundColor: string;
	textAlign: "left" | "center" | "right";
	fontWeight: "normal" | "bold";
	fontStyle: "normal" | "italic";
	textDecoration: "none" | "underline" | "line-through";
	hidden?: boolean;
	transform: Transform;
	opacity: number;
	keyframes?: ElementKeyframes;
	stroke?: TextStroke;
	shadow?: TextShadow;
	boxWidth?: number;
	backgroundBorderRadius?: number;
	backgroundOpacity?: number;
	backgroundPaddingX?: number;
	backgroundPaddingY?: number;
	textAnimations?: TextAnimations;
}

export interface StickerElement extends BaseTimelineElement {
	type: "sticker";
	iconName: string;
	hidden?: boolean;
	transform: Transform;
	opacity: number;
	color?: string;
	keyframes?: ElementKeyframes;
}

export interface BlurEffectElement extends BaseTimelineElement {
	type: "blur-effect";
	/** Blur strength, 0–100. */
	blurIntensity: number;
	/** Width as a fraction of canvas (1 = full width). */
	boxWidth?: number;
	/** Height as a fraction of canvas (1 = full height). */
	boxHeight?: number;
	hidden?: boolean;
	transform: Transform;
	opacity: number;
	keyframes?: ElementKeyframes;
}


export type TimelineElement =
	| AudioElement
	| VideoElement
	| ImageElement
	| TextElement
	| StickerElement
	| BlurEffectElement;

export type ElementType = TimelineElement["type"];

export type CreateUploadAudioElement = Omit<UploadAudioElement, "id">;
export type CreateLibraryAudioElement = Omit<LibraryAudioElement, "id">;
export type CreateAudioElement =
	| CreateUploadAudioElement
	| CreateLibraryAudioElement;
export type CreateVideoElement = Omit<VideoElement, "id">;
export type CreateImageElement = Omit<ImageElement, "id">;
export type CreateTextElement = Omit<TextElement, "id">;
export type CreateStickerElement = Omit<StickerElement, "id">;
export type CreateBlurEffectElement = Omit<BlurEffectElement, "id">;
export type CreateTimelineElement =
	| CreateAudioElement
	| CreateVideoElement
	| CreateImageElement
	| CreateTextElement
	| CreateStickerElement
	| CreateBlurEffectElement;

// ---- Drag State ----

export interface ElementDragState {
	isDragging: boolean;
	elementId: string | null;
	trackId: string | null;
	startMouseX: number;
	startMouseY: number;
	startElementTime: number;
	clickOffsetTime: number;
	currentTime: number;
	currentMouseY: number;
}

export interface DropTarget {
	trackIndex: number;
	isNewTrack: boolean;
	insertPosition: "above" | "below" | null;
	xPosition: number;
}

export interface ComputeDropTargetParams {
	elementType: ElementType;
	mouseX: number;
	mouseY: number;
	tracks: TimelineTrack[];
	playheadTime: number;
	isExternalDrop: boolean;
	elementDuration: number;
	pixelsPerSecond: number;
	zoomLevel: number;
	verticalDragDirection?: "up" | "down" | null;
	startTimeOverride?: number;
	excludeElementId?: string;
	/**
	 * Whether the "main track must start at 0" constraint is active. Callers
	 * pass the Auto Snapping toggle value so the drop preview matches the
	 * behaviour the move command will apply on drop.
	 */
	snappingEnabled?: boolean;
}

export interface ClipboardItem {
	trackId: string;
	trackType: TrackType;
	element: CreateTimelineElement;
}
