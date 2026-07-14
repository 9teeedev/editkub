"use client";

import { useState } from "react";
import { Link } from "@/lib/navigation";
import { motion } from "motion/react";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { Button } from "./ui/button";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { ThemeToggle } from "./theme-toggle";
import { LanguageToggle } from "./language-toggle";
import { Menu02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/utils/ui";
import { DEFAULT_LOGO_URL } from "@/constants/site-constants";

export function Header() {
	const { t } = useTranslation();
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const closeMenu = () => setIsMenuOpen(false);

	const links = [
		{
			label: t('Features'),
			href: "#features",
		},
		{
			label: t("Why not CapCut?"),
			href: "/why-not-capcut",
		},
	];

	return (
		<header className="bg-background/80 sticky top-0 z-10 border-b border-border/40 backdrop-blur-md dark:border-transparent">
			<div className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-3">
				<div className="relative z-10 flex items-center gap-8">
					<Link href="/" className="flex items-center gap-2.5">
						<Image
							src={DEFAULT_LOGO_URL}
							alt="Editkub Logo"
							className="dark:invert"
							width={28}
							height={28}
						/>
						<span className="text-lg font-bold tracking-tight">Editkub</span>
					</Link>
					<nav className="hidden items-center gap-1 md:flex">
						{links.map((link) => (
							<Link key={link.href} href={link.href}>
								<Button
									variant="ghost"
									type="button"
									className="text-muted-foreground hover:text-foreground text-sm font-medium"
								>
									{link.label}
								</Button>
							</Link>
						))}
					</nav>
				</div>

				<div className="relative z-10">
					<div className="flex items-center gap-3 md:hidden">
						<Button
							variant="ghost"
							size="icon"
							type="button"
							className="flex items-center justify-center"
							onClick={() => setIsMenuOpen(!isMenuOpen)}
						>
							<HugeiconsIcon icon={Menu02Icon} size={24} />
						</Button>
					</div>
					<div className="hidden items-center gap-2 md:flex">
						<LanguageToggle />
						<ThemeToggle />
						<Link href="/projects">
							<Button
								variant="foreground"
								type="button"
								className="text-sm"
							>
								{t('Open Editor')}
								<ArrowRight className="size-3.5" />
							</Button>
						</Link>
					</div>
				</div>

				<div
					className={cn(
						"bg-background/95 pointer-events-none fixed inset-0 opacity-0 backdrop-blur-xl",
						"transition-opacity duration-200",
						isMenuOpen && "pointer-events-auto opacity-100",
					)}
				>
					<div className="relative h-full">
						<button
							type="button"
							aria-label="Close menu"
							className="absolute inset-0"
							onClick={closeMenu}
							onKeyDown={(event) => {
								if (
									event.key === "Enter" ||
									event.key === " " ||
									event.key === "Escape"
								) {
									event.preventDefault();
									closeMenu();
								}
							}}
						/>
						<nav className="flex flex-col gap-4 px-6 pt-20">
							{links.map((link, index) => (
								<motion.div
									key={link.href}
									initial={{ y: 10, opacity: 0 }}
									animate={{
										y: isMenuOpen ? 0 : 10,
										opacity: isMenuOpen ? 1 : 0,
									}}
									transition={{
										duration: 0.3,
										delay: isMenuOpen ? index * 0.08 : 0,
										ease: "easeOut",
									}}
								>
									<Link
										href={link.href}
										className="text-2xl font-semibold"
										onClick={closeMenu}
									>
										{link.label}
									</Link>
								</motion.div>
							))}
							<motion.div
								initial={{ y: 10, opacity: 0 }}
								animate={{
									y: isMenuOpen ? 0 : 10,
									opacity: isMenuOpen ? 1 : 0,
								}}
								transition={{
									duration: 0.3,
									delay: isMenuOpen ? links.length * 0.08 : 0,
									ease: "easeOut",
								}}
							>
								<Link href="/projects" onClick={closeMenu}>
									<Button
										variant="foreground"
										type="button"
										size="lg"
										className="mt-4 w-full text-base"
									>
										{t('Open Editor')}
										<ArrowRight className="size-4" />
									</Button>
								</Link>
							</motion.div>
						</nav>
						<div className="absolute right-8 bottom-8 flex items-center gap-2">
							<LanguageToggle
								className="size-10"
								iconClassName="!size-[1.2rem]"
							/>
							<ThemeToggle
								className="size-10"
								iconClassName="!size-[1.2rem]"
								onToggle={(event) => {
									event.preventDefault();
									event.stopPropagation();
								}}
							/>
						</div>
					</div>
				</div>
			</div>
		</header>
	);
}
