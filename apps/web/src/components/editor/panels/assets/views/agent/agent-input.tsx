"use client";

import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MANAGE_MODELS_VALUE, findContextTag } from "@/lib/ai/agent/model-list";
import type { AgentStatus } from "@/lib/ai/agent/types";
import { validateAgentEndpoint } from "@/lib/ai/agent/endpoint-validation";
import { useAgentStore } from "@/stores/agent-store";
import { ArrowUp02Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AgentContextRing } from "./agent-context-ring";

interface AgentInputProps {
	status: AgentStatus;
	onSend: (message: string) => void;
	onCancel: () => void;
	onOpenSettings: () => void;
}

export function AgentInput({
	status,
	onSend,
	onCancel,
	onOpenSettings,
}: AgentInputProps) {
	const { t } = useTranslation();
	const [input, setInput] = useState("");
	const config = useAgentStore((s) => s.config);
	const setConfig = useAgentStore((s) => s.setConfig);
	const modelList = useAgentStore((s) => s.modelList);
	const fetchModels = useAgentStore((s) => s.fetchModels);
	const modelFetchStatus = useAgentStore((s) => s.modelFetchStatus);
	const isBusy = status !== "idle" && status !== "error";

	const model = config.model.trim();
	const modelInList = modelList.some((entry) => entry.id === model);
	const hasList = modelList.length > 0;

	const endpointValidation = validateAgentEndpoint(config.baseUrl);
	const isConfigValid = endpointValidation.isValid && Boolean(config.apiKey);

	const handleModelChange = useCallback(
		(value: string) => {
			if (value === MANAGE_MODELS_VALUE) {
				onOpenSettings();
				return;
			}
			setConfig({ model: value });
		},
		[onOpenSettings, setConfig],
	);

	const handleSelectOpenChange = useCallback(
		(open: boolean) => {
			// First open with an empty list: pull the model list from the
			// configured endpoint so the dropdown reflects the user's API.
			if (open && !hasList && config.apiKey && endpointValidation.isValid) {
				void fetchModels();
			}
		},
		[config.apiKey, endpointValidation.isValid, fetchModels, hasList],
	);

	const handleSend = useCallback(() => {
		const trimmed = input.trim();
		if (!trimmed || isBusy || !isConfigValid) return;
		onSend(trimmed);
		setInput("");
	}, [input, isBusy, isConfigValid, onSend]);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			if (event.key === "Enter" && !event.shiftKey) {
				event.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	return (
		<div className="border-t p-3">
			<div className="flex gap-2">
				<Textarea
					value={input}
					onChange={(event) => setInput(event.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={t("Describe what you want to create...")}
					className="min-h-[60px] resize-none"
				/>
				<div className="flex flex-col gap-1">
					{isBusy ? (
						<Button
							type="button"
							size="icon"
							variant="destructive"
							onClick={onCancel}
							title={t("Stop")}
						>
							<HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
						</Button>
					) : (
						<Button
							type="button"
							size="icon"
							onClick={handleSend}
							disabled={!input.trim() || !isConfigValid}
							title={t("Send")}
						>
							<HugeiconsIcon icon={ArrowUp02Icon} className="h-4 w-4" />
						</Button>
					)}
				</div>
			</div>
			<div className="mt-2 flex items-center justify-between gap-2">
				<div className="flex min-w-0 flex-1 items-center gap-1">
					<Select
						value={model === "" ? "" : model}
						onValueChange={handleModelChange}
						onOpenChange={handleSelectOpenChange}
					>
						<SelectTrigger className="text-muted-foreground hover:text-foreground h-6 w-auto gap-1 border-none px-1.5 text-xs shadow-none">
							<SelectValue
								placeholder={
									modelFetchStatus === "loading"
										? t("Loading models...")
										: t("Select model")
								}
							/>
						</SelectTrigger>
						<SelectContent>
							{model !== "" && !modelInList && (
								<SelectItem value={model} className="text-xs">
									{model}
								</SelectItem>
							)}
							{modelList.map((entry) => (
								<SelectItem key={entry.id} value={entry.id} className="text-xs">
									<span className="flex items-baseline gap-1.5">
										<span className="truncate">{entry.id}</span>
										<span className="text-muted-foreground text-[10px]">
											{findContextTag({ entry })}
										</span>
									</span>
								</SelectItem>
							))}
							{hasList && (
								<SelectItem value={MANAGE_MODELS_VALUE} className="text-xs">
									{t("Manage models…")}
								</SelectItem>
							)}
						</SelectContent>
					</Select>
					{!hasList && (
						<Input
							className="h-6 min-w-0 flex-1 rounded-md px-2 text-xs"
							value={config.model}
							onChange={(event) => setConfig({ model: event.target.value })}
							placeholder="model-name"
						/>
					)}
				</div>
				<AgentContextRing />
			</div>
		</div>
	);
}
