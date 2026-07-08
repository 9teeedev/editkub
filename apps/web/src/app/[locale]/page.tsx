import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { FAQSection } from "@/components/landing/faq-section";
import { CTASection } from "@/components/landing/cta-section";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ComparisonTable } from "./why-not-capcut/comparison-table";
import { ComparisonFAQ } from "./why-not-capcut/comparison-faq";
import type { Metadata } from "next";
import { SITE_URL } from "@/constants/site-constants";

export const metadata: Metadata = {
	alternates: { canonical: SITE_URL },
	keywords: [
		"AI video editor",
		"CapCut alternative",
		"open source video editor",
		"privacy-first video editor",
		"browser video editor",
		"free video editor",
	],
};

export default async function Home({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	await params;

	return (
		<div className="relative min-h-screen flex flex-col bg-background">
			<Header />
			<main className="relative flex-1 flex flex-col max-w-7xl w-full mx-auto border-dashed border-l border-r">
				<Hero />
				<Features />

				<section className="flex flex-col gap-8 max-w-5xl mx-auto px-6 py-24 border-t w-full">
					<div className="flex flex-col gap-4">
						<h2 className="text-3xl font-semibold tracking-tight font-heading">
							Why not CapCut?
						</h2>
						<p className="text-muted-foreground leading-relaxed max-w-3xl">
							CapCut is a popular video editor, but it uploads your media to remote
							servers, requires an account, and is closed-source proprietary software.
							Cutia takes a different approach: it runs entirely in your browser, your
							files never leave your device, and the source code is open for anyone to
							inspect.
						</p>
					</div>

					<ComparisonTable />

					<div className="flex flex-col gap-4 mt-8">
						<h2 className="text-2xl font-semibold">Who should use Cutia?</h2>
						<ul className="text-muted-foreground list-disc space-y-2 pl-6 leading-relaxed">
							<li><strong>Privacy-conscious creators</strong> who want their media files to stay on their own device.</li>
							<li><strong>Open-source advocates</strong> who prefer transparent, community-driven software.</li>
							<li><strong>Quick editors</strong> who need a video editor without installing software or creating an account.</li>
							<li><strong>Chromebook and shared-computer users</strong> who need a lightweight browser-based editor.</li>
							<li><strong>AI-first creators</strong> who want built-in AI agent, image generation, and audio transcription.</li>
						</ul>
					</div>

					<ComparisonFAQ />
				</section>

				<CTASection />
			</main>
			<Footer />
		</div>
	);
}
