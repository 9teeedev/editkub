"use client";

import { motion } from "motion/react";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "../ui/accordion";
import { useLocalizedFaqItems } from "./json-ld";

export function FAQSection() {
	const { t } = useTranslation();
	const faqItems = useLocalizedFaqItems();

	return (
		<section id="faq" className="relative px-4 py-24 md:py-32">
			<div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-accent/50 via-transparent to-transparent dark:from-transparent" />
			<div className="mx-auto max-w-3xl">
				<motion.div
					className="mb-12 text-center"
					initial={{ opacity: 0, y: 30 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.6, ease: "easeOut" }}
				>
					<h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
						{t("Frequently Asked Questions")}
					</h2>
					<p className="text-muted-foreground text-lg">
						{t("Quick answers about Editkub and how it works.")}
					</p>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-60px" }}
					transition={{ duration: 0.5, ease: "easeOut" }}
				>
					<Accordion type="single" collapsible className="w-full">
						{faqItems.map((item, index) => (
							<AccordionItem key={item.question} value={`faq-${index}`}>
								<AccordionTrigger className="text-left text-base font-medium">
									{item.question}
								</AccordionTrigger>
								<AccordionContent className="text-muted-foreground text-sm leading-relaxed">
									{item.answer}
								</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
				</motion.div>
			</div>

		</section>
	);
}
