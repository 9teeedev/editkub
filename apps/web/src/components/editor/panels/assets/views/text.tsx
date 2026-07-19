"use client";

import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { useState, type CSSProperties } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DraggableItem } from "@/components/editor/panels/assets/draggable-item";
import { useEditor } from "@/hooks/use-editor";
import { DEFAULT_TEXT_ELEMENT } from "@/constants/text-constants";
import { buildTextElement } from "@/lib/timeline/element-utils";
import {
	TEXT_TEMPLATES,
	TEXT_TEMPLATE_CATEGORIES,
	TEXT_TEMPLATE_CATEGORY_LABELS,
	type TextTemplate,
	type TextTemplateCategory,
} from "@/constants/text-template-constants";
import { cn } from "@/utils/ui";
import { toast } from "sonner";

export function TextView() {
	const { t } = useTranslation();
	const [mode, setMode] = useState<"default" | "templates">("default");

	return (
		<div className="flex h-full flex-col">
			<div className="border-b px-4 pt-3 pb-2">
				<div className="mb-2 flex gap-1">
					<ModePill
						label={t("Default")}
						isActive={mode === "default"}
						onClick={() => setMode("default")}
					/>
					<ModePill
						label={t("Templates")}
						isActive={mode === "templates"}
						onClick={() => setMode("templates")}
					/>
				</div>
			</div>
			{mode === "default" ? <DefaultTextSection /> : <TemplatesSection />}
		</div>
	);
}

function DefaultTextSection() {
	const { t } = useTranslation();
	const editor = useEditor();

	const handleAddDefaultText = ({
		currentTime,
	}: {
		currentTime: number;
	}) => {
		const activeScene = editor.scenes.getActiveScene();
		if (!activeScene) return;

		const element = buildTextElement({
			raw: DEFAULT_TEXT_ELEMENT,
			startTime: currentTime,
		});

		editor.timeline.insertElement({
			element,
			placement: { mode: "auto" },
		});
	};

	return (
		<ScrollArea className="flex-1">
			<div className="p-4">
				<DraggableItem
					name={t("Default text")}
					preview={
						<div className="bg-accent flex size-full items-center justify-center rounded">
							<span className="text-xs select-none">{t("Default text")}</span>
						</div>
					}
					dragData={{
						id: "temp-text-id",
						type: DEFAULT_TEXT_ELEMENT.type,
						name: DEFAULT_TEXT_ELEMENT.name,
						content: DEFAULT_TEXT_ELEMENT.content,
					}}
					aspectRatio={1}
					onAddToTimeline={handleAddDefaultText}
					shouldShowLabel={false}
				/>
			</div>
		</ScrollArea>
	);
}

function TemplatesSection() {
	const { t } = useTranslation();
	const [selectedCategory, setSelectedCategory] = useState<
		TextTemplateCategory | "all"
	>("all");

	const filtered =
		selectedCategory === "all"
			? TEXT_TEMPLATES
			: TEXT_TEMPLATES.filter((tp) => tp.category === selectedCategory);

	return (
		<>
			<div className="px-4 pb-2">
				<div className="flex flex-wrap gap-1">
					<CategoryPill
						label={t("All")}
						isActive={selectedCategory === "all"}
						onClick={() => setSelectedCategory("all")}
					/>
					{TEXT_TEMPLATE_CATEGORIES.map((cat) => (
						<CategoryPill
							key={cat}
							label={t(TEXT_TEMPLATE_CATEGORY_LABELS[cat])}
							isActive={selectedCategory === cat}
							onClick={() => setSelectedCategory(cat)}
						/>
					))}
				</div>
			</div>
			<ScrollArea className="flex-1">
				<div className="grid grid-cols-2 gap-2 p-4">
					{filtered.map((tp) => (
						<TemplateCard key={tp.templateId} template={tp} />
					))}
				</div>
			</ScrollArea>
		</>
	);
}

