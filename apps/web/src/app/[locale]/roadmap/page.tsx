import type { Metadata } from "next";
import { BasePage } from "@/app/base-page";
import { GitHubContributeSection } from "@/components/gitHub-contribute-section";
import { Badge } from "@/components/ui/badge";
import { ReactMarkdownWrapper } from "@/components/ui/react-markdown-wrapper";
import { cn } from "@/utils/ui";

type StatusType = "complete" | "pending" | "default" | "info";

interface Status {
	text: string;
	type: StatusType;
}

interface RoadmapItem {
	title: string;
	description: string;
	status: Status;
}

interface RoadmapPhase {
	phase: string;
	title: string;
	items: RoadmapItem[];
}

const roadmapPhases: RoadmapPhase[] = [
	{
		phase: "Phase 1",
		title: "Foundation",
		items: [
			{
				title: "Project Bootstrap",
				description:
					"Repository created, Bun monorepo setup, Next.js 16 + Turbopack, i18n (13 languages), dark/light theme, marketing site.",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "Editor Core Architecture",
				description:
					"Singleton `EditorCore` with specialized managers: PlaybackManager, TimelineManager, SceneManager, ProjectManager, MediaManager, RendererManager, AudioManager, SaveManager, SelectionManager.",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "Multi-track Timeline",
				description:
					"Video, audio, text, sticker tracks. Drag-and-drop, resize, trim, split, move, duplicate, delete. Timeline zoom, scroll sync, snapping, edge auto-scroll, selection box, playhead tracking.",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "Undo/Redo System",
				description:
					"Full command pattern: timeline operations (split, move, trim, clipboard paste), scene management (create, delete, rename, bookmark), media (add/remove), track operations (add, remove, reorder, mute, visibility).",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "Scene Management",
				description:
					"Multiple scenes per project, bookmarks, scene reordering, per-scene rendering.",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "Keyboard Shortcuts",
				description:
					"Full keybinding system with actions layer (`ACTIONS` definitions + `invokeAction`). Shortcut help overlay.",
				status: { text: "Completed", type: "complete" },
			},
		],
	},
	{
		phase: "Phase 2",
		title: "Core Editor Features",
		items: [
			{
				title: "Local Export Pipeline",
				description:
					"FFmpeg.wasm + canvas renderer for MP4/WebM export with adjustable quality. Everything runs in-browser — no server uploads.",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "AI Agent",
				description:
					"LLM-powered assistant that can edit timelines via tool calls. System prompt + project tools + AI generation tools. Chat-based interface.",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "AI Image Generation",
				description: "Generate images from text prompts directly in the editor via API route.",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "AI Video Generation",
				description: "Text-to-video generation with async task polling.",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "Text-to-Speech (TTS)",
				description: "Generate voiceover audio from text, insert directly to timeline.",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "Audio Transcription",
				description:
					"Whisper-based transcription via @huggingface/transformers. Auto-generate captions from audio tracks.",
				status: { text: "In progress", type: "pending" },
			},
			{
				title: "Transitions Library",
				description:
					"Transition node system + overlay UI. Basic transitions (fade, slide, dissolve). Expandable transition-constants.",
				status: { text: "In progress", type: "pending" },
			},
			{
				title: "Text & Titles",
				description:
					"Rich text elements with fonts, styles, animations. Title templates and animated text presets.",
				status: { text: "In progress", type: "pending" },
			},
		],
	},
	{
		phase: "Phase 3",
		title: "CapCut Parity — Effects & Polish",
		items: [
			{
				title: "Filters & Color Grading",
				description:
					"Brightness, contrast, saturation, temperature, hue controls. LUT support. Preset filter library (Vintage, Cinematic, Warm, Cool, etc.). Per-clip adjustment layers.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Keyframe Animation",
				description:
					"Animate position, scale, rotation, opacity, and effects over time. Easing curves (linear, ease-in, ease-out, bezier). Keyframe timeline visualization.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Speed Control",
				description:
					"Variable speed (0.25x–4x), speed curves/ramping, freeze frame, reverse playback. Speed graph editor.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Stickers & Emojis",
				description:
					"Animated stickers, emoji library, custom sticker upload. Position/rotate/scale controls. Timeline-based sticker animation.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Picture-in-Picture",
				description:
					"Overlay video clips with draggable resize, rounded corners, border, shadow. PiP presets (split-screen, corner cam).",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Audio Mixing & Ducking",
				description:
					"Multi-track audio levels, pan, fade in/out. Auto-duck background music when voiceover is active. Audio waveform visualization.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Background Removal",
				description:
					"AI-powered background removal (portrait segmentation). Green screen / chroma key support. Replace or blur background.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Auto-Captions",
				description:
					"Auto-detect speech, generate timed subtitle clips, style presets (TikTok-style, broadcast, minimal). Multi-language caption support.",
				status: { text: "Not started", type: "default" },
			},
		],
	},
	{
		phase: "Phase 4",
		title: "Creative Tools & Workflow",
		items: [
			{
				title: "Template System",
				description:
					"Pre-built project templates (vlog, promo, social media, intro/outro). Drag-replace media slots. Community template marketplace.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Advanced Text Animations",
				description:
					"Typewriter, glitch, bounce, slide-in, karaoke-style highlight. Animated text presets library. Per-word timing.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Drawing & Annotation",
				description:
					"Freehand draw on canvas, arrow/shape tools, annotation overlay tracks. Pressure-sensitive stylus support.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Screen Recording",
				description:
					"In-browser screen capture via `getDisplayMedia()`. Record tab, window, or full screen. Direct-to-timeline insert.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Project Collaboration",
				description:
					"Share project files (JSON), import/export project bundles. Real-time multi-user editing (optional, opt-in cloud sync).",
				status: { text: "Not started", type: "default" },
			},
		],
	},
	{
		phase: "Phase 5",
		title: "Platform & Distribution",
		items: [
			{
				title: "Export Presets",
				description:
					"Social media presets: TikTok (9:16), YouTube (16:9), Instagram (1:1, 4:5), Twitter. Auto-crop, safe-zone guides, per-platform bitrate optimization.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Cloud Project Sync (Opt-in)",
				description:
					"Optional encrypted cloud backup. Cross-device project access. Everything stays E2E encrypted — server never sees raw media.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Plugin API",
				description:
					"Third-party effect/transition/filter plugins. Custom AI model integration. WebContainer-based plugin sandbox.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Mobile Responsive Editor",
				description:
					"Touch-optimized timeline, gesture controls (pinch-zoom, swipe-trim). Responsive panel layout for tablets and phones.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "“Edit with Cutia” Badge",
				description:
					"Embeddable web component for video players. Click-to-open Cutia with project pre-loaded. For content platforms and embeds.",
				status: { text: "Not started", type: "default" },
			},
		],
	},
];

