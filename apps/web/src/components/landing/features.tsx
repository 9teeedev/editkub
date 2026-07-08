"use client";

import { Shield, Globe, Code2, Sparkles, Layers, MonitorPlay } from "lucide-react";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";

const FeatureCard = ({
	icon: Icon,
	title,
	description,
}: {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	description: string;
}) => (
	<div className="group flex items-center justify-center flex-col gap-4 p-6 rounded-lg hover:bg-muted/30 transition-all duration-200">
		<div className="size-12 rounded-xl bg-muted/50 border border-border/40 flex items-center justify-center group-hover:border-border/60 group-hover:bg-muted transition-all duration-200">
			<Icon className="size-5 text-primary/70" />
		</div>
		<h3 className="font-medium text-base">{title}</h3>
		<p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{description}</p>
	</div>
);

export function Features() {
	const { t } = useTranslation();
	const features = [
		{ icon: Sparkles, title: t("AI-Native"), description: t("AI is built into every step of your workflow. Generate images, transcribe audio, create captions, and let the AI agent edit videos for you.") },
		{ icon: Shield, title: t("Privacy First"), description: t("Your files never leave your device. All processing happens locally in your browser — no uploads, no servers.") },
		{ icon: Globe, title: t("Works Everywhere"), description: t("No installation needed. Open your browser on any platform and start editing right away.") },
		{ icon: Code2, title: t("Open Source"), description: t("Fully open source and community-driven. Inspect the code, contribute, or fork it for your needs.") },
		{ icon: Layers, title: t("Multi-track Timeline"), description: t("Professional timeline with support for video, audio, text, and sticker tracks. Drag, trim, and split with ease.") },
		{ icon: MonitorPlay, title: t("Export Anywhere"), description: t("Export your projects in MP4 or WebM format with adjustable quality settings.") },
	] as const;

	return (
		<section id="features" className="flex flex-col items-center justify-center gap-12 py-24 px-4 w-full border-t">
			<div className="flex items-center justify-center gap-5 flex-col max-w-2xl text-center">
				<h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
					{t("Everything you need to edit")}
				</h2>
				<p className="text-base text-muted-foreground leading-relaxed">
					{t("A focused set of tools designed for clarity and speed. No feature bloat — just what matters.")}
				</p>
			</div>
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl w-full">
				{features.map((f, i) => (
					<div key={i} className="p-4 relative">
						<FeatureCard {...f} />
						{i < features.length - 1 && (
							<div className="absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-border/60 to-transparent sm:hidden" />
						)}
						{i < features.length - 2 && (
							<div className="absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-border/60 to-transparent hidden sm:block lg:hidden" />
						)}
						{i < 3 && (
							<div className="absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-border/60 to-transparent hidden lg:block" />
						)}
						{i % 3 !== 2 && (
							<div className="absolute right-0 top-4 bottom-4 w-[1px] bg-gradient-to-b from-transparent via-border/60 to-transparent hidden lg:block" />
						)}
					</div>
				))}
			</div>
		</section>
	);
}
