"use client";

import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { findContextTag, type ModelEntry } from "@/lib/ai/agent/model-list";
import { useAgentStore } from "@/stores/agent-store";
import {
	type ConnectionTestState,
	sanitizeConnectionError,
	validateAgentEndpoint,
} from "@/lib/ai/agent/endpoint-validation";
import { testAgentConnection } from "@/lib/ai/agent/test-connection";
import {
	Add01Icon,
	Alert02Icon,
	CheckmarkCircle02Icon,
	Cancel01Icon,
	Delete02Icon,
	PencilEdit01Icon,
	RefreshIcon,
	ViewIcon,
	ViewOffSlashIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/utils/ui";

function ModelRow({ entry }: { entry: ModelEntry }) {
	const { t } = useTranslation();
	const [editing, setEditing] = useState(false);
	const [draftId, setDraftId] = useState(entry.id);
	const [draftContext, setDraftContext] = useState<string>(
		entry.contextWindow ? String(entry.contextWindow) : "",
	);
	const activeModel = useAgentStore((s) => s.config.model);
	const setConfig = useAgentStore((s) => s.setConfig);
	const upsertModel = useAgentStore((s) => s.upsertModel);
	const removeModel = useAgentStore((s) => s.removeModel);
	const isActive = activeModel.trim() === entry.id;

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
			<button
				type="button"
				className={cn(
					"flex min-w-0 flex-1 items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-left font-mono text-xs",
					isActive
						? "bg-primary/10 text-primary font-medium"
						: "hover:bg-accent hover:text-accent-foreground",
				)}
				onClick={() => setConfig({ model: entry.id })}
				title={t("Use this model")}
				aria-pressed={isActive}
			>
				<span
					className={cn(
						"size-1.5 shrink-0 rounded-full",
						isActive ? "bg-primary" : "bg-transparent",
					)}
					aria-hidden="true"
				/>
				<span className="truncate">{entry.id}</span>
			</button>
			<Badge variant="secondary" className="text-[10px] whitespace-nowrap">
				{findContextTag({ entry })}
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
	const forgetApiKey = useAgentStore((s) => s.forgetApiKey);
	const setAutoMode = useAgentStore((s) => s.setAutoMode);
	const modelList = useAgentStore((s) => s.modelList);
	const modelFetchStatus = useAgentStore((s) => s.modelFetchStatus);
	const modelFetchError = useAgentStore((s) => s.modelFetchError);
	const fetchModels = useAgentStore((s) => s.fetchModels);
	const upsertModel = useAgentStore((s) => s.upsertModel);

	const [showApiKey, setShowApiKey] = useState(false);
	const [isTesting, setIsTesting] = useState(false);
	const [testStatus, setTestStatus] = useState<{
		state: ConnectionTestState;
		message: string;
	} | null>(null);

	const abortRef = useRef<AbortController | null>(null);

	useEffect(() => {
		return () => {
			abortRef.current?.abort();
		};
	}, []);

	const endpointValidation = validateAgentEndpoint(config.baseUrl);

	const handleTestConnection = async () => {
		if (isTesting) return;
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		setIsTesting(true);
		setTestStatus(null);

		try {
			const result = await testAgentConnection({
				config,
				signal: controller.signal,
			});
			setTestStatus(result);
		} catch (error) {
			if (controller.signal.aborted) return;
			setTestStatus(sanitizeConnectionError(error, config.apiKey));
		} finally {
			if (!controller.signal.aborted) {
				setIsTesting(false);
			}
		}
	};

	const handleForgetKey = () => {
		forgetApiKey();
		setTestStatus(null);
	};

	const addModel = () => {
		upsertModel({ id: `custom-${Date.now().toString(36)}` });
	};

	const apiFormat = config.apiFormat ?? "openai";

	return (
		<div className="space-y-6">
			{/* AI Agent Provider Hierarchy */}
			<div className="space-y-4">
				<h3 className="text-foreground text-xs font-semibold uppercase tracking-wider">
					{t("AI Agent Provider")}
				</h3>

				<div className="space-y-2">
					<Label htmlFor="agent-base-url">{t("API Base URL")}</Label>
					<Input
						id="agent-base-url"
						placeholder={
							apiFormat === "anthropic"
								? "https://api.anthropic.com/v1"
								: "https://api.openai.com/v1"
						}
						value={config.baseUrl}
						onChange={(event) => {
							setConfig({ baseUrl: event.target.value });
							setTestStatus(null);
						}}
					/>
					{!endpointValidation.isValid && endpointValidation.error && (
						<p className="text-destructive text-xs">
							{t(endpointValidation.error)}
						</p>
					)}
				</div>

				<div className="space-y-2">
					<Label htmlFor="agent-api-format">{t("API format")}</Label>
					<Select
						value={apiFormat}
						onValueChange={(value) => {
							setConfig({
								apiFormat: value === "anthropic" ? "anthropic" : "openai",
							});
							setTestStatus(null);
						}}
					>
						<SelectTrigger id="agent-api-format" className="h-9 text-sm">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="openai" className="text-xs">
								{t("OpenAI chat completions (/chat/completions)")}
							</SelectItem>
							<SelectItem value="anthropic" className="text-xs">
								{t("Anthropic messages (/v1/messages)")}
							</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-2">
					<Label htmlFor="agent-api-key">{t("API Key")}</Label>
					<div className="relative flex items-center">
						<Input
							id="agent-api-key"
							type={showApiKey ? "text" : "password"}
							placeholder="sk-..."
							value={config.apiKey}
							onChange={(event) => {
								setConfig({ apiKey: event.target.value });
								setTestStatus(null);
							}}
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
							onClick={() => setShowApiKey((prev) => !prev)}
							title={showApiKey ? t("Hide API key") : t("Show API key")}
							aria-label={showApiKey ? t("Hide API key") : t("Show API key")}
						>
							<HugeiconsIcon
								icon={showApiKey ? ViewOffSlashIcon : ViewIcon}
								className="h-4 w-4"
							/>
						</Button>
					</div>
					<p className="text-muted-foreground text-xs leading-relaxed">
						{t("Kept for this browser session only.")}{" "}
						{t("It will not be saved permanently by Editkub.")}
					</p>
				</div>

				<div className="space-y-1">
					<span className="text-muted-foreground text-xs">
						{t("Requests will be sent to:")}
					</span>
					<p className="text-foreground font-mono text-xs font-medium break-all">
						{endpointValidation.hostname || "api.openai.com"}
					</p>
				</div>

				{endpointValidation.isCustom && endpointValidation.isValid && (
					<div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
						{t(
							"Your API key will be sent to this custom endpoint. Only continue if you trust it.",
						)}
					</div>
				)}

				<div className="flex flex-wrap items-center gap-2 pt-1">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-8 text-xs"
						onClick={handleTestConnection}
						disabled={
							isTesting || !config.apiKey || !endpointValidation.isValid
						}
					>
						{isTesting ? t("Testing…") : t("Test connection")}
					</Button>
					{Boolean(config.apiKey) && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="text-muted-foreground hover:text-destructive h-8 text-xs"
							onClick={handleForgetKey}
						>
							{t("Forget key")}
						</Button>
					)}
				</div>

				{testStatus && (
					<div
						className={cn(
							"flex items-center gap-1.5 text-xs",
							testStatus.state === "connected"
								? "text-green-600 dark:text-green-400"
								: "text-destructive",
						)}
						role="status"
						aria-live="polite"
					>
						<HugeiconsIcon
							icon={
								testStatus.state === "connected"
									? CheckmarkCircle02Icon
									: Alert02Icon
							}
							className="h-4 w-4 shrink-0"
						/>
						<span>{t(testStatus.message)}</span>
					</div>
				)}
			</div>

			<div className="border-foreground/10 space-y-4 border-t pt-4">
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label>{t("Model list")}</Label>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-7 text-xs"
							onClick={() => void fetchModels()}
							disabled={
								!config.apiKey ||
								!endpointValidation.isValid ||
								modelFetchStatus === "loading"
							}
						>
							<HugeiconsIcon icon={RefreshIcon} className="mr-1 h-3.5 w-3.5" />
							{modelFetchStatus === "loading"
								? t("Loading...")
								: t("Fetch from API")}
						</Button>
					</div>
					<p className="text-muted-foreground text-xs">
						{t("Click a model to use it with the agent.")}
					</p>
					<div className="divide-y rounded-lg border">
						{modelList.length === 0 ? (
							<p className="text-muted-foreground p-3 text-xs">
								{t(
									"No models yet. Fetch them from your API or add one manually.",
								)}
							</p>
						) : (
							modelList.map((entry) => (
								<ModelRow key={entry.id} entry={entry} />
							))
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
		</div>
	);
}
