import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { getMessages } from "@i18next-toolkit/nextjs-approuter/server";
import { i18nConfig } from "../../i18n.config";

export function generateStaticParams() {
	return i18nConfig.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	const messages = await getMessages(locale);

	return (
		<I18nProvider
			locale={locale}
			locales={i18nConfig.locales}
			defaultLocale={i18nConfig.defaultLocale}
			messages={messages}
			routingStrategy={i18nConfig.routingStrategy}
		>
			<TooltipProvider>
				<Toaster />
				{children}
			</TooltipProvider>
		</I18nProvider>
	);
}
