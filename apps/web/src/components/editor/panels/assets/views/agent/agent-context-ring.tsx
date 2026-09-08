"use client";

import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatTokens, getContextWindow } from "@/lib/ai/agent/model-presets";
import { useAgentStore } from "@/stores/agent-store";

const RADIUS = 7;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function AgentContextRing() {
	const { t } = useTranslation();
	const contextTokens = useAgentStore((s) => s.contextTokens);
	const modelList = useAgentStore((s) => s.modelList);
	const model = useAgentStore((s) => s.config.model);

	const trimmedModel = model.trim();
	const entry = modelList.find((item) => item.id === trimmedModel);
	const limit =
		entry?.contextWindow ?? getContextWindow({ model: trimmedModel });
	const fraction = Math.min(1, Math.max(0, contextTokens / limit));
	const percent = Math.round(fraction * 100);

	const colorClass =
		fraction >= 0.9
			? "text-destructive"
			: fraction >= 0.7
				? "text-amber-500"
				: "text-primary";

	return (
		<TooltipProvider delayDuration={200}>
			<Tooltip>
				<TooltipTrigger asChild>
					<span className="text-muted-foreground inline-flex cursor-default items-center">
						<svg viewBox="0 0 18 18" className="h-4 w-4" aria-hidden="true">
							<circle
								cx="9"
								cy="9"
								r={RADIUS}
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
								opacity="0.3"
							/>
							<circle
								cx="9"
								cy="9"
								r={RADIUS}
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
								strokeLinecap="round"
								className={colorClass}
								strokeDasharray={`${(fraction * CIRCUMFERENCE).toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`}
								transform="rotate(-90 9 9)"
							/>
						</svg>
					</span>
				</TooltipTrigger>
				<TooltipContent side="top" sideOffset={6}>
					{t("Context: {{used}} / {{total}} ({{percent}}%)", {
						used: formatTokens(contextTokens),
						total: formatTokens(limit),
						percent,
					})}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
