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
import { useState, useRef, useMemo } from "react";
import { useLocalStorage } from "@/hooks/storage/use-local-storage";
import { extractTimelineAudio } from "@/lib/media/mediabunny";
import { useEditor } from "@/hooks/use-editor";
import {
	TRANSCRIPTION_LANGUAGES,
	TRANSCRIPTION_MODELS,
	DEFAULT_TRANSCRIPTION_MODEL,
} from "@/constants/transcription-constants";
import {
	SUBTITLE_TEMPLATES,
	createSubtitleFromTemplate,
} from "@/constants/subtitle-constants";
import type {
	TranscriptionLanguage,
	TranscriptionModelId,
	TranscriptionProgress,
	TranscriptionResult,
} from "@/types/transcription";
import { transcriptionService } from "@/services/transcription/service";
import { decodeAudioToFloat32 } from "@/lib/media/audio";
import { transcribeRemote } from "@/lib/transcription/remote-transcribe";
import { buildCaptionChunks } from "@/lib/transcription/caption";
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

export function Captions() {
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
	const [selectedTemplateId, setSelectedTemplateId] = useLocalStorage<string>({
		key: "editor-caption-template-id",
		defaultValue: SUBTITLE_TEMPLATES[0].templateId,
	});
	const selectedTemplate = useMemo(
		() =>
			SUBTITLE_TEMPLATES.find((t) => t.templateId === selectedTemplateId) ??
			SUBTITLE_TEMPLATES[0],
		[selectedTemplateId],
	);
	const [isProcessing, setIsProcessing] = useState(false);
	const [processingStep, setProcessingStep] = useState("");
	const [progressValue, setProgressValue] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const editor = useEditor();

	// Remote provider settings
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
					onProgress: handleProgress,
				});
			}

			if (result.segments.length === 0) {
				setError(t("No speech detected in the timeline audio."));
				return;
			}

			setProcessingStep(t("Generating captions..."));
			const captionChunks = buildCaptionChunks({ segments: result.segments });

			const captionTrackId = editor.timeline.addTrack({
				type: "text",
				index: 0,
			});

			const baseCaptionElement = createSubtitleFromTemplate({
				template: selectedTemplate,
				startTime: 0,
			});

			for (let i = 0; i < captionChunks.length; i++) {
				const caption = captionChunks[i];
				editor.timeline.insertElement({
					placement: { mode: "explicit", trackId: captionTrackId },
					element: {
						...baseCaptionElement,
						name: `Caption ${i + 1}`,
						content: caption.text,
						duration: caption.duration,
						startTime: caption.startTime,
						trimStart: 0,
						trimEnd: 0,
					},
				});
			}

			toast.success(
				t("Generated {{count}} captions", { count: captionChunks.length }),
			);
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

	const handleTemplateChange = ({ value }: { value: string }) => {
		const template = SUBTITLE_TEMPLATES.find(
			(t) => t.templateId === value,
		);
		if (template) {
			setSelectedTemplateId({ value: template.templateId });
		}
	};

	return (
		<BaseView
			ref={containerRef}
			className="flex h-full flex-col justify-between"
		>
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
					<Label>{t("Subtitle Style")}</Label>
					<Select
						value={selectedTemplate.templateId}
						onValueChange={(value) => handleTemplateChange({ value })}
					>
						<SelectTrigger>
							<SelectValue placeholder={t("Select a style")} />
						</SelectTrigger>
						<SelectContent>
							{SUBTITLE_TEMPLATES.map((template) => (
								<SelectItem
									key={template.templateId}
									value={template.templateId}
								>
									{template.templateName}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<div
						className="flex items-center justify-center rounded-md border p-4"
						style={{ backgroundColor: "#1a1a2e", minHeight: 60 }}
					>
						<span
							style={{
								fontSize: 14,
								fontFamily: selectedTemplate.fontFamily,
								color: selectedTemplate.color,
								backgroundColor: selectedTemplate.backgroundColor,
								fontWeight: selectedTemplate.fontWeight,
								fontStyle: selectedTemplate.fontStyle,
								textDecoration: selectedTemplate.textDecoration,
								padding: "2px 6px",
								borderRadius: 2,
							}}
						>
							{t("{{name}} Preview", {
								name: selectedTemplate.templateName,
							})}
						</span>
					</div>
				</div>
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
		</BaseView>
	);
}
