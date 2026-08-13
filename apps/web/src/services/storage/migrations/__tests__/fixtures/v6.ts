export const v6Project = {
	id: "project-v6-123",
	version: 6,
	metadata: {
		id: "project-v6-123",
		name: "My V6 Project",
		thumbnail: "data:image/png;base64,abc456",
		duration: 30,
		createdAt: "2024-07-02T10:00:00.000Z",
		updatedAt: "2024-07-02T14:00:00.000Z",
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
					id: "track-text",
					type: "text",
					name: "Text Track",
					hidden: false,
					elements: [
						{
							id: "element-text-1",
							type: "text",
							content: "Animated text",
							startTime: 0,
							duration: 5,
							trimStart: 0,
							trimEnd: 0,
							fontSize: 48,
							fontFamily: "Inter",
							color: "#ffffff",
							backgroundColor: "transparent",
							textAlign: "center",
							fontWeight: "normal",
							fontStyle: "normal",
							textDecoration: "none",
							transform: {
								scale: 1,
								position: { x: 0, y: 0 },
								rotate: 0,
							},
							opacity: 1,
							textAnimations: {
								in: { type: "fade-in", duration: 0.5, intensity: 1 },
							},
						},
					],
				},
			],
			bookmarks: [],
			createdAt: "2024-07-02T10:00:00.000Z",
			updatedAt: "2024-07-02T14:00:00.000Z",
		},
	],
};
