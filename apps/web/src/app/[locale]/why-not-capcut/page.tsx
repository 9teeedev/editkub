import type { Metadata } from "next";
import { SITE_URL } from "@/constants/site-constants";
import { BasePage } from "@/app/base-page";
import { ComparisonTable } from "./comparison-table";
import { ComparisonFAQ } from "./comparison-faq";
import { ComparisonJsonLd } from "./json-ld";
import { GitHubContributeSection } from "@/components/gitHub-contribute-section";

export const metadata: Metadata = {
	title: "Why Not CapCut? Editkub vs CapCut Comparison — Editkub",
	description:
		"Compare Editkub and CapCut side by side. Editkub is a free, open-source, privacy-first browser video editor — no uploads, no account, no watermarks. See how it stacks up against CapCut.",
	alternates: {
		canonical: `${SITE_URL}/why-not-capcut`,
	},
	keywords: [
		"Editkub vs CapCut",
		"CapCut alternative",
		"free CapCut alternative",
		"open source CapCut alternative",
		"CapCut privacy concerns",
		"browser video editor vs CapCut",
		"video editor without watermark",
		"video editor no account required",
		"privacy-first video editor",
		"CapCut open source alternative",
	],
	openGraph: {
		title: "Why Not CapCut? Editkub vs CapCut — Side-by-Side Comparison",
		description:
			"Editkub is a free, open-source, privacy-first alternative to CapCut. Compare features, privacy, pricing, and more.",
		url: `${SITE_URL}/why-not-capcut`,
		type: "article",
		images: [
			{
				url: "/icon.svg",
				width: 512,
				height: 512,
				alt: "Editkub — CapCut Alternative",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Why Not CapCut? Editkub vs CapCut Comparison",
		description:
			"Editkub is a free, open-source, privacy-first alternative to CapCut. Compare features, privacy, pricing, and more.",
	},
};

export default async function WhyNotCapcutPage({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;

	return (
		<BasePage
			title="Why not CapCut?"
			description="Editkub is a free, open-source, privacy-first alternative to CapCut. Here's how they compare."
		>
			<ComparisonJsonLd locale={locale} />

			<section className="flex flex-col gap-4">
				<h2 className="text-2xl font-semibold">
					Editkub is a free, open-source video editor that keeps your files on
					your device
				</h2>
				<p className="text-muted-foreground leading-relaxed">
					CapCut is a popular video editor, but it uploads your media to remote
					servers, requires an account, and is closed-source proprietary
					software. Editkub takes a different approach: it runs entirely in your
					browser, your files never leave your device, and the source code is
					open for anyone to inspect. If you care about privacy, freedom, or
					simply want a video editor that works without sign-ups and
					watermarks, Editkub is designed for you.
				</p>
			</section>

			<ComparisonTable />

			<section className="flex flex-col gap-4">
				<h2 className="text-2xl font-semibold">Who should use Editkub?</h2>
				<ul className="text-muted-foreground list-disc space-y-2 pl-6 leading-relaxed">
					<li>
						<strong>Privacy-conscious creators</strong> who want their media
						files to stay on their own device.
					</li>
					<li>
						<strong>Open-source advocates</strong> who prefer transparent,
						community-driven software.
					</li>
					<li>
						<strong>Quick editors</strong> who need a video editor without
						installing software or creating an account.
					</li>
					<li>
						<strong>Chromebook and shared-computer users</strong> who need a
						lightweight browser-based editor.
					</li>
					<li>
						<strong>AI-first creators</strong> who want built-in AI agent,
						image generation, and audio transcription.
					</li>
				</ul>
			</section>

			<ComparisonFAQ />

			<GitHubContributeSection
				title="Built by the community"
				description="Editkub is open source and community-driven. Contribute, report issues, or fork it on GitHub."
			/>
		</BasePage>
	);
}
