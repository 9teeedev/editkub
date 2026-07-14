"use client";

import { useTranslation } from "@i18next-toolkit/nextjs-approuter";

export function useLocalizedFaqItems() {
	const { t } = useTranslation();

	return [
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
}
