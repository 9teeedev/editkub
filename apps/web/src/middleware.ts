import { createI18nMiddleware } from "@i18next-toolkit/nextjs-approuter/middleware";
import { i18nConfig } from "./i18n.config";

export default createI18nMiddleware(i18nConfig);

export const config = {
	matcher: [
		"/((?!api|_next/static|_next/image|favicon.ico|locales|logos|preview|manifest.json|icon.svg|robots.txt|sitemap.xml|llms.txt).*)",
	],
};
