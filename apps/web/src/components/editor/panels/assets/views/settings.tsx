"use client";

import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import Image from "next/image";
import { memo, useCallback, useMemo, useState } from "react";
import { PanelBaseView as BaseView } from "@/components/editor/panels/panel-base-view";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	BLUR_INTENSITY_PRESETS,
	CANVAS_SIZE_PRESETS,
	DEFAULT_BLUR_INTENSITY,
	DEFAULT_COLOR,
	FPS_PRESETS,
} from "@/constants/project-constants";
import { patternCraftGradients } from "@/data/colors/pattern-craft";
import { colors } from "@/data/colors/solid";
import { syntaxUIGradients } from "@/data/colors/syntax-ui";
import { useEditor } from "@/hooks/use-editor";
import { IMAGE_PROVIDERS, VIDEO_PROVIDERS } from "@/lib/ai/providers";
import { useAISettingsStore } from "@/stores/ai-settings-store";
import { cn } from "@/utils/ui";
import {
	PropertyGroup,
	PropertyItem,
	PropertyItemLabel,
	PropertyItemValue,
} from "@/components/editor/panels/properties/property-item";
import { isDevPlaceholderAvailable } from "@/lib/ai/placeholder";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTranscriptionSettingsStore } from "@/stores/transcription-settings-store";
import { REMOTE_PROVIDERS } from "@/lib/transcription/providers";
import { ColorPicker } from "@/components/ui/color-picker";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { TBackground } from "@/types/project";

const TRANSPARENT_BACKGROUND =
	"repeating-conic-gradient(#e5e7eb 0% 25%, #9ca3af 0% 50%) 50% / 16px 16px";

export function SettingsView() {
	return <ProjectSettingsTabs />;
}

function ProjectSettingsTabs() {
	const { t } = useTranslation();

	return (
		<BaseView
			defaultTab="project-info"
			tabs={[
				{
					value: "project-info",
					label: t("Project info"),
					content: (
						<div className="p-5">
							<ProjectInfoView />
						</div>
					),
				},
				{
					value: "background",
					label: t("Background"),
					content: (
						<div className="flex h-full flex-col justify-between">
							<div className="flex-1">
								<BackgroundView />
							</div>
						</div>
					),
				},
				{
					value: "ai",
					label: t("AI"),
					content: (
						<div className="p-5">
							<AISettingsView />
						</div>
					),
				},
			]}
			className="flex h-full flex-col justify-between p-0"
		/>
	);
}

const CANVAS_FIT_VALUE = "fit";
const CANVAS_CUSTOM_VALUE = "custom";

function resolveCanvasSizePresetValue({
	width,
	height,
	originalCanvasSize,
}: {
	width: number;
	height: number;
	originalCanvasSize: { width: number; height: number } | null;
}): string {
	const isOriginalMatch =
		originalCanvasSize &&
		originalCanvasSize.width === width &&
		originalCanvasSize.height === height;
	if (isOriginalMatch) {
		return CANVAS_FIT_VALUE;
	}

	for (const preset of CANVAS_SIZE_PRESETS) {
		if (preset.width === width && preset.height === height) {
			return preset.label;
		}
	}

	return CANVAS_CUSTOM_VALUE;
}

