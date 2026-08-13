"use client";

import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DraggableItem } from "@/components/editor/panels/assets/draggable-item";
import { HugeiconsIcon } from "@hugeicons/react";
import { BlurIcon } from "@hugeicons/core-free-icons";
import { useEditor } from "@/hooks/use-editor";
import { buildBlurEffectElement } from "@/lib/timeline/element-utils";

export function EffectsView() {
	const { t } = useTranslation();
	const editor = useEditor();

	return (
		<div className="flex h-full flex-col">
			<div className="border-b px-4 pt-3 pb-2">
				<h3 className="mb-2 text-sm font-medium">{t("Effects")}</h3>
				<p className="text-muted-foreground text-xs">
					{t("Drag an effect onto the timeline.")}
				</p>
			</div>
			<ScrollArea className="flex-1">
				<div className="grid grid-cols-2 gap-2 p-4">
					<DraggableItem
						name="Blur"
						dragData={{
							id: "blur-effect",
							type: "blur-effect",
							name: "Blur",
							blurIntensity: 50,
						}}
						aspectRatio={16 / 9}
						preview={<BlurPreview />}
						shouldShowLabel={true}
						containerClassName="w-full"
						onAddToTimeline={({ currentTime }) => {
							const element = buildBlurEffectElement({
								startTime: currentTime,
							});
							editor.timeline.insertElement({
								element,
								placement: { mode: "auto" },
							});
						}}
					/>
				</div>
			</ScrollArea>
		</div>
	);
}

function BlurPreview() {
	return (
		<div className="relative size-full">
			<div
				className="size-full rounded-sm"
				style={{
					background:
						"linear-gradient(135deg, #6366f1 0%, #ec4899 50%, #f59e0b 100%)",
				}}
			/>
			<div
				className="absolute inset-0 flex items-center justify-center rounded-sm"
				style={{ backdropFilter: "blur(6px)" }}
			>
				<HugeiconsIcon icon={BlurIcon} className="text-white/80 size-8" />
			</div>
		</div>
	);
}
