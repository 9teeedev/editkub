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
				description:
					"Generate images from text prompts directly in the editor via API route.",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "AI Video Generation",
				description: "Text-to-video generation with async task polling.",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "Text-to-Speech (TTS)",
				description:
					"Generate voiceover audio from text, insert directly to timeline.",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "Audio Transcription",
				description:
					"Whisper-based transcription via @huggingface/transformers (5 models: Tiny → Large v3 Turbo). Auto-generate captions from audio tracks. Streaming results, progress UI, language auto-detect (9 languages), subtitle style templates.",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "Transitions Library",
				description:
					"12 transition presets across 4 categories (Fade, Wipe, Slide, Zoom). Canvas-based rendering with offscreen compositing. Timeline junction overlays with drag-to-resize duration. Popover picker inline on timeline. Click-to-apply from sidebar panel.",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "Transition & Effect Preview Gallery",
				description:
					"Hover-to-play animated canvas previews in the transitions panel. Static first-frame otherwise. Same compositing logic as the actual transition renderer.",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "Text & Titles",
				description:
					"Full text editing: content textarea, font picker, bold/italic/underline/strikethrough, font size with slider+input, color picker, opacity, stroke (color+width), shadow (color+offsetX+offsetY+blur), background (color+opacity+borderRadius+paddingX+paddingY), transform (position/scale/rotation). 8 subtitle templates (Classic, Modern, Minimal, High Contrast, News, Karaoke, Cinematic, Top Title). Style presets. Canvas renderer with word-wrap. TTS tab integrated.",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "Text Template Library",
				description:
					"Pre-designed text templates: Title cards (Bold, Elegant, Neon), Lower Thirds (News, Accent Bar), End Screens (Subscribe, Thanks), Callouts (Arrow, Badge), Social Handles. Category-filtered gallery with CSS-styled previews. Drag to timeline or click to add. Full style props carried through drag-and-drop.",
				status: { text: "Completed", type: "complete" }
			},
			{
				title: "Sound Effects Library",
				description:
					"Built-in royalty-free SFX library (whoosh, pop, ding, transition sounds, impact, UI sounds). Searchable by category and mood. Drag-to-timeline with auto-trim to clip boundary. Volume + fade controls per SFX.",
				status: { text: "Not started", type: "default" }
			},
			{
				title: "Music & Song Library",
				description:
					"Curated royalty-free music library organized by genre/mood (Lo-fi, Upbeat, Cinematic, Ambient, Electronic, Acoustic). BPM-tagged, loop-ready. Auto-duck under voiceover. Timeline beat-sync markers for rhythmic editing.",
				status: { text: "Not started", type: "default" }
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
					"Preset filter library (Vintage, Cinematic, Warm, Cool, B&W, Film grain, etc.). One-click apply, intensity slider. Filter categories with live preview thumbnails. Import custom LUT files (.cube).",
					status: { text: "Completed", type: "complete" },
			},
			{
				title: "Adjustment Controls",
				description:
					"Per-clip manual adjustment: brightness, contrast, saturation, temperature, tint, hue. Non-destructive — always editable.",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "Vignette & Sharpen",
				description:
					"Per-clip vignette (radial-gradient edge darkening via canvas overlay) and sharpen (3×3 unsharp convolution via SVG filter). Two extra sliders in the Adjustments panel. Non-destructive, undoable.",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "Keyframe Animation",
				description:
					"Animate position, scale, rotation, opacity, and effects over time. Easing curves (linear, ease-in, ease-out, bezier). Keyframe timeline visualization.",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "Speed Control",
				description:
					"Variable speed (0.25x–4x), speed curves/ramping, freeze frame, reverse playback. Speed graph editor.",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "Stickers & Emojis",
				description:
					"Iconify-powered sticker + emoji library (icons, brands, Twemoji, Fluent Emoji). Drag-to-timeline. Position/scale/rotate/opacity/color controls. Keyframe animation on all transform properties.",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "Custom Sticker Upload & Animated Stickers",
				description:
					"User-uploaded custom stickers (PNG/SVG) and animated stickers (Lottie, APNG, animated emoji).",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Picture-in-Picture",
				description:
					"Overlay video clips with draggable resize, rounded corners, border, shadow. PiP presets (split-screen, corner cam).",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Split Screen",
				description:
					"Multi-frame layouts: 2-split (horizontal/vertical), 3-split, 4-grid, custom grid. Drag media into each frame. Adjustable divider positions, per-frame border/gap/rounding. Preset layouts for comparison videos, reactions, before/after.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Overlay & Blend Modes",
				description:
					"Layer compositing with blend modes (Normal, Multiply, Screen, Overlay, Soft Light, Color Dodge, Difference, Exclusion, Hue, Saturation, Color, Luminosity). Opacity control per layer. Blend mode preview thumbnails. Useful for light leaks, film grain, texture overlays, double exposure effects.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Audio Mixing",
				description:
					"Per-clip volume (0-200%) and per-track mute. Audio waveform visualization on timeline clips (WaveSurfer.js).",
				status: { text: "Completed", type: "complete" },
			},
			{
				title: "Pan, Fade & Auto-Duck",
				description:
					"Per-clip stereo pan, fade in/out gain ramps, and auto-ducking (sidechain-lower background music when voiceover is active).",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Background Removal",
				description:
					"AI-powered background removal via on-device portrait segmentation (MODNet, WebGPU). Per-clip toggle removes the background so lower tracks show through. Runs locally — privacy-first. (Chroma key, blur, and background replace are planned.)",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Auto-Captions",
				description:
					"Auto-detect speech, generate timed subtitle clips, style presets (TikTok-style, broadcast, minimal). Multi-language caption support.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Extract Audio from Clip",
				description:
					"Replace the 'Split into equal parts' toolbar action with an Extract Audio action. When a clip is selected in the timeline, the button detaches/separates the audio track from that clip onto its own audio track (non-destructive). Mirrors CapCut's extract-audio flow.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Keyframe Curve Editor",
				description:
					"Per-keyframe easing curve editor. 'Select a keyframe to edit its curve' panel lets the user pick an individual keyframe and adjust its interpolation (linear, ease-in, ease-out, custom bezier) via a visual curve handle editor. Extends the existing Keyframe Animation system.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Quick Add Keyframe Button",
				description:
					"CapCut-style 'Add Keyframe' / 'Mark' button. One click drops a keyframe for the currently selected property at the playhead position on the selected clip. Toolbar-level shortcut for fast animation authoring.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Preview Fit / Zoom Dropdown",
				description:
					"Zoom dropdown on the preview player transport bar: Fit, 25%, 50%, 75%, 100%, 150%, 200%. Controls canvas magnification for precise keyframe/adjustment work without changing the export resolution.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Chroma Key / Green Screen",
				description:
					"WebGL fragment-shader chroma keyer. Pick key color (green/blue/custom) with eyedropper, adjust similarity threshold and spill suppression edge softness. Real-time preview on canvas. Privacy-first — all GPU-local, no server.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Video Effects Library (VFX)",
				description:
					"Time-based overlay effects rendered as WebGL shaders: Glitch, VHS, RGB Split, Shake, Light Leak, Sparkle, Film Burn, Edge Glow. Separate from color filters — these are animated pixel effects. Per-clip intensity and duration. Live thumbnail previews in the effects panel.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Masking",
				description:
					"Shape masks (circle, rectangle, star, gradient, custom path) applied per clip. Invert option, feathered edges, animated mask position via keyframes. Enables advanced split-screen, spotlight, and reveal transitions.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Color Match",
				description:
					"Match one clip's color to another automatically. Histogram-matching algorithm maps the source clip's color distribution to a chosen reference frame. One-click, non-destructive, undoable.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Auto Silence Removal",
				description:
					"Detect and cut silent gaps automatically. Web Audio API analyzes RMS/peak amplitude; segments below a configurable threshold are marked for removal. Optional preview-then-confirm flow before cuts are applied. Great for podcasts, talking-head, and screencasts.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "AI Voice Enhancement & Denoise",
				description:
					"Remove background noise and enhance speech from any clip's audio track. Runs locally via RNNoise (Mozilla's neural denoiser compiled to WASM, ~500KB) — real-time, no cloud. Optional fallback to the browser's built-in WebRTC noise suppression for lower-end devices.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Voice Changer",
				description:
					"Real-time pitch and formant shifting with presets: Robot, Chipmunk, Deep, Echo, Telephone, Alien. Powered by Rubber Band or SoundTouch (WASM builds), all local. Per-clip effect, undoable.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Canvas Background Fill",
				description:
					"Fill empty canvas area (e.g. horizontal video in a vertical project) with blurred copy of the clip, solid color, or gradient. Auto-fit modes for 9:16, 1:1, and 4:5 exports. Essential for repurposing landscape clips to short-form vertical.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Custom Subtitle System",
				description:
					"Full subtitle editor beyond auto-captions: per-word timing control, word-by-word highlight (karaoke style), custom subtitle duration presets (1-word, 2-word, 3-word per display), font/size/color/stroke/ shadow per subtitle, position drag on canvas, SRT/VTT import-export, style presets (TikTok, YouTube, Broadcast, Karaoke).",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Adjustment Layers",
				description:
					"A dedicated adjustment-layer track type whose brightness/contrast/saturation/temperature/tint/hue/vignette/sharpen values affect every visible clip on tracks below during its time span. Non-destructive, draggable, saveable.",
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
				title: "Voiceover Recording",
				description:
					"In-browser microphone capture via `getUserMedia()`. Countdown overlay (3·2·1), real-time playback while recording, optional original-audio monitoring, auto-insert to timeline at playhead.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Project Sharing",
				description:
					"Export/import project bundles (.cutia) — self-contained JSON with embedded media. Share a file, open it anywhere, fully local.",
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
				title: "“Edit with Editkub” Badge",
				description:
					"Embeddable web component for video players. Click-to-open Editkub with project pre-loaded. For content platforms and embeds.",
				status: { text: "Not started", type: "default" },
			},
		],
	},
	{
		phase: "Phase 6",
		title: "Advanced & Experimental",
		items: [
			{
				title: "Motion Tracking",
				description:
					"Track a moving subject through a clip and attach stickers, text, or masks that follow the tracked point. Runs locally via MediaPipe (Google) — WASM + WebGPU, model files bundled in-repo. Heavy on compute and bundle size (~10–20MB models), so treated as optional/experimental.",
				status: { text: "Not started", type: "default" },
			},
			{
				title: "Video Stabilization",
				description:
					"Reduce camera shake by computing frame-to-frame motion and warping frames to smooth it out. Uses OpenCV.js (goodFeaturesToTrack + optical flow + homography), all in-browser. Slow for long clips — may be offered as an export-time pass rather than real-time preview. Optional feature.",
				status: { text: "Not started", type: "default" },
			},
		],
	},
];

export const metadata: Metadata = {
	title: "Roadmap - Editkub",
	description:
		"See what's coming next for Editkub - the free, open-source video editor that respects your privacy.",
	openGraph: {
		title: "Editkub Roadmap - What's Coming Next",
		description:
			"See what's coming next for Editkub - the free, open-source video editor that respects your privacy.",
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
		title: "Editkub Roadmap - What's Coming Next",
		description:
			"See what's coming next for Editkub - the free, open-source video editor that respects your privacy.",
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
					description="Editkub is open source and built by the community. Every contribution,
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
