export const v7Project = {
	id: "project-v7-123",
	version: 7,
	metadata: {
		id: "project-v7-123",
		name: "My V7 Project",
		thumbnail: "data:image/png;base64,abc123",
		duration: 10,
		createdAt: "2024-09-01T10:00:00.000Z",
		updatedAt: "2024-09-01T14:00:00.000Z",
	},
	settings: {
		fps: 30,
		canvasSize: { width: 1080, height: 1920 },
		originalCanvasSize: { width: 1920, height: 1080 },
		background: { type: "color", color: "#000000" },
	},
	currentSceneId: "scene-main",
	layoutMode: "vertical",
	scenes: [
		{
			id: "scene-main",
			name: "Main scene",
			isMain: true,
			tracks: [
				{
					id: "track-drawing",
					type: "drawing",
					name: "Drawing Track",
					hidden: false,
					elements: [
						{
							id: "element-drawing-1",
							type: "drawing",
							name: "Sketch",
							startTime: 0,
							duration: 10,
							trimStart: 0,
							trimEnd: 0,
							transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
							opacity: 1,
							strokes: [
								{
									id: "stroke-1",
									points: [
										{ x: -0.5, y: -0.5 },
										{ x: 0.5, y: 0.5 },
									],
									color: "#ff0000",
									width: 4,
									tool: "pen",
								},
							],
						},
					],
				},
			],
			bookmarks: [],
			createdAt: "2024-09-01T10:00:00.000Z",
			updatedAt: "2024-09-01T14:00:00.000Z",
		},
	],
};
