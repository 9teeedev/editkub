import Script from "next/script";
import type { Viewport } from "next";

import "./globals.css";
import { baseMetaData } from "./metadata";
import { Inter, Figtree, Geist_Mono } from "next/font/google";
import {
	initServerI18n,
	getLocale,
} from "@i18next-toolkit/nextjs-approuter/server";
import { i18nConfig } from "../i18n.config";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata = baseMetaData;

export const viewport: Viewport = {
	viewportFit: "cover",
};

initServerI18n(i18nConfig);

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const locale = await getLocale();

	return (
		<html
			lang={locale}
			suppressHydrationWarning
			className={`${inter.variable} ${figtree.variable} ${geistMono.variable}`}
		>
			<head>
				<Script
					src="https://tianji.9tee.dev/tracker.js"
					data-website-id="cmrky2xou0006fmgxlok8pf8m"
				/>
			</head>
			<body className="font-sans antialiased">
				{children}
			</body>
		</html>
	);
}
