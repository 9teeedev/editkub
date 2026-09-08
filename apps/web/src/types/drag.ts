interface BaseDragData {
	id: string;
	name: string;
}

export interface MediaDragData extends BaseDragData {
	type: "media";
	mediaType: "image" | "video" | "audio";
}

export interface TextDragData extends BaseDragData {
	type: "text";
	content: string;
	/** Optional template style props passed through to buildTextElement */
	styles?: Record<string, unknown>;
}

export interface StickerDragData extends BaseDragData {
	type: "sticker";
	iconName: string;
}

export interface BlurEffectDragData extends BaseDragData {
	type: "blur-effect";
	blurIntensity: number;
}

export interface AdjustmentDragData extends BaseDragData {
	type: "adjustment";
}

export type TimelineDragData =
	| MediaDragData
	| TextDragData
	| StickerDragData
	| BlurEffectDragData
	| AdjustmentDragData;
