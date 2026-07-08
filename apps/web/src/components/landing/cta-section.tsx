"use client";

import { Button } from "../ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/navigation";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";

export function CTASection() {
	const { t } = useTranslation();

	return (
		<section className="flex flex-col items-center justify-center gap-12 py-24 px-4 w-full border-t">
			<div className="flex items-center justify-center gap-5 flex-col max-w-2xl text-center">
				<h2 className="text-3xl md:text-4xl font-semibold tracking-tight font-heading">
					{t('Ready to start editing?')}
				</h2>
				<p className="text-base text-muted-foreground leading-relaxed">
					{t('No sign-up required. Open the editor and start creating — your first project is just a click away.')}
				</p>
				<Link href="/projects">
					<Button variant="default" type="button" size="lg" className="h-11 px-6 font-semibold shadow-lg hover:shadow-xl gap-2 text-sm">
						{t('Open Editor')}
						<ArrowRight className="size-4" />
					</Button>
				</Link>
			</div>
		</section>
	);
}
