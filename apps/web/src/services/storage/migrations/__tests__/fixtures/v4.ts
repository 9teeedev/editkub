export const v4Project = {
	id: "project-v4-123",
	version: 4,
	metadata: {
		id: "project-v4-123",
		name: "My V4 Project",
		thumbnail: "data:image/png;base64,abc123",
		duration: 25.5,
		createdAt: "2024-06-01T10:00:00.000Z",
		updatedAt: "2024-06-01T14:00:00.000Z",
	},
	settings: {
		fps: 30,
		canvasSize: { width: 1920, height: 1080 },
		background: { type: "color", color: "#000000" },
	},
	currentSceneId: "scene-main",
	scenes: [
		{
			id: "scene-main",
			name: "Main scene",
			isMain: true,
			tracks: [
				{
					id: "track-1",
					type: "video",
					name: "Video Track",
					isMain: true,
					elements: [
						{
							id: "element-1",
							type: "video",
							mediaId: "media-1",
							startTime: 0,
							duration: 25.5,
							trimStart: 0,
							trimEnd: 0,
						},
					],
				},
			],
			bookmarks: [],
			createdAt: "2024-06-01T10:00:00.000Z",
			updatedAt: "2024-06-01T14:00:00.000Z",
		},
	],
};
