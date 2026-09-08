"use client";

import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { findContextTag, type ModelEntry } from "@/lib/ai/agent/model-list";
import { useAgentStore } from "@/stores/agent-store";
import {
	Add01Icon,
	CheckmarkCircle02Icon,
	Cancel01Icon,
	Delete02Icon,
	PencilEdit01Icon,
	RefreshIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

function ModelRow({ entry }: { entry: ModelEntry }) {
	const { t } = useTranslation();
	const [editing, setEditing] = useState(false);
	const [draftId, setDraftId] = useState(entry.id);
	const [draftContext, setDraftContext] = useState<string>(
		entry.contextWindow ? String(entry.contextWindow) : "",
	);
	const contextWindow = useAgentStore((s) => s.contextWindow);
	const upsertModel = useAgentStore((s) => s.upsertModel);
	const removeModel = useAgentStore((s) => s.removeModel);

	const startEditing = () => {
		setDraftId(entry.id);
		setDraftContext(entry.contextWindow ? String(entry.contextWindow) : "");
		setEditing(true);
	};

	const saveEdit = () => {
		const id = draftId.trim();
		if (!id) return;
		const parsed = Number(draftContext);
		upsertModel({
			id,
			contextWindow:
				draftContext.trim() !== "" && Number.isFinite(parsed) && parsed > 0
					? parsed
					: undefined,
		});
		if (id !== entry.id) removeModel(entry.id);
		setEditing(false);
	};

	if (editing) {
		return (
			<div className="flex items-center gap-1.5 p-2">
				<Input
					className="h-7 min-w-0 flex-1 px-2 text-xs"
					value={draftId}
					onChange={(event) => setDraftId(event.target.value)}
					placeholder={t("Model name")}
					aria-label={t("Model name")}
				/>
				<Input
					className="h-7 w-24 px-2 text-xs"
					type="number"
					min={1000}
					step={1000}
					value={draftContext}
					onChange={(event) => setDraftContext(event.target.value)}
					placeholder="128000"
					aria-label={t("Context window")}
				/>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-6 w-6"
					onClick={saveEdit}
					disabled={!draftId.trim()}
					title={t("Save")}
				>
					<HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-3.5 w-3.5" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-6 w-6"
					onClick={() => setEditing(false)}
					title={t("Cancel")}
				>
					<HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5" />
				</Button>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-2 p-2">
			<span className="min-w-0 flex-1 truncate font-mono text-xs">
				{entry.id}
			</span>
			<Badge variant="secondary" className="text-[10px] whitespace-nowrap">
				{findContextTag({ entry, fallback: contextWindow })}
			</Badge>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="h-6 w-6 shrink-0"
				onClick={startEditing}
				title={t("Edit model")}
			>
				<HugeiconsIcon icon={PencilEdit01Icon} className="h-3.5 w-3.5" />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="h-6 w-6 shrink-0"
				onClick={() => removeModel(entry.id)}
				title={t("Remove model")}
			>
				<HugeiconsIcon icon={Delete02Icon} className="h-3.5 w-3.5" />
			</Button>
		</div>
	);
}

export function AgentSettings() {
	const { t } = useTranslation();
	const config = useAgentStore((s) => s.config);
	const autoMode = useAgentStore((s) => s.autoMode);
	const setConfig = useAgentStore((s) => s.setConfig);
	const setAutoMode = useAgentStore((s) => s.setAutoMode);
	const contextWindow = useAgentStore((s) => s.contextWindow);
	const setContextWindow = useAgentStore((s) => s.setContextWindow);
	const modelList = useAgentStore((s) => s.modelList);
	const modelFetchStatus = useAgentStore((s) => s.modelFetchStatus);
	const modelFetchError = useAgentStore((s) => s.modelFetchError);
	const fetchModels = useAgentStore((s) => s.fetchModels);
	const upsertModel = useAgentStore((s) => s.upsertModel);

	const addModel = () => {
		upsertModel({ id: `custom-${Date.now().toString(36)}` });
	};

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="agent-base-url">{t("API Base URL")}</Label>
				<Input
					id="agent-base-url"
					placeholder="https://api.openai.com/v1"
					value={config.baseUrl}
					onChange={(event) => setConfig({ baseUrl: event.target.value })}
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="agent-api-key">{t("API Key")}</Label>
				<Input
					id="agent-api-key"
					type="password"
					placeholder="sk-..."
					value={config.apiKey}
					onChange={(event) => setConfig({ apiKey: event.target.value })}
				/>
			</div>

			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label>{t("Model list")}</Label>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-7 text-xs"
						onClick={() => void fetchModels()}
						disabled={!config.apiKey || modelFetchStatus === "loading"}
					>
						<HugeiconsIcon icon={RefreshIcon} className="mr-1 h-3.5 w-3.5" />
						{modelFetchStatus === "loading"
							? t("Loading...")
							: t("Fetch from API")}
					</Button>
				</div>
				<div className="divide-y rounded-lg border">
					{modelList.length === 0 ? (
						<p className="text-muted-foreground p-3 text-xs">
							{t(
								"No models yet. Fetch them from your API or add one manually.",
							)}
						</p>
					) : (
						modelList.map((entry) => <ModelRow key={entry.id} entry={entry} />)
					)}
				</div>
				{modelFetchStatus === "error" && modelFetchError && (
					<p className="text-destructive text-xs">
						{t("Failed to fetch models")}: {modelFetchError}
					</p>
				)}
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-7 text-xs"
					onClick={addModel}
				>
					<HugeiconsIcon icon={Add01Icon} className="mr-1 h-3.5 w-3.5" />
					{t("Add model")}
				</Button>
			</div>

			<div className="space-y-2">
				<Label htmlFor="agent-context-window">{t("Context window")}</Label>
				<Input
					id="agent-context-window"
					type="number"
					min={1000}
					step={1000}
					placeholder="128000"
					value={contextWindow}
					onChange={(event) =>
						setContextWindow(Number(event.target.value) || 0)
					}
				/>
				<p className="text-muted-foreground text-xs">
					{t(
						"Context size used for the indicator when the model is not in the preset list.",
					)}
				</p>
			</div>

			<div className="flex items-center justify-between">
				<div className="space-y-0.5">
					<Label htmlFor="agent-auto-mode">{t("Auto Mode")}</Label>
					<p className="text-muted-foreground text-xs">
						{t("Skip confirmation for AI generation operations")}
					</p>
				</div>
				<Switch
					id="agent-auto-mode"
					checked={autoMode}
					onCheckedChange={setAutoMode}
				/>
			</div>
		</div>
	);
}
