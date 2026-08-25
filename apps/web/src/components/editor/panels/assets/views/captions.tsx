"use client";

import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { Button } from "@/components/ui/button";
import { PanelBaseView as BaseView } from "@/components/editor/panels/panel-base-view";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useState, useRef, useEffect } from "react";
import { useLocalStorage } from "@/hooks/storage/use-local-storage";
import { extractTimelineAudio } from "@/lib/media/mediabunny";
import { useEditor } from "@/hooks/use-editor";
import {
	TRANSCRIPTION_LANGUAGES,
	TRANSCRIPTION_MODELS,
	DEFAULT_TRANSCRIPTION_MODEL,
} from "@/constants/transcription-constants";
import {
	CAPTION_FLOW_TEMPLATES,
	DEFAULT_CAPTION_TEMPLATE_ID,
} from "@/constants/caption-templates";
import type {
	TranscriptionLanguage,
	TranscriptionModelId,
	TranscriptionProgress,
	TranscriptionResult,
} from "@/types/transcription";
import type { CaptionFlowStyle, TranscriptData } from "@/types/transcript";
import { transcriptionService } from "@/services/transcription/service";
import { decodeAudioToFloat32 } from "@/lib/media/audio";
import { transcribeRemote } from "@/lib/transcription/remote-transcribe";
import {
	applyGroupTextEdit,
	buildSentenceSegments,
	extractWordsFromSegments,
	joinWordTexts,
	type CaptionGroup,
} from "@/lib/transcript/group-words";
import { getTranscriptCaptionGroups } from "@/lib/transcript/derive-captions";
import { rebuildCaptionTrack } from "@/lib/transcript/sync-captions";
import { useTranscriptStore } from "@/stores/transcript-store";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
	TRANSCRIPTION_PROVIDERS,
	getRemoteProvider,
	isRemoteProvider,
} from "@/lib/transcription/providers";
import { useTranscriptionSettingsStore } from "@/stores/transcription-settings-store";
import { useAssetsPanelStore } from "@/stores/assets-panel-store";
import { Cloud, ShieldCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/utils/ui";

/** m:ss.s timestamp for transcript rows. */
function formatCaptionTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds - m * 60;
	return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

export function Captions() {
	const { t } = useTranslation();
	const editor = useEditor();
	const transcript = useTranscriptStore((s) => s.transcript);
	const [subTab, setSubTab] = useState(transcript ? "text" : "generate");

	// The transcript outlives its derived elements on purpose (it is the
	// source of truth), but when the user deletes the caption track or all
	// of its caption elements the transcript must go with it — otherwise
	// this tab would keep listing text that no longer exists on the
	// timeline. Runs after commit so timeline rebuilds (generation,
	// regrouping) never race the check.
	useEffect(() => {
		if (!transcript?.captionTrackId) return;
		const track = editor.timeline
			.getTracks()
			.find((t) => t.id === transcript.captionTrackId);
		const hasCaptionElements =
			track?.elements.some(
				(element) => element.type === "text" && element.wordTimings,
			) ?? false;
		if (!hasCaptionElements) {
			useTranscriptStore.getState().clear();
		}
	}, [transcript, editor]);

	return (
		<BaseView
			value={subTab}
			onValueChange={setSubTab}
			tabs={[
				{ value: "generate", label: t("Generate"), content: <GenerateCaptionsView onGenerated={() => setSubTab("text")} /> },
				{ value: "text", label: t("Text"), content: <TranscriptTextView onNeedGenerate={() => setSubTab("generate")} /> },
				{ value: "templates", label: t("Templates"), content: <CaptionTemplatesView onNeedGenerate={() => setSubTab("generate")} /> },
			]}
			className="flex h-full flex-col"
		/>
	);
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

function GenerateCaptionsView({ onGenerated }: { onGenerated: () => void }) {
	const { t } = useTranslation();
	const [selectedLanguage, setSelectedLanguage] =
		useLocalStorage<TranscriptionLanguage>({
			key: "editor-caption-language",
			defaultValue: "auto",
		});
	const [selectedModelId, setSelectedModelId] =
		useLocalStorage<TranscriptionModelId>({
			key: "editor-caption-model-id",
			defaultValue: DEFAULT_TRANSCRIPTION_MODEL,
		});
	const [wordsPerGroup, setWordsPerGroup] = useLocalStorage<number>({
		key: "editor-caption-words-per-group",
		defaultValue: 3,
	});
	const [isProcessing, setIsProcessing] = useState(false);
	const [processingStep, setProcessingStep] = useState("");
	const [progressValue, setProgressValue] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const editor = useEditor();

	const {
		providerId,
		apiKey,
		remoteModelId,
		customModelText,
		setProviderId,
		setRemoteModelId,
		setCustomModelText,
	} = useTranscriptionSettingsStore();
	const remoteProvider = getRemoteProvider(providerId);
	const isRemote = isRemoteProvider(providerId);
	const needsApiKey = isRemote && (!apiKey || apiKey.trim().length === 0);
	const setActiveTab = useAssetsPanelStore((s) => s.setActiveTab);
	const effectiveRemoteModel =
		remoteModelId === "__custom__" ? customModelText : remoteModelId;

	const handleProgress = (progress: TranscriptionProgress) => {
		if (progress.status === "loading-model") {
			setProgressValue(progress.progress);
			setProcessingStep(
				t("Loading model {{progress}}%", {
					progress: Math.round(progress.progress),
				}),
			);
		} else if (progress.status === "transcribing") {
			setProgressValue(progress.progress);
			setProcessingStep(
				t("Transcribing {{progress}}%", {
					progress: Math.round(progress.progress),
				}),
			);
		}
	};

	const handleGenerateTranscript = async () => {
		// Validate API key for remote providers before starting
		if (isRemote && needsApiKey) {
			toast.error(
				t("API key required. Add it in Settings → AI → Transcription."),
			);
			setActiveTab("settings");
			return;
		}

		try {
			setIsProcessing(true);
			setError(null);
			setProgressValue(0);
			setProcessingStep(t("Extracting audio..."));

			const audioBlob = await extractTimelineAudio({
				tracks: editor.timeline.getTracks(),
				mediaAssets: editor.media.getAssets(),
				totalDuration: editor.timeline.getTotalDuration(),
			});

			let result: TranscriptionResult;

			if (isRemote && remoteProvider) {
				// Remote (cloud) transcription — decode to 16 kHz mono, then
				// send in 5-min chunks to stay under API size limits and
				// support arbitrarily long clips.
				setProcessingStep(t("Preparing audio..."));
				const { samples } = await decodeAudioToFloat32({
					audioBlob,
					targetSampleRate: 16000,
				});

				setProcessingStep(
					t("Transcribing via {{provider}}...", {
						provider: remoteProvider.name,
					}),
				);
				result = await transcribeRemote({
					provider: remoteProvider,
					samples,
					apiKey,
					model: effectiveRemoteModel,
					language: selectedLanguage,
					wordTimestamps: true,
					onChunkProgress: (done, total) => {
						if (total > 1) {
							setProgressValue(Math.round((done / total) * 100));
							setProcessingStep(
								t("Transcribing {{done}}/{{total}}...", {
									done,
									total,
								}),
							);
						}
					},
				});
			} else {
				// Local (in-browser Whisper) transcription
				setProcessingStep(t("Preparing audio..."));
				const { samples } = await decodeAudioToFloat32({
					audioBlob,
					targetSampleRate: 16000,
				});

				result = await transcriptionService.transcribe({
					audioData: samples,
					language: selectedLanguage,
					modelId: selectedModelId,
					wordTimestamps: true,
					onProgress: handleProgress,
				});
			}

			setProcessingStep(t("Generating captions..."));
			const { words, timing } = extractWordsFromSegments({
				segments: result.segments,
			});
			if (words.length === 0) {
				setError(t("No speech detected in the timeline audio."));
				return;
			}

			const previous = useTranscriptStore.getState().transcript;
			const transcript: TranscriptData = {
				language: result.language,
				createdAt: new Date().toISOString(),
				providerId,
				modelId: isRemote ? effectiveRemoteModel : selectedModelId,
				wordTiming: timing,
				wordsPerGroup,
				templateId: previous?.templateId ?? DEFAULT_CAPTION_TEMPLATE_ID,
				accentColor:
					previous?.accentColor ?? CAPTION_FLOW_TEMPLATES[0].accentColor,
				captionTrackId: previous?.captionTrackId ?? null,
				segments: buildSentenceSegments({ words }),
			};

			const { trackId, count } = rebuildCaptionTrack({
				editor,
				transcript,
			});
			useTranscriptStore.getState().init({
				...transcript,
				captionTrackId: trackId,
			});

			toast.success(
				t("Generated {{count}} captions", { count }),
			);
			onGenerated();
		} catch (error) {
			console.error("Transcription failed:", error);
			setError(
				error instanceof Error
					? error.message
					: t("An unexpected error occurred"),
			);
		} finally {
			setIsProcessing(false);
			setProcessingStep("");
			setProgressValue(0);
		}
	};

	const handleLanguageChange = ({ value }: { value: string }) => {
		if (value === "auto") {
			setSelectedLanguage({ value: "auto" });
			return;
		}

		const matchedLanguage = TRANSCRIPTION_LANGUAGES.find(
			(language) => language.code === value,
		);
		if (!matchedLanguage) return;
		setSelectedLanguage({ value: matchedLanguage.code });
	};

	return (
		<div className="flex flex-col gap-5">
			{/* Provider selection */}
			<div className="flex flex-col gap-3">
				<Label>{t("Provider")}</Label>
				<Select
					value={providerId}
					onValueChange={(value) => {
						setProviderId(value);
						// Set default model for newly selected provider
						const provider = getRemoteProvider(value);
						if (provider) {
							setRemoteModelId(provider.defaultModelId);
						}
					}}
					disabled={isProcessing}
				>
					<SelectTrigger>
						<SelectValue placeholder={t("Select a provider")} />
					</SelectTrigger>
					<SelectContent>
						{TRANSCRIPTION_PROVIDERS.map((provider) => (
							<SelectItem key={provider.id} value={provider.id}>
								{provider.id === "local" ? (
									<span className="flex items-center gap-1.5">
										<ShieldCheck className="h-3.5 w-3.5 text-green-500" />
										{provider.name}
									</span>
								) : (
									<span className="flex items-center gap-1.5">
										<Cloud className="h-3.5 w-3.5 text-blue-500" />
										{provider.name}
									</span>
								)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{isRemote && (
					<div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-2.5">
						<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500" />
						<p className="text-muted-foreground text-xs">
							{t(
								"Cloud providers send your audio to a remote server. Audio is processed by the provider and not stored by us.",
							)}
						</p>
					</div>
				)}
				{isRemote && needsApiKey && (
					<Button
						variant="outline"
						size="sm"
						onClick={() => setActiveTab("settings")}
					>
						{t("Add API key in Settings")}
					</Button>
				)}
			</div>

			{/* Model selection — local models or remote models depending on provider */}
			{isRemote && remoteProvider ? (
				<div className="flex flex-col gap-3">
					<Label>{t("Model")}</Label>
					<Select
						value={remoteModelId}
						onValueChange={(value) => setRemoteModelId(value)}
						disabled={isProcessing}
					>
						<SelectTrigger>
							<SelectValue placeholder={t("Select a model")} />
						</SelectTrigger>
						<SelectContent>
							{remoteProvider.models.map((model) => (
								<SelectItem key={model.id} value={model.id}>
									{model.name}
								</SelectItem>
							))}
							{remoteProvider.supportsCustomModel && (
								<SelectItem value="__custom__">
									{t("Custom…")}
								</SelectItem>
							)}
						</SelectContent>
					</Select>
					{remoteProvider.supportsCustomModel &&
						remoteModelId === "__custom__" && (
							<Input
								placeholder={t("Enter model id (e.g. openai/whisper-1)")}
								value={customModelText}
								onChange={(e) => setCustomModelText(e.target.value)}
							/>
						)}
					<p className="text-muted-foreground text-xs">
						{remoteProvider.name} —{" "}
						{t("Cloud transcription is faster than local.")}
					</p>
				</div>
			) : (
				<div className="flex flex-col gap-3">
					<Label>{t("Model")}</Label>
					<Select
						value={selectedModelId}
						onValueChange={(value) =>
							setSelectedModelId({
								value: value as TranscriptionModelId,
							})
						}
						disabled={isProcessing}
					>
						<SelectTrigger>
							<SelectValue placeholder={t("Select a model")} />
						</SelectTrigger>
						<SelectContent>
							{TRANSCRIPTION_MODELS.map((model) => (
								<SelectItem key={model.id} value={model.id}>
									{model.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p className="text-muted-foreground text-xs">
						{TRANSCRIPTION_MODELS.find((m) => m.id === selectedModelId)
							?.description ?? ""}
					</p>
				</div>
			)}

			<div className="flex flex-col gap-3">
				<Label>{t("Language")}</Label>
				<Select
					value={selectedLanguage}
					onValueChange={(value) => handleLanguageChange({ value })}
				>
					<SelectTrigger>
						<SelectValue placeholder={t("Select a language")} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="auto">{t("Auto detect")}</SelectItem>
						{TRANSCRIPTION_LANGUAGES.map((language) => (
							<SelectItem key={language.code} value={language.code}>
								{language.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="flex flex-col gap-3">
				<Label>{t("Words per display")}</Label>
				<Select
					value={String(wordsPerGroup)}
					onValueChange={(value) => {
						const parsed = Number.parseInt(value, 10);
						if (Number.isNaN(parsed)) return;
						const allowed = Math.min(6, Math.max(1, parsed));
						setWordsPerGroup({ value: allowed });
						updateWordsPerGroup({ editor, wordsPerGroup: allowed });
					}}
					disabled={isProcessing}
				>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{[1, 2, 3, 4, 5, 6].map((count) => (
							<SelectItem key={count} value={String(count)}>
								{count}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<p className="text-muted-foreground text-xs">
					{t("How many words appear on screen at once.")}
				</p>
			</div>

			<div className="flex flex-col gap-4">
				{error && (
					<div className="bg-destructive/10 border-destructive/20 rounded-md border p-3">
						<p className="text-destructive text-sm">{error}</p>
					</div>
				)}

				{isProcessing && (
					<div className="flex flex-col gap-1.5">
						<Progress value={progressValue} className="w-full" />
						<p className="text-muted-foreground text-center text-xs">
							{processingStep}
						</p>
					</div>
				)}

				<Button
					className="w-full"
					type="button"
					onClick={handleGenerateTranscript}
					disabled={isProcessing}
				>
					{isProcessing && <Spinner className="mr-1" />}
					{isProcessing ? t("Processing...") : t("Generate transcript")}
				</Button>
			</div>
		</div>
	);
}

/** Re-group captions live when the words-per-display setting changes. */
function updateWordsPerGroup({
	editor,
	wordsPerGroup,
}: {
	editor: ReturnType<typeof useEditor>;
	wordsPerGroup: number;
}) {
	const transcript = useTranscriptStore.getState().transcript;
	if (!transcript) return;
	const next = { ...transcript, wordsPerGroup };
	useTranscriptStore.getState().init(next);
	rebuildCaptionTrack({ editor, transcript: next });
}

// ---------------------------------------------------------------------------
// Text (transcript list)
// ---------------------------------------------------------------------------

function TranscriptTextView({ onNeedGenerate }: { onNeedGenerate: () => void }) {
	const { t } = useTranslation();
	const editor = useEditor();
	const transcript = useTranscriptStore((s) => s.transcript);

	if (!transcript) {
		return <EmptyTranscriptState onNeedGenerate={onNeedGenerate} />;
	}

	const groups = getTranscriptCaptionGroups({ transcript });
	const currentTime = editor.playback.getCurrentTime();
	const totalWords = transcript.segments.reduce(
		(sum, segment) => sum + segment.words.length,
		0,
	);

	const commitEdit = (group: CaptionGroup, text: string) => {
		const current = useTranscriptStore.getState().transcript;
		if (!current) return;
		const segment = current.segments.find((s) => s.id === group.segmentId);
		if (!segment) return;

		const chunkIndex = Number.parseInt(group.id.split(":")[1] ?? "0", 10);
		const start = chunkIndex * current.wordsPerGroup;
		const replaced = applyGroupTextEdit({
			words: segment.words.slice(start, start + current.wordsPerGroup),
			text,
		});
		// Empty edits are ignored — deleting a caption line via the
		// transcript is not supported yet.
		if (replaced.length === 0) return;

		const words = [
			...segment.words.slice(0, start),
			...replaced,
			...segment.words.slice(start + group.words.length),
		];
		const nextSegment = {
			...segment,
			words,
			text: joinWordTexts(words.map((w) => w.text)),
			start: words[0].start,
			end: words[words.length - 1].end,
		};
		const next = {
			...current,
			segments: current.segments.map((s) =>
				s.id === segment.id ? nextSegment : s,
			),
		};
		useTranscriptStore.getState().init(next);
		rebuildCaptionTrack({ editor, transcript: next });
	};

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between">
				<span className="text-muted-foreground text-xs">
					{t("Total words")}: {totalWords}
				</span>
				<span
					className={cn(
						"rounded-sm border px-1.5 py-0.5 text-[11px]",
						transcript.wordTiming === "precise"
							? "border-green-500/40 text-green-500"
							: "border-yellow-500/40 text-yellow-500",
					)}
				>
					{t("Word timing")}:{" "}
					{transcript.wordTiming === "precise"
						? t("Precise")
						: t("Estimated")}
				</span>
			</div>

			<div className="flex flex-col gap-1.5">
				{groups.map((group, index) => {
					const isActive =
						currentTime >= group.start && currentTime < group.end;
					return (
						<div
							key={group.id}
							className={cn(
								"flex items-start gap-2 rounded-md border p-2",
								isActive
									? "border-secondary-border bg-secondary"
									: "border-transparent hover:bg-secondary/50",
							)}
						>
							<button
								type="button"
								className="text-muted-foreground w-14 shrink-0 pt-1.5 text-left text-[11px] tabular-nums hover:text-foreground"
								onClick={() =>
									editor.playback.seek({ time: group.start })
								}
							>
								{index + 1}
								<br />
								{formatCaptionTime(group.start)}
							</button>
							<TranscriptRowInput
								key={`${group.id}-${transcript.wordsPerGroup}`}
								defaultValue={joinWordTexts(group.words.map((w) => w.text))}
								isActive={isActive}
								onCommit={(text) => commitEdit(group, text)}
							/>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function TranscriptRowInput({
	defaultValue,
	isActive,
	onCommit,
}: {
	defaultValue: string;
	isActive: boolean;
	onCommit: (text: string) => void;
}) {
	const [value, setValue] = useState(defaultValue);
	const initialRef = useRef(defaultValue);

	const commit = () => {
		const trimmed = value.trim();
		if (trimmed !== initialRef.current) {
			onCommit(trimmed);
			initialRef.current = trimmed;
		}
	};

	return (
		<Input
			value={value}
			onChange={(e) => setValue(e.target.value)}
			onBlur={commit}
			onKeyDown={(e) => {
				if (e.key === "Enter") {
					e.currentTarget.blur();
				}
			}}
			className={cn(
				"h-auto min-h-8 border-transparent bg-transparent px-1.5 py-1 text-sm shadow-none focus-visible:border-ring",
				isActive && "text-foreground font-medium",
			)}
		/>
	);
}

function EmptyTranscriptState({ onNeedGenerate }: { onNeedGenerate: () => void }) {
	const { t } = useTranslation();
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
			<p className="text-muted-foreground text-sm">
				{t("No captions yet")}
			</p>
			<Button size="sm" onClick={onNeedGenerate}>
				{t("Generate captions first")}
			</Button>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const ACCENT_PRESETS = [
	"#f97316",
	"#fbbf24",
	"#22d3ee",
	"#f43f5e",
	"#4ade80",
	"#a78bfa",
	"#ffffff",
];

function CaptionTemplatesView({ onNeedGenerate }: { onNeedGenerate: () => void }) {
	const { t } = useTranslation();
	const editor = useEditor();
	const transcript = useTranscriptStore((s) => s.transcript);

	if (!transcript) {
		return <EmptyTranscriptState onNeedGenerate={onNeedGenerate} />;
	}

	const apply = (updates: { templateId?: string; accentColor?: string }) => {
		const current = useTranscriptStore.getState().transcript;
		if (!current) return;
		const next = { ...current, ...updates };
		useTranscriptStore.getState().init(next);
		rebuildCaptionTrack({ editor, transcript: next });
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-2 gap-2">
				{CAPTION_FLOW_TEMPLATES.map((template) => {
					const selected = transcript.templateId === template.templateId;
					return (
						<button
							key={template.templateId}
							type="button"
							onClick={() => apply({ templateId: template.templateId })}
							className={cn(
								"rounded-md border p-3 text-left transition-colors",
								selected
									? "border-secondary-border bg-secondary"
									: "border-border hover:bg-secondary/50",
							)}
						>
							<TemplatePreview
								flow={template.flow}
								accentColor={transcript.accentColor}
							/>
							<p className="mt-2 text-xs font-medium">
								{t(template.templateName)}
							</p>
						</button>
					);
				})}
			</div>

			<div className="flex flex-col gap-2">
				<Label>{t("Accent color")}</Label>
				<div className="flex flex-wrap items-center gap-2">
					{ACCENT_PRESETS.map((color) => (
						<button
							key={color}
							type="button"
							aria-label={color}
							onClick={() => apply({ accentColor: color })}
							className={cn(
								"size-6 rounded-full border-2",
								transcript.accentColor === color
									? "border-foreground"
									: "border-transparent",
							)}
							style={{ backgroundColor: color }}
						/>
					))}
					<input
						type="color"
						value={transcript.accentColor}
						onChange={(e) => apply({ accentColor: e.target.value })}
						className="border-border size-6 cursor-pointer rounded-full border-2 bg-transparent p-0"
						title={t("Accent color")}
					/>
				</div>
			</div>
		</div>
	);
}

/** Static mini preview of a flow applied to a three-word sample. */
function TemplatePreview({
	flow,
	accentColor,
}: {
	flow: CaptionFlowStyle;
	accentColor: string;
}) {
	return (
		<div className="flex items-center justify-center gap-1 rounded-sm bg-black/80 px-2 py-3 text-sm font-bold text-white">
			<span>ตัวอย่าง</span>
			<span
				style={
					flow === "color"
						? { color: accentColor }
						: flow === "box"
							? { boxShadow: `inset 0 0 0 1.5px ${accentColor}`, borderRadius: 3, padding: "0 2px" }
							: flow === "block"
								? { backgroundColor: accentColor, borderRadius: 3, padding: "0 3px" }
								: flow === "fill"
									? {
											backgroundImage: `linear-gradient(90deg, ${accentColor} 50%, #ffffff 50%)`,
											WebkitBackgroundClip: "text",
											backgroundClip: "text",
											color: "transparent",
										}
									: { color: accentColor, transform: "scale(1.15)", display: "inline-block" }
				}
			>
				ซับ
			</span>
			<span>ไตเติล</span>
		</div>
	);
}