export const metadata: Metadata = {
	title: "Roadmap - Cutia",
	description:
		"See what's coming next for Cutia - the free, open-source video editor that respects your privacy.",
	openGraph: {
		title: "Cutia Roadmap - What's Coming Next",
		description:
			"See what's coming next for Cutia - the free, open-source video editor that respects your privacy.",
		type: "website",
		images: [
			{
				url: "/icon.svg",
				width: 512,
				height: 512,
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Cutia Roadmap - What's Coming Next",
		description:
			"See what's coming next for Cutia - the free, open-source video editor that respects your privacy.",
	},
};

export default function RoadmapPage() {
	return (
		<BasePage
			title="Roadmap"
			description="The path to becoming the best free CapCut alternative (last updated: July 2026)"
		>
			<div className="mx-auto flex max-w-4xl flex-col gap-16">
				{roadmapPhases.map((phase) => (
					<div key={phase.phase} className="flex flex-col gap-6">
						<div className="flex items-center gap-3 border-b pb-3">
							<Badge variant="secondary" className="text-xs font-medium">
								{phase.phase}
							</Badge>
							<h2 className="text-xl font-semibold font-heading tracking-tight">
								{phase.title}
							</h2>
						</div>
						<div className="flex flex-col gap-8">
							{phase.items.map((item, index) => (
								<RoadmapItem
									key={`${phase.phase}-${index}`}
									item={item}
									index={index}
								/>
							))}
						</div>
					</div>
				))}

				<GitHubContributeSection
					title="Want to help?"
					description="Cutia is open source and built by the community. Every contribution,
          no matter how small, helps us build the best free video editor
          possible."
				/>
			</div>
		</BasePage>
	);
}

function RoadmapItem({ item, index }: { item: RoadmapItem; index: number }) {
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-2 text-lg font-medium">
				<h3>{item.title}</h3>
				<StatusBadge status={item.status} className="ml-1" />
			</div>
			<div className="text-foreground/70 leading-relaxed">
				<ReactMarkdownWrapper>{item.description}</ReactMarkdownWrapper>
			</div>
		</div>
	);
}

function StatusBadge({
	status,
	className,
}: {
	status: Status;
	className?: string;
}) {
	return (
		<Badge
			className={cn("shadow-none", className, {
				"bg-green-500! text-white": status.type === "complete",
				"bg-yellow-500! text-white": status.type === "pending",
				"bg-blue-500! text-white": status.type === "info",
				"bg-foreground/10! text-accent-foreground": status.type === "default",
			})}
		>
			{status.text}
		</Badge>
	);
}
