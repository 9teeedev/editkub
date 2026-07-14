import { SITE_URL, SOCIAL_LINKS } from "@/constants/site-constants";
import { getTranslation } from "@i18next-toolkit/nextjs-approuter/server";

export async function HomepageJsonLd({ locale }: { locale: string }) {
	const { t } = await getTranslation(locale);

	const faqItems = [
		{
			question: t("What is Editkub?"),
			answer: t(
				"Editkub is an AI-native, open-source video editor that runs entirely in your browser. It is a free, privacy-first alternative to CapCut — no installation or sign-up required, just open the website and start editing.",
			),
		},
		{
			question: t("Is Editkub free to use?"),
			answer: t(
				"Yes, Editkub is completely free. It is open-source software licensed under a permissive license. There are no hidden fees, subscriptions, or premium tiers.",
			),
		},
		{
			question: t("Does Editkub upload my files to a server?"),
			answer: t(
				"All your media files and editing operations stay on your device. However, AI-related features (such as AI image generation) may send data to third-party AI services or Editkub's temporary relay server for processing.",
			),
		},
		{
			question: t("What export formats does Editkub support?"),
			answer: t(
				"Editkub supports exporting videos in MP4 and WebM formats with adjustable quality settings (low, medium, high, and very high).",
			),
		},
		{
			question: t("Does Editkub work offline?"),
			answer: t(
				"Editkub runs in your browser and requires an initial page load. Once loaded, most editing features work without an active internet connection since all processing is done locally.",
			),
		},
		{
			question: t("Is Editkub open source?"),
			answer: t(
				"Yes, Editkub is fully open source and community-driven. You can inspect the source code, contribute, or fork it on GitHub.",
			),
		},
		{
			question: t("How is Editkub different from CapCut?"),
			answer: t(
				"Unlike CapCut, Editkub is fully open source and runs entirely in your browser. Your media files stay on your device — only AI features may communicate with external services. Editkub is AI-native with built-in AI agent, image generation, and audio transcription, with no account or subscription required.",
			),
		},
	];

	const webApplicationSchema = {
		"@context": "https://schema.org",
		"@type": "WebApplication",
		name: "Editkub",
		url: SITE_URL,
		description: t(
			"Editkub is an AI-native, open-source video editor that runs entirely in your browser. A free, privacy-first alternative to CapCut with AI-powered editing, multi-track timeline, and MP4/WebM export — no uploads, no tracking.",
		),
		applicationCategory: "MultimediaApplication",
		operatingSystem: "Any (Browser-based)",
		browserRequirements: t(
			"Requires a modern web browser with WebCodecs support",
		),
		offers: {
			"@type": "Offer",
			price: "0",
			priceCurrency: "USD",
		},
		featureList: [
			t("AI-native video editing workflow"),
			t("AI agent for automated video editing"),
			t("AI image generation"),
			t("Audio transcription and caption generation"),
			t("Multi-track video timeline"),
			t("Browser-based video editing"),
			t("Privacy-first local processing"),
			t("MP4 and WebM export"),
			t("Text and sticker overlays"),
			t("Drag-and-drop media import"),
		],
		alternativeFor: "CapCut",
		screenshot: `${SITE_URL}/icon.svg`,
		softwareVersion: "1.0",
		author: {
			"@type": "Organization",
			name: "Editkub",
			url: SITE_URL,
		},
	};

	const organizationSchema = {
		"@context": "https://schema.org",
		"@type": "Organization",
		name: "Editkub",
		url: SITE_URL,
		logo: `${SITE_URL}/logos/editkub/svg/logo.svg`,
		sameAs: [SOCIAL_LINKS.github, "https://x.com/moonrailgun"],
	};

	const faqSchema = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: faqItems.map((item) => ({
			"@type": "Question",
			name: item.question,
			acceptedAnswer: {
				"@type": "Answer",
				text: item.answer,
			},
		})),
	};

	const schemas = [webApplicationSchema, organizationSchema, faqSchema];

	return (
		<>
			{schemas.map((schema, index) => (
				// biome-ignore lint: JSON-LD requires dangerouslySetInnerHTML
				<script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
			))}
		</>
	);
}