function ProjectInfoView() {
	const { t } = useTranslation();
	const editor = useEditor();
	const activeProject = editor.project.getActive();

	const currentCanvasSize = activeProject.settings.canvasSize;
	const originalCanvasSize = activeProject.settings.originalCanvasSize ?? null;

	const selectedValue = resolveCanvasSizePresetValue({
		width: currentCanvasSize.width,
		height: currentCanvasSize.height,
		originalCanvasSize,
	});

	const isCustom = selectedValue === CANVAS_CUSTOM_VALUE;
	const [customWidth, setCustomWidth] = useState(currentCanvasSize.width);
	const [customHeight, setCustomHeight] = useState(currentCanvasSize.height);

	const handleCanvasSizeChange = ({ value }: { value: string }) => {
		if (value === CANVAS_FIT_VALUE) {
			const canvasSize = originalCanvasSize ?? currentCanvasSize;
			editor.project.updateSettings({ settings: { canvasSize } });
			return;
		}

		if (value === CANVAS_CUSTOM_VALUE) {
			setCustomWidth(currentCanvasSize.width);
			setCustomHeight(currentCanvasSize.height);
			return;
		}

		const matched = CANVAS_SIZE_PRESETS.find(
			(preset) => preset.label === value,
		);
		if (matched) {
			editor.project.updateSettings({
				settings: {
					canvasSize: { width: matched.width, height: matched.height },
				},
			});
		}
	};

	const applyCustomSize = ({
		width,
		height,
	}: {
		width: number;
		height: number;
	}) => {
		const clampedWidth = Math.max(1, Math.round(width));
		const clampedHeight = Math.max(1, Math.round(height));
		editor.project.updateSettings({
			settings: { canvasSize: { width: clampedWidth, height: clampedHeight } },
		});
	};

	const handleFpsChange = (value: string) => {
		const fps = parseFloat(value);
		editor.project.updateSettings({ settings: { fps } });
	};

	return (
		<div className="flex flex-col gap-4">
			<PropertyItem direction="column">
				<PropertyItemLabel>{t("Name")}</PropertyItemLabel>
				<PropertyItemValue>{activeProject.metadata.name}</PropertyItemValue>
			</PropertyItem>

			<PropertyItem direction="column">
				<PropertyItemLabel>{t("Canvas size")}</PropertyItemLabel>
				<PropertyItemValue>
					<Select
						value={selectedValue}
						onValueChange={(value) => handleCanvasSizeChange({ value })}
					>
						<SelectTrigger>
							<SelectValue placeholder={t("Select canvas size")} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={CANVAS_FIT_VALUE}>
								{originalCanvasSize
									? t("Fit ({{width}}×{{height}})", {
											width: originalCanvasSize.width,
											height: originalCanvasSize.height,
										})
									: t("Fit")}
							</SelectItem>
							{CANVAS_SIZE_PRESETS.map((preset) => (
								<SelectItem key={preset.label} value={preset.label}>
									{preset.label} ({preset.width}×{preset.height})
								</SelectItem>
							))}
							<SelectItem value={CANVAS_CUSTOM_VALUE}>{t("Custom")}</SelectItem>
						</SelectContent>
					</Select>
				</PropertyItemValue>
			</PropertyItem>

			{isCustom && (
				<div className="flex items-center gap-2">
					<Input
						type="number"
						min={1}
						value={customWidth}
						onChange={(event) => {
							const value = Number(event.target.value);
							setCustomWidth(value);
						}}
						onBlur={() =>
							applyCustomSize({ width: customWidth, height: customHeight })
						}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								applyCustomSize({ width: customWidth, height: customHeight });
							}
						}}
						className="w-0 flex-1"
						aria-label={t("Canvas width")}
					/>
					<span className="text-muted-foreground text-xs">×</span>
					<Input
						type="number"
						min={1}
						value={customHeight}
						onChange={(event) => {
							const value = Number(event.target.value);
							setCustomHeight(value);
						}}
						onBlur={() =>
							applyCustomSize({ width: customWidth, height: customHeight })
						}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								applyCustomSize({ width: customWidth, height: customHeight });
							}
						}}
						className="w-0 flex-1"
						aria-label={t("Canvas height")}
					/>
				</div>
			)}

			<PropertyItem direction="column">
				<PropertyItemLabel>{t("Frame rate")}</PropertyItemLabel>
				<PropertyItemValue>
					<Select
						value={activeProject.settings.fps.toString()}
						onValueChange={handleFpsChange}
					>
						<SelectTrigger>
							<SelectValue placeholder={t("Select a frame rate")} />
						</SelectTrigger>
						<SelectContent>
							{FPS_PRESETS.map((preset) => (
								<SelectItem key={preset.value} value={preset.value}>
									{preset.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</PropertyItemValue>
			</PropertyItem>
		</div>
	);
}

const BlurPreview = memo(
	({
		blur,
		isSelected,
		onSelect,
		t,
	}: {
		blur: { label: string; value: number };
		isSelected: boolean;
		onSelect: () => void;
		t: (key: string, options?: Record<string, string>) => string;
	}) => (
		<button
			className={cn(
				"border-foreground/15 hover:border-primary relative aspect-square size-20 cursor-pointer overflow-hidden rounded-sm border",
				isSelected && "border-primary border-2",
			)}
			onClick={onSelect}
			type="button"
			aria-label={t("Select {{label}} blur", { label: blur.label })}
		>
			<Image
				src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
				alt={`Blur preview ${blur.label}`}
				fill
				className="object-cover"
				style={{ filter: `blur(${blur.value}px)` }}
				loading="eager"
			/>
			<div className="absolute right-1 bottom-1 left-1 text-center">
				<span className="rounded bg-black/50 px-1 text-xs text-white">
					{t(blur.label)}
				</span>
			</div>
		</button>
	),
);

BlurPreview.displayName = "BlurPreview";

const BackgroundPreviews = memo(
	({
		backgrounds,
		currentBackgroundColor,
		isColorBackground,
		handleColorSelect,
		useBackgroundColor = false,
	}: {
		backgrounds: string[];
		currentBackgroundColor: string;
		isColorBackground: boolean;
		handleColorSelect: ({ bg }: { bg: string }) => void;
		useBackgroundColor?: boolean;
	}) => {
		return useMemo(
			() =>
				backgrounds.map((bg, index) => (
					<button
						key={`${index}-${bg}`}
						className={cn(
							"border-foreground/15 hover:border-primary aspect-square size-20 cursor-pointer rounded-sm border",
							isColorBackground &&
								bg === currentBackgroundColor &&
								"border-primary border-2",
						)}
						style={
							useBackgroundColor
								? bg === "transparent"
									? { background: TRANSPARENT_BACKGROUND }
									: { backgroundColor: bg }
								: {
										background: bg,
										backgroundSize: "cover",
										backgroundPosition: "center",
										backgroundRepeat: "no-repeat",
									}
						}
						onClick={() => handleColorSelect({ bg })}
						type="button"
						aria-label={
							useBackgroundColor && bg === "transparent"
								? "Select transparent background"
								: `Select background ${useBackgroundColor ? bg : index + 1}`
						}
					/>
				)),
			[
				backgrounds,
				isColorBackground,
				currentBackgroundColor,
				handleColorSelect,
				useBackgroundColor,
			],
		);
	},
);

BackgroundPreviews.displayName = "BackgroundPreviews";

function BackgroundView() {
	const { t } = useTranslation();
	const editor = useEditor();
	const activeProject = editor.project.getActive();
	const blurLevels = useMemo(() => BLUR_INTENSITY_PRESETS, []);

	const handleBlurSelect = useCallback(
		async ({ blurIntensity }: { blurIntensity: number }) => {
			await editor.project.updateSettings({
				settings: { background: { type: "blur", blurIntensity } },
			});
		},
		[editor.project],
	);

	const handleColorSelect = useCallback(
		async ({ color }: { color: string }) => {
			await editor.project.updateSettings({
				settings: { background: { type: "color", color } },
			});
		},
		[editor.project],
	);

	const handleGradientChange = useCallback(
		async ({ stops, angle }: { stops: [string, string]; angle: number }) => {
			const css = `linear-gradient(${angle}deg, #${stops[0]}, #${stops[1]})`;
			await editor.project.updateSettings({
				settings: { background: { type: "gradient", css, angle, stops } },
			});
		},
		[editor.project],
	);

	const currentBlurIntensity =
		activeProject.settings.background.type === "blur"
			? activeProject.settings.background.blurIntensity
			: DEFAULT_BLUR_INTENSITY;

	const currentBackgroundColor =
		activeProject.settings.background.type === "color"
			? activeProject.settings.background.color
			: DEFAULT_COLOR;

	const isBlurBackground = activeProject.settings.background.type === "blur";
	const isColorBackground = activeProject.settings.background.type === "color";
	const isGradientBackground =
		activeProject.settings.background.type === "gradient";
	const currentGradient =
		activeProject.settings.background.type === "gradient"
			? activeProject.settings.background
			: null;

	const blurPreviews = useMemo(
		() =>
			blurLevels.map((blur) => (
				<BlurPreview
					key={blur.value}
					blur={blur}
					isSelected={isBlurBackground && currentBlurIntensity === blur.value}
					onSelect={() => handleBlurSelect({ blurIntensity: blur.value })}
					t={t}
				/>
			)),
		[blurLevels, isBlurBackground, currentBlurIntensity, handleBlurSelect, t],
	);

	const backgroundSections = [
		{
			title: t("Colors"),
			backgrounds: ["transparent", ...colors],
			useBackgroundColor: true,
		},
		{ title: t("Pattern craft"), backgrounds: patternCraftGradients },
		{ title: t("Syntax UI"), backgrounds: syntaxUIGradients },
	];

	return (
		<div className="flex h-full flex-col">
			<PropertyGroup
				title={t("Custom gradient")}
				hasBorderTop={false}
				defaultExpanded={false}
			>
				<CustomGradientBuilder
					isActive={isGradientBackground}
					current={currentGradient}
					onChange={handleGradientChange}
				/>
			</PropertyGroup>

			<PropertyGroup
				title={t("Blur")}
				hasBorderTop={false}
				defaultExpanded={false}
			>
				<div className="flex flex-wrap gap-2">{blurPreviews}</div>
			</PropertyGroup>

			{backgroundSections.map((section) => (
				<PropertyGroup
					key={section.title}
					title={section.title}
					defaultExpanded={false}
				>
					<div className="flex flex-wrap gap-2">
						<BackgroundPreviews
							backgrounds={section.backgrounds}
							currentBackgroundColor={currentBackgroundColor}
							isColorBackground={isColorBackground}
							handleColorSelect={({ bg }) => handleColorSelect({ color: bg })}
							useBackgroundColor={section.useBackgroundColor}
						/>
					</div>
				</PropertyGroup>
			))}
		</div>
	);
}

const NO_PROVIDER = "__none__";

function AISettingsView() {
	const { t } = useTranslation();
	const {
		imageProviderId,
		imageApiKey,
		videoProviderId,
		videoApiKey,
		devPlaceholderEnabled,
		setImageProvider,
		setImageApiKey,
		clearImageApiKey,
		setVideoProvider,
		setVideoApiKey,
		clearVideoApiKey,
		setDevPlaceholderEnabled,
	} = useAISettingsStore();

	const [showImageKey, setShowImageKey] = useState(false);
	const [showVideoKey, setShowVideoKey] = useState(false);

	const handleImageProviderChange = (value: string) => {
		setImageProvider(value === NO_PROVIDER ? null : value);
	};

	const handleVideoProviderChange = (value: string) => {
		setVideoProvider(value === NO_PROVIDER ? null : value);
	};

	const isImageConfigured = Boolean(imageProviderId && imageApiKey.trim());
	const isVideoConfigured = Boolean(videoProviderId && videoApiKey.trim());

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<span className="text-foreground text-xs font-medium">
						{t("Image Provider")}
					</span>
					<Badge
						variant={isImageConfigured ? "default" : "secondary"}
						className="text-[10px]"
					>
						{isImageConfigured
							? t("Configured for this session")
							: t("Not configured")}
					</Badge>
				</div>
				<PropertyItem direction="column">
					<PropertyItemLabel>{t("Provider")}</PropertyItemLabel>
					<PropertyItemValue>
						<Select
							value={imageProviderId ?? NO_PROVIDER}
							onValueChange={handleImageProviderChange}
						>
							<SelectTrigger>
								<SelectValue placeholder={t("Select a provider")} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NO_PROVIDER}>{t("None")}</SelectItem>
								{IMAGE_PROVIDERS.map((provider) => (
									<SelectItem key={provider.id} value={provider.id}>
										{provider.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</PropertyItemValue>
				</PropertyItem>
				<PropertyItem direction="column">
					<PropertyItemLabel>{t("API Key")}</PropertyItemLabel>
					<PropertyItemValue>
						<div className="relative flex w-full items-center">
							<Input
								type={showImageKey ? "text" : "password"}
								placeholder={t("Enter API key")}
								value={imageApiKey}
								onChange={(event) => setImageApiKey(event.target.value)}
								autoComplete="off"
								autoCorrect="off"
								autoCapitalize="off"
								spellCheck={false}
								className="pr-10"
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="text-muted-foreground hover:text-foreground absolute right-1 h-7 w-7"
								onClick={() => setShowImageKey((prev) => !prev)}
								title={showImageKey ? t("Hide API key") : t("Show API key")}
								aria-label={showImageKey ? t("Hide API key") : t("Show API key")}
							>
								<HugeiconsIcon
									icon={showImageKey ? ViewOffSlashIcon : ViewIcon}
									className="h-4 w-4"
								/>
							</Button>
						</div>
					</PropertyItemValue>
				</PropertyItem>
				<div className="flex flex-col gap-1.5 pt-0.5">
					<p className="text-muted-foreground text-[11px] leading-relaxed">
						{t("Kept for this browser session only.")}{" "}
						{t("It will not be saved permanently by Editkub.")}
					</p>
					<p className="text-muted-foreground/80 text-[11px]">
						{t(
							"API keys are verified upon generation to avoid unnecessary provider charges.",
						)}
					</p>
					{Boolean(imageApiKey) && (
						<div className="pt-1">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-7 text-xs"
								onClick={clearImageApiKey}
							>
								{t("Clear key")}
							</Button>
						</div>
					)}
				</div>
			</div>

			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<span className="text-foreground text-xs font-medium">
						{t("Video Provider")}
					</span>
					<Badge
						variant={isVideoConfigured ? "default" : "secondary"}
						className="text-[10px]"
					>
						{isVideoConfigured
							? t("Configured for this session")
							: t("Not configured")}
					</Badge>
				</div>
				<PropertyItem direction="column">
					<PropertyItemLabel>{t("Provider")}</PropertyItemLabel>
					<PropertyItemValue>
						<Select
							value={videoProviderId ?? NO_PROVIDER}
							onValueChange={handleVideoProviderChange}
						>
							<SelectTrigger>
								<SelectValue placeholder={t("Select a provider")} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NO_PROVIDER}>{t("None")}</SelectItem>
								{VIDEO_PROVIDERS.map((provider) => (
									<SelectItem key={provider.id} value={provider.id}>
										{provider.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</PropertyItemValue>
				</PropertyItem>
				<PropertyItem direction="column">
					<PropertyItemLabel>{t("API Key")}</PropertyItemLabel>
					<PropertyItemValue>
						<div className="relative flex w-full items-center">
							<Input
								type={showVideoKey ? "text" : "password"}
								placeholder={t("Enter API key")}
								value={videoApiKey}
								onChange={(event) => setVideoApiKey(event.target.value)}
								autoComplete="off"
								autoCorrect="off"
								autoCapitalize="off"
								spellCheck={false}
								className="pr-10"
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="text-muted-foreground hover:text-foreground absolute right-1 h-7 w-7"
								onClick={() => setShowVideoKey((prev) => !prev)}
								title={showVideoKey ? t("Hide API key") : t("Show API key")}
								aria-label={showVideoKey ? t("Hide API key") : t("Show API key")}
							>
								<HugeiconsIcon
									icon={showVideoKey ? ViewOffSlashIcon : ViewIcon}
									className="h-4 w-4"
								/>
							</Button>
						</div>
					</PropertyItemValue>
				</PropertyItem>
				<div className="flex flex-col gap-1.5 pt-0.5">
					<p className="text-muted-foreground text-[11px] leading-relaxed">
						{t("Kept for this browser session only.")}{" "}
						{t("It will not be saved permanently by Editkub.")}
					</p>
					<p className="text-muted-foreground/80 text-[11px]">
						{t(
							"API keys are verified upon generation to avoid unnecessary provider charges.",
						)}
					</p>
					{Boolean(videoApiKey) && (
						<div className="pt-1">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-7 text-xs"
								onClick={clearVideoApiKey}
							>
								{t("Clear key")}
							</Button>
						</div>
					)}
				</div>
			</div>

			<div className="border-foreground/10 flex flex-col gap-3 border-t pt-4">
				<span className="text-foreground text-xs font-medium">
					{t("Transcription")}
				</span>
				<TranscriptionSettingsSection />
			</div>

			{isDevPlaceholderAvailable() && (
				<div className="border-foreground/10 flex flex-col gap-3 border-t pt-4">
					<span className="text-foreground text-xs font-medium">
						{t("Development")}
					</span>
					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<Label htmlFor="dev-placeholder-mode">
								{t("Placeholder Mode")}
							</Label>
							<p className="text-muted-foreground text-xs">
								{t(
									"Replace AI generation with placeholder assets to save costs",
								)}
							</p>
						</div>
						<Switch
							id="dev-placeholder-mode"
							checked={devPlaceholderEnabled}
							onCheckedChange={setDevPlaceholderEnabled}
						/>
					</div>
				</div>
			)}
		</div>
	);
}

function TranscriptionSettingsSection() {
	const { t } = useTranslation();
	const {
		providerId,
		apiKey,
		remoteModelId,
		customModelText,
		setProviderId,
		setApiKey,
		setRemoteModelId,
		setCustomModelText,
	} = useTranscriptionSettingsStore();
	const selectedProvider = REMOTE_PROVIDERS.find((p) => p.id === providerId);

	return (
		<div className="flex flex-col gap-3">
			<PropertyItem direction="column">
				<PropertyItemLabel>{t("Provider")}</PropertyItemLabel>
				<PropertyItemValue>
					<Select
						value={providerId}
						onValueChange={(v) => {
							setProviderId(v);
							const p = REMOTE_PROVIDERS.find((x) => x.id === v);
							if (p) setRemoteModelId(p.defaultModelId);
						}}
					>
						<SelectTrigger>
							<SelectValue placeholder={t("Select a provider")} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="local">
								{t("Local (Private — In-browser)")}
							</SelectItem>
							{REMOTE_PROVIDERS.map((p) => (
								<SelectItem key={p.id} value={p.id}>
									{p.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</PropertyItemValue>
			</PropertyItem>
			{selectedProvider && (
				<>
					<PropertyItem direction="column">
						<PropertyItemLabel>{t("Model")}</PropertyItemLabel>
						<PropertyItemValue>
							<Select value={remoteModelId} onValueChange={setRemoteModelId}>
								<SelectTrigger>
									<SelectValue placeholder={t("Select a model")} />
								</SelectTrigger>
								<SelectContent>
									{selectedProvider.models.map((m) => (
										<SelectItem key={m.id} value={m.id}>
											{m.name}
										</SelectItem>
									))}
									{selectedProvider.supportsCustomModel && (
										<SelectItem value="__custom__">{t("Custom…")}</SelectItem>
									)}
								</SelectContent>
							</Select>
						</PropertyItemValue>
					</PropertyItem>
					{selectedProvider.supportsCustomModel &&
						remoteModelId === "__custom__" && (
							<PropertyItem direction="column">
								<PropertyItemLabel>{t("Custom Model")}</PropertyItemLabel>
								<PropertyItemValue>
									<Input
										placeholder={t("Enter model id (e.g. openai/whisper-1)")}
										value={customModelText}
										onChange={(e) => setCustomModelText(e.target.value)}
									/>
								</PropertyItemValue>
							</PropertyItem>
						)}
					<PropertyItem direction="column">
						<PropertyItemLabel>{t("API Key")}</PropertyItemLabel>
						<PropertyItemValue>
							<Input
								type="password"
								placeholder={t("Enter API key")}
								value={apiKey}
								onChange={(e) => setApiKey(e.target.value)}
							/>
						</PropertyItemValue>
					</PropertyItem>
					<a
						href={selectedProvider.apiKeyUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary hover:underline text-xs"
					>
						{t("Get an API key")} →
					</a>
				</>
			)}
		</div>
	);
}

function CustomGradientBuilder({
	isActive,
	current,
	onChange,
}: {
	isActive: boolean;
	current: Extract<TBackground, { type: "gradient" }> | null;
	onChange: (params: { stops: [string, string]; angle: number }) => void;
}) {
	const { t } = useTranslation();
	const stop1 = current?.stops[0] ?? "FF6B6B";
	const stop2 = current?.stops[1] ?? "4ECDC4";
	const angle = current?.angle ?? 135;

	const previewCss = `linear-gradient(${angle}deg, #${stop1}, #${stop2})`;

	return (
		<div className="space-y-3">
			<div
				className="h-12 w-full rounded-sm border"
				style={{ background: previewCss }}
			/>
			<div className="flex items-center justify-between gap-3">
				<ColorPicker
					value={stop1}
					onChange={(hex) => onChange({ stops: [hex, stop2], angle })}
					onChangeEnd={(hex) => onChange({ stops: [hex, stop2], angle })}
				/>
				<ColorPicker
					value={stop2}
					onChange={(hex) => onChange({ stops: [stop1, hex], angle })}
					onChangeEnd={(hex) => onChange({ stops: [stop1, hex], angle })}
				/>
			</div>
			<div className="flex items-center gap-2">
				<span className="text-muted-foreground text-xs">{t("Angle")}</span>
				<Slider
					value={[angle]}
					min={0}
					max={360}
					step={1}
					onValueChange={([v]) => onChange({ stops: [stop1, stop2], angle: v })}
					onValueCommit={([v]) => onChange({ stops: [stop1, stop2], angle: v })}
					className="flex-1"
				/>
				<span className="text-muted-foreground w-10 text-right text-xs">
					{angle}°
				</span>
			</div>
			{!isActive && (
				<p className="text-muted-foreground text-xs">
					{t("Pick two colors to fill empty canvas areas with a gradient.")}
				</p>
			)}
		</div>
	);
}