function TemplateCard({ template }: { template: TextTemplate }) {
	const { t } = useTranslation();
	const editor = useEditor();

	const handleAdd = () => {
		const activeScene = editor.scenes.getActiveScene();
		if (!activeScene) return;

		const { templateId: _, category: __, previewText: ___, ...styleProps } =
			template;

		const element = buildTextElement({
			raw: styleProps,
			startTime: editor.playback.getCurrentTime(),
		});

		editor.timeline.insertElement({
			element,
			placement: { mode: "auto" },
		});

		toast.success(t("Added {{name}}", { name: template.name }));
	};

	const dragStyles = getDragStyles(template);

	return (
		<DraggableItem
			name={template.name}
			preview={
				<div
					className={cn(
						"flex size-full min-h-[60px] items-center justify-center rounded p-2",
					)}
					style={getPreviewCss(template)}
				>
					<span
						style={getPreviewTextCss(template)}
						className="text-center text-xs leading-tight"
					>
						{template.previewText}
					</span>
				</div>
			}
			dragData={{
				id: `tpl-${template.templateId}`,
				type: "text" as const,
				name: template.name,
				content: template.content,
				styles: stripTemplateMeta(template),
			}}
			aspectRatio={16 / 9}
			onAddToTimeline={({ currentTime }) => {
				const { templateId: _, category: __, previewText: ___, ...styleProps } =
					template;
				const element = buildTextElement({
					raw: styleProps,
					startTime: currentTime,
				});
				editor.timeline.insertElement({
					element,
					placement: { mode: "auto" },
				});
			}}
			onClick={handleAdd}
			shouldShowLabel={false}
			containerClassName="w-full"
		/>
	);
}

// --- Helpers ---

function stripTemplateMeta(
	template: TextTemplate,
): Record<string, unknown> {
	const { templateId: _, category: __, previewText: ___, ...rest } = template;
	return rest;
}

function getPreviewCss(template: TextTemplate): CSSProperties {
	const style: CSSProperties = {};

	if (
		template.backgroundColor &&
		template.backgroundColor !== "transparent"
	) {
		style.backgroundColor = template.backgroundColor;
	}

	if (template.backgroundBorderRadius) {
		style.borderRadius = template.backgroundBorderRadius;
	}

	if (template.backgroundPaddingX || template.backgroundPaddingY) {
		style.padding = `${template.backgroundPaddingY ?? 4}px ${template.backgroundPaddingX ?? 8}px`;
	}

	return style;
}

function getPreviewTextCss(template: TextTemplate): CSSProperties {
	const style: CSSProperties = {
		color: template.color,
		fontWeight: template.fontWeight === "bold" ? 700 : 400,
		fontStyle: template.fontStyle === "italic" ? "italic" : "normal",
		textDecoration:
			template.textDecoration === "underline"
				? "underline"
				: template.textDecoration === "line-through"
					? "line-through"
					: "none",
	};

	if (template.stroke) {
		const sw = template.stroke.width;
		style.WebkitTextStroke = `${sw}px ${template.stroke.color}`;
	}

	if (template.shadow) {
		style.textShadow = `${template.shadow.offsetX}px ${template.shadow.offsetY}px ${template.shadow.blur}px ${template.shadow.color}`;
	}

	return style;
}

function getDragStyles(template: TextTemplate): Record<string, unknown> {
	return stripTemplateMeta(template);
}

function ModePill({
	label,
	isActive,
	onClick,
}: {
	label: string;
	isActive: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			className={cn(
				"rounded-full px-3 py-1 text-xs font-medium transition-colors",
				isActive
					? "bg-primary text-primary-foreground"
					: "bg-muted text-muted-foreground hover:bg-accent",
			)}
			onClick={onClick}
		>
			{label}
		</button>
	);
}

function CategoryPill({
	label,
	isActive,
	onClick,
}: {
	label: string;
	isActive: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			className={cn(
				"rounded-full px-3 py-1 text-xs font-medium transition-colors",
				isActive
					? "bg-primary text-primary-foreground"
					: "bg-muted text-muted-foreground hover:bg-accent",
			)}
			onClick={onClick}
		>
			{label}
		</button>
	);
}
