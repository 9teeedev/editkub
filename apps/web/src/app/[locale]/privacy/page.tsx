import type { Metadata } from "next";
import { BasePage } from "@/app/base-page";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { SOCIAL_LINKS } from "@/constants/site-constants";

export const metadata: Metadata = {
	title: "Privacy Policy - Editkub",
	description:
		"Learn how Editkub handles your data and privacy. Our commitment to protecting your information while you edit videos.",
	openGraph: {
		title: "Privacy Policy - Editkub",
		description:
			"Learn how Editkub handles your data and privacy. Our commitment to protecting your information while you edit videos.",
		type: "website",
	},
};

export default function PrivacyPage() {
	return (
		<BasePage
			title="Privacy policy"
			description="Learn how we handle your data and privacy. Transparent, privacy-first video editing."
		>
			<Accordion type="single" collapsible className="w-full">
				<AccordionItem
					value="quick-summary"
					className="rounded-2xl border px-5"
				>
					<AccordionTrigger className="no-underline!">
						Quick summary
					</AccordionTrigger>
					<AccordionContent>
						<h3 className="mb-3 text-lg font-medium">
							Your content stays on your device.
						</h3>
						<ol className="list-decimal space-y-2 pl-6">
							<li>
								Core video editing, audio playback, and rendering happen locally
								in your browser — we never upload or inspect your files.
							</li>
							<li>
								Local captions run entirely in your browser using client-side AI
								models without sending audio over the network.
							</li>
							<li>
								Remote captions are strictly opt-in: audio is sent directly to
								the third-party provider you select (Groq, OpenAI, or
								OpenRouter) using your own API key.
							</li>
							<li>
								No account is required to edit videos, generate local captions,
								or export watermark-free videos.
							</li>
							<li>
								Projects and preferences are stored locally on your device via
								IndexedDB and browser local storage.
							</li>
							<li>
								Product analytics are coarse and privacy-focused — we never collect
								media files, transcripts, project titles, prompts, or API keys.
							</li>
							<li>We do not sell your data or share it with advertisers.</li>
						</ol>
						<p className="mt-4">
							Questions? Contact us via{" "}
							<a
								href={`${SOCIAL_LINKS.github}/issues`}
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary hover:underline"
							>
								GitHub Issues
							</a>
							.
						</p>
					</AccordionContent>
				</AccordionItem>
			</Accordion>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">How We Handle Your Content</h2>
				<p>
					<strong>Local video editing:</strong> All timeline operations, video
					cutting, filters, text rendering, audio mixing, and video exports
					occur locally inside your web browser using WebAssembly (FFmpeg and
					WebCodecs). Your video and audio files never leave your device for
					standard editing or exporting.
				</p>
				<p>
					<strong>Local captions (in-browser):</strong> When using default local
					captions, audio processing and Whisper transcription execute entirely
					within your browser using Transformers.js and Web Workers. No audio
					data or transcripts are uploaded to any server.
				</p>
				<p>
					<strong>Optional remote caption providers:</strong> If you explicitly
					choose a remote cloud provider (such as Groq, OpenAI, or OpenRouter)
					in settings, your browser transmits the audio clip directly to that
					external provider’s API over secure HTTPS using the API key you
					provide. Editkub does not store your API key on our servers, run an
					intermediate decoding proxy, or retain copies of your audio.
					Processing by third-party providers is subject to each provider’s
					respective privacy policy.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">
					Product Analytics & Telemetry
				</h2>
				<p>
					Editkub uses self-hosted Tianji analytics to understand application
					reliability and performance (for example, whether an export succeeded
					or failed, and coarse duration categories).
				</p>
				<p>
					To protect your privacy, analytics events are strictly restricted to
					coarse product metadata. We <strong>never</strong> collect or
					transmit:
				</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>Audio, video, image, or subtitle files</li>
					<li>Project names, file names, or generated media identifiers</li>
					<li>Caption text, transcripts, or user input text</li>
					<li>Media URLs, API keys, tokens, or authorization headers</li>
					<li>
						Personal identifying information or contact details without consent
					</li>
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Local Storage & IndexedDB</h2>
				<p>
					Editkub relies on browser-local storage to function without accounts:
				</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>
						<strong>IndexedDB:</strong> Stores your video projects, media
						assets, and timeline edits locally on your machine.
					</li>
					<li>
						<strong>Local Storage:</strong> Remembers your editor preferences,
						layout settings, and non-intrusive notification cooldowns.
					</li>
				</ul>
				<p>
					All project data remains under your control and can be cleared at any
					time through your browser settings or project management menu.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">
					Optional Accounts & Third-Party Services
				</h2>
				<p>
					Using Editkub does not require an account. If you choose to sign in,
					we use Better Auth for authentication and only store your basic
					profile email for account management. We also use Vercel for hosting
					static web assets.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Open Source Transparency</h2>
				<p>
					Editkub is open source. You can inspect the complete codebase, audit
					our data-handling implementation, and run or self-host your own
					instance:
				</p>
				<p>
					View our source code on{" "}
					<a
						href={SOCIAL_LINKS.github}
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary hover:underline"
					>
						GitHub
					</a>
					.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Contact & Feedback</h2>
				<p>
					If you have questions, privacy concerns, or suggestions, reach out
					through our{" "}
					<a
						href={`${SOCIAL_LINKS.github}/issues`}
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary hover:underline"
					>
						GitHub Issues
					</a>{" "}
					or on{" "}
					<a
						href={SOCIAL_LINKS.x}
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary hover:underline"
					>
						X (Twitter)
					</a>
					.
				</p>
			</section>

			<Separator />

			<p className="text-muted-foreground text-sm">
				Last updated: September 8, 2026
			</p>
		</BasePage>
	);
}
