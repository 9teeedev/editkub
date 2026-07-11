"use client";

import { Link } from "@/lib/navigation";
import { FaGithub } from "react-icons/fa6";
import { SiBuymeacoffee } from "react-icons/si";
import Image from "next/image";
import { DEFAULT_LOGO_URL, SOCIAL_LINKS } from "@/constants/site-constants";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { FeedbackTrigger } from "@/components/feedback/feedback-trigger";

interface FooterLink {
	label: string;
	href: string;
}

const footerLinks: FooterLink[] = [];

export function Footer() {
	const { t } = useTranslation();

	return (
		<footer className="border-t">
			<div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-6 py-8 sm:flex-row sm:justify-between">
				<div className="flex items-center gap-6">
					<Link href="/" className="flex items-center gap-2">
						<Image
							src={DEFAULT_LOGO_URL}
							alt="Editkub"
								width={28}
								height={28}
							className="dark:invert"
						/>
						<span className="text-sm font-semibold">Editkub</span>
					</Link>
					<nav className="flex items-center gap-4">
						{footerLinks.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								className="text-muted-foreground hover:text-foreground text-xs transition-colors"
							>
								{link.label}
							</Link>
						))}
						<FeedbackTrigger>
							<button
								type="button"
								className="text-muted-foreground hover:text-foreground text-xs transition-colors"
							>
								{t("Feedback")}
							</button>
						</FeedbackTrigger>
					</nav>
				</div>

				<div className="flex items-center gap-4">
					<a
						href={SOCIAL_LINKS.github}
							className="text-muted-foreground hover:text-foreground transition-colors"
							target="_blank"
							rel="noopener noreferrer"
							aria-label={t('GitHub')}
						>
							<FaGithub className="size-4" />
						</a>
						<a
							href="https://buymeacoffee.com/9teeedev"
							className="text-muted-foreground hover:text-foreground transition-colors"
							target="_blank"
							rel="noopener noreferrer"
							aria-label={t('Support')}
						>
							<SiBuymeacoffee className="size-4" />
						</a>
					<span className="text-muted-foreground ml-2 text-xs">
						© {new Date().getFullYear()} Editkub
					</span>
				</div>
			</div>
		</footer>
	);
}
