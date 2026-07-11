"use client";

import { Button } from "../ui/button";
import { ArrowRight, Play } from "lucide-react";
import { Link } from "@/lib/navigation";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { Background } from "../ui/background";

export function Hero() {
	const { t } = useTranslation();

	return (
		<section className="relative w-full overflow-hidden">
			<Background
				className="absolute inset-0"
				interactive={true}
				pointerTrail={true}
				resolution={0.06}
				fieldOpacity={0.16}
				strength={1.35}
				reactivity={0.28}
				speed={1}
				characterPalette="detailed"
			/>
			<div className="relative z-10 flex flex-col items-start gap-4 md:gap-5 px-6 md:px-12 py-12 md:py-20 text-left max-w-5xl pointer-events-none">
				<div className="flex flex-col gap-4">
					<h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight max-w-3xl leading-[1.15] bg-gradient-to-br from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
						{t('Edit videos,')}{" "}
						<span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
							{t('right in your browser')}
						</span>
					</h1>
					<p className="text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
						{t('An AI-native, open-source video editor and free alternative to CapCut. No uploads, no tracking — your media stays on your device.')}
					</p>
				</div>

				<div className="flex items-center gap-3.5 flex-wrap pt-2 pointer-events-auto">
					<Link href="/projects">
						<Button
							variant="default"
							type="button"
							size="lg"
							className="h-11 px-6 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 gap-2 text-sm"
						>
							<Play className="size-4" />
							{t('Start editing')}
						</Button>
					</Link>
					<Link href="/why-not-capcut">
						<Button
							variant="outline"
							type="button"
							size="lg"
							className="h-11 px-6 font-medium border-border/50 hover:border-border hover:bg-muted/50 transition-all duration-200 gap-2 text-sm"
						>
							{t('Why not CapCut?')}
							<ArrowRight className="size-4" />
						</Button>
					</Link>
				</div>
			</div>
		</section>
	);
}
