import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { CTASection } from "@/components/landing/cta-section";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
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

				<CTASection />
			</main>
			<Footer />
		</div>
	);
}
