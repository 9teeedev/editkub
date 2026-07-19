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

export type TimelineDragData = MediaDragData | TextDragData | StickerDragData;
