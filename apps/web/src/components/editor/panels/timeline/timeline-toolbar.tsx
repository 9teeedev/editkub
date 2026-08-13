"use client";

import { useEditor } from "@/hooks/use-editor";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import {
	TooltipProvider,
	Tooltip,
	TooltipTrigger,
	TooltipContent,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Slider } from "@/components/ui/slider";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";
import { sliderToZoom, zoomToSlider } from "@/lib/timeline/zoom-utils";

import { type TActionWithNoArgs, invokeAction } from "@/lib/actions";
import { cn } from "@/utils/ui";
import { useTimelineStore } from "@/stores/timeline-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Bookmark02Icon,
	Delete02Icon,
	SnowIcon,
	ScissorIcon,
	MagnetIcon,
	Link04Icon,
	SearchAddIcon,
	SearchMinusIcon,
	Copy01Icon,
	AlignLeftIcon,
	AlignRightIcon,
	KeyframeAddIcon,
	Mic01Icon,
	MusicNote03Icon,
	AiAudioIcon,
	VoiceIcon,
	StopCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useVoiceoverStore } from "@/stores/voiceover-store";
import { toast } from "sonner";

export function TimelineToolbar({
	zoomLevel,
	minZoom,
	setZoomLevel,
}: {
	zoomLevel: number;
	minZoom: number;
	setZoomLevel: ({ zoom }: { zoom: number }) => void;
}) {
	const handleZoom = ({ direction }: { direction: "in" | "out" }) => {
		const newZoomLevel =
			direction === "in"
				? Math.min(
						TIMELINE_CONSTANTS.ZOOM_MAX,
						zoomLevel * TIMELINE_CONSTANTS.ZOOM_BUTTON_FACTOR,
					)
				: Math.max(minZoom, zoomLevel / TIMELINE_CONSTANTS.ZOOM_BUTTON_FACTOR);
		setZoomLevel({ zoom: newZoomLevel });
	};

	return (
		<ScrollArea className="scrollbar-hidden">
			<div className="flex h-10 items-center justify-between border-b px-2 py-1">
				<ToolbarLeftSection />

				<ToolbarRightSection
					zoomLevel={zoomLevel}
					minZoom={minZoom}
					onZoomChange={(zoom) => setZoomLevel({ zoom })}
					onZoom={handleZoom}
				/>
			</div>
		</ScrollArea>
	);
}

