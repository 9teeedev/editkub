"use client";

import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

export interface ComparisonFaqItem {
	question: string;
	answer: string;
	sourceQuote?: string;
	sourceUrl?: string;
	sourceLabel?: string;
}

export function useComparisonFaqItems(): ComparisonFaqItem[] {
	const { t } = useTranslation();

	return [
		{
			question: t("Is Editkub a good alternative to CapCut?"),
			answer: t(
				"Yes. Editkub is designed as a free, open-source, privacy-first alternative to CapCut. It offers AI-native editing, multi-track timeline, MP4/WebM export, and runs entirely in your browser — no account, no uploads, no watermarks.",
			),
		},
		{
			question: t("Does Editkub have the same features as CapCut?"),
			answer: t(
				"Editkub covers the core editing features most creators need: multi-track timeline, text and sticker overlays, AI image generation, audio transcription, and caption generation. CapCut offers additional advanced features like effects templates and more export formats, but Editkub is rapidly growing as an open-source project.",
			),
		},
		{
			question: t("Is Editkub really free with no watermarks?"),
			answer: t(
				"Yes. Editkub is 100% free with no premium tiers, no subscriptions, and no watermarks on exported videos. It is open-source software that you can use without any restrictions.",
			),
		},
		{
			question: t("Does CapCut upload my videos to servers?"),
			answer: t(
				"Yes. CapCut requires uploading your media files to remote servers for processing and storage. Editkub takes the opposite approach — all media processing happens locally in your browser and your files never leave your device.",
			),
			sourceQuote: t(
				'"We may collect User Content through pre-uploading at the time of creation, import, or upload, regardless of whether you choose to save or publish that User Content."',
			),
			sourceUrl: "https://www.capcut.net/clause/privacy",
			sourceLabel: t(
				"CapCut Privacy Policy, Section I — Information We Collect",
			),
		},
		{
			question: t("Can I use Editkub without creating an account?"),
			answer: t(
				"Yes. Editkub requires no sign-up or login. Just open the website and start editing immediately. Your projects are saved locally in your browser.",
			),
		},
		{
			question: t("Is Editkub open source?"),
			answer: t(
				"Yes. Editkub is fully open source and available on GitHub. You can inspect the code, contribute, fork it, or self-host it on your own server.",
			),
		},
		{
			question: t(
				"What AI features does Editkub offer compared to CapCut?",
			),
			answer: t(
				"Editkub is AI-native with a built-in AI agent that can edit videos from natural language prompts, AI image generation for creating visuals, and audio transcription for automatic caption generation. These features are integrated into the core editing workflow.",
			),
		},
		{
			question: t("Can I use Editkub on a Chromebook?"),
			answer: t(
				"Yes. Editkub runs entirely in your browser and works on any platform including Chromebooks, shared computers, and tablets — no installation or plugins required.",
			),
		},
	];
}

export function ComparisonFAQ() {
	const { t } = useTranslation();
	const faqItems = useComparisonFaqItems();

	return (
		<section className="flex flex-col gap-4">
			<h2 className="text-2xl font-semibold">
				{t("Frequently asked questions")}
			</h2>
			<Accordion type="single" collapsible className="w-full">
				{faqItems.map((item, index) => (
					<AccordionItem key={item.question} value={`faq-${index}`}>
						<AccordionTrigger className="text-left text-base font-medium">
							{item.question}
						</AccordionTrigger>
					<AccordionContent className="text-muted-foreground text-sm leading-relaxed">
						<p>{item.answer}</p>
						{item.sourceQuote && (
							<blockquote className="mt-3 border-l-2 border-blue-400 pl-3 text-xs italic opacity-80">
								<p>{item.sourceQuote}</p>
								{item.sourceUrl && (
									<cite className="mt-1 block not-italic">
										{"— "}
										<a
											href={item.sourceUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="text-blue-500 hover:underline"
										>
											{item.sourceLabel}
										</a>
									</cite>
								)}
							</blockquote>
						)}
					</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</section>
	);
}