function ToolbarLeftSection() {
	const { t } = useTranslation();
	const editor = useEditor();
	const currentTime = editor.playback.getCurrentTime();
	const currentBookmarked = editor.scenes.isBookmarked({ time: currentTime });
	const voiceoverMode = useVoiceoverStore((s) => s.mode);
	const startCountdown = useVoiceoverStore((s) => s.startCountdown);
	const voiceoverStop = useVoiceoverStore((s) => s.stop);
	const isVoiceoverActive = voiceoverMode !== "idle";

	const handleAction = ({
		action,
		event,
	}: {
		action: TActionWithNoArgs;
		event: React.MouseEvent;
	}) => {
		event.stopPropagation();
		invokeAction(action);
	};

	const handleVoiceoverToggle = () => {
		if (isVoiceoverActive) {
			// Already armed/recording — the overlay's Stop button handles the
			// actual stop. Clicking the toolbar icon cancels the countdown.
			voiceoverStop();
			return;
		}
		// Arm: capture current playhead position, then the overlay takes over.
		const startTime = editor.playback.getCurrentTime();
		const duration = editor.timeline.getTotalDuration();
		if (duration <= 0) {
			toast.error(t("Add a clip to the timeline first"));
			return;
		}
		startCountdown(startTime);
	};

	return (
		<div className="flex items-center gap-1">
			<TooltipProvider delayDuration={500}>
				<ToolbarButton
					icon={<HugeiconsIcon icon={ScissorIcon} />}
					tooltip={t("Split element")}
					onClick={({ event }) => handleAction({ action: "split", event })}
				/>

				<ToolbarButton
					icon={<HugeiconsIcon icon={AlignLeftIcon} />}
					tooltip={t("Split left")}
					onClick={({ event }) => handleAction({ action: "split-left", event })}
				/>

				<ToolbarButton
					icon={<HugeiconsIcon icon={AlignRightIcon} />}
					tooltip={t("Split right")}
					onClick={({ event }) =>
						handleAction({ action: "split-right", event })
					}
				/>

				<ToolbarButton
					icon={<HugeiconsIcon icon={MusicNote03Icon} />}
					tooltip={t("Detach audio")}
					onClick={({ event }) =>
						handleAction({ action: "detach-audio", event })
					}
				/>

				<ToolbarButton
					icon={<HugeiconsIcon icon={AiAudioIcon} />}
					tooltip={t("Enhance voice")}
					onClick={({ event }) =>
						handleAction({ action: "enhance-voice", event })
					}
				/>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							title={t("Voice changer")}
							onMouseDown={(event) => event.preventDefault()}
							className="text-muted-foreground hover:text-foreground hover:bg-accent flex size-7 items-center justify-center rounded-sm transition-colors"
						>
							<HugeiconsIcon icon={VoiceIcon} className="size-4" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" side="bottom">
						<DropdownMenuLabel>{t("Voice changer")}</DropdownMenuLabel>
						<DropdownMenuSeparator />
						{(
							[
								"chipmunk",
								"deep",
								"robot",
								"telephone",
								"alien",
								"echo",
							] as const
						).map((preset) => (
							<DropdownMenuItem
								key={preset}
								onClick={() => invokeAction("change-voice", { preset })}
							>
								{voicePresetLabel(preset, t)}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>

				<ToolbarButton
					icon={<HugeiconsIcon icon={Copy01Icon} />}
					tooltip={t("Duplicate element")}
					onClick={({ event }) =>
						handleAction({ action: "duplicate-selected", event })
					}
				/>

				<ToolbarButton
					icon={<HugeiconsIcon icon={SnowIcon} />}
					tooltip={t("Coming soon")}
					disabled={true}
					onClick={({ event: _event }) => {}}
				/>

				<ToolbarButton
					icon={<HugeiconsIcon icon={Delete02Icon} />}
					tooltip={t("Delete element")}
					onClick={({ event }) =>
						handleAction({ action: "delete-selected", event })
					}
				/>

				<ToolbarButton
					icon={<HugeiconsIcon icon={KeyframeAddIcon} />}
					tooltip={t('Add keyframe at playhead')}
					onClick={({ event }) =>
						handleAction({ action: "add-keyframe-at-playhead", event })
					}
				/>

				<div className="bg-border mx-1 h-6 w-px" />

				<Tooltip>
					<ToolbarButton
						icon={<HugeiconsIcon icon={Bookmark02Icon} />}
						isActive={currentBookmarked}
						tooltip={
							currentBookmarked ? t("Remove bookmark") : t("Add bookmark")
						}
						onClick={({ event }) =>
							handleAction({ action: "toggle-bookmark", event })
						}
					/>
				</Tooltip>

				<div className="bg-border mx-1 h-6 w-px" />

				<ToolbarButton
					icon={
						<HugeiconsIcon
							icon={isVoiceoverActive ? StopCircleIcon : Mic01Icon}
							className={isVoiceoverActive ? "text-red-500" : ""}
						/>
					}
					isActive={isVoiceoverActive}
					tooltip={
						isVoiceoverActive ? t("Cancel voiceover") : t("Record voiceover")
					}
					onClick={() => handleVoiceoverToggle()}
				/>
			</TooltipProvider>
		</div>
	);
}

function ToolbarRightSection({
	zoomLevel,
	minZoom,
	onZoomChange,
	onZoom,
}: {
	zoomLevel: number;
	minZoom: number;
	onZoomChange: (zoom: number) => void;
	onZoom: (options: { direction: "in" | "out" }) => void;
}) {
	const { t } = useTranslation();
	const {
		snappingEnabled,
		rippleEditingEnabled,
		toggleSnapping,
		toggleRippleEditing,
	} = useTimelineStore();

	return (
		<div className="flex items-center gap-1">
			<TooltipProvider delayDuration={500}>
				<ToolbarButton
					icon={<HugeiconsIcon icon={MagnetIcon} />}
					isActive={snappingEnabled}
					tooltip={t("Auto snapping")}
					onClick={() => toggleSnapping()}
				/>

				<ToolbarButton
					icon={<HugeiconsIcon icon={Link04Icon} className="scale-110" />}
					isActive={rippleEditingEnabled}
					tooltip={t("Ripple editing")}
					onClick={() => toggleRippleEditing()}
				/>
			</TooltipProvider>

			<div className="bg-border mx-1 h-6 w-px" />

			<div className="flex items-center gap-1">
				<Button
					variant="text"
					size="icon"
					type="button"
					onClick={() => onZoom({ direction: "out" })}
				>
					<HugeiconsIcon icon={SearchMinusIcon} />
				</Button>
				<Slider
					className="w-28"
					value={[zoomToSlider({ zoomLevel, minZoom })]}
					onValueChange={(values) =>
						onZoomChange(sliderToZoom({ sliderPosition: values[0], minZoom }))
					}
					min={0}
					max={1}
					step={0.005}
				/>
				<Button
					variant="text"
					size="icon"
					type="button"
					onClick={() => onZoom({ direction: "in" })}
				>
					<HugeiconsIcon icon={SearchAddIcon} />
				</Button>
			</div>
		</div>
	);
}

function ToolbarButton({
	icon,
	tooltip,
	onClick,
	disabled,
	isActive,
}: {
	icon: React.ReactNode;
	tooltip: string;
	onClick: ({ event }: { event: React.MouseEvent }) => void;
	disabled?: boolean;
	isActive?: boolean;
}) {
	return (
		<Tooltip delayDuration={200}>
			<TooltipTrigger asChild>
				<Button
					variant={isActive ? "secondary" : "text"}
					size="icon"
					type="button"
					onClick={(event) => onClick({ event })}
					className={cn(
						"rounded-sm",
						disabled ? "cursor-not-allowed opacity-50" : "",
					)}
				>
					{icon}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{tooltip}</TooltipContent>
		</Tooltip>
	);
}

function voicePresetLabel(
	preset: "chipmunk" | "deep" | "robot" | "telephone" | "alien" | "echo",
	t: (key: string) => string,
): string {
	switch (preset) {
		case "chipmunk":
			return t("Chipmunk");
		case "deep":
			return t("Deep");
		case "robot":
			return t("Robot");
		case "telephone":
			return t("Telephone");
		case "alien":
			return t("Alien");
		case "echo":
			return t("Echo");
	}
}
