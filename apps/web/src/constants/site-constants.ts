export const SITE_URL = "https://editkub.vercel.app";

export const SITE_INFO = {
	title: "Editkub",
	description:
		"Editkub is an AI-native, open-source video editor in your browser — a free, privacy-first alternative to CapCut. AI-powered editing, multi-track timeline, MP4/WebM export with no uploads.",
	url: SITE_URL,
	openGraphImage: "/icon.svg",
	twitterImage: "/icon.svg",
	favicon: "/logos/editkub/svg/logo.svg",
};

export type ExternalTool = {
	name: string;
	description: string;
	url: string;
	icon: React.ElementType;
};

export const EXTERNAL_TOOLS: ExternalTool[] = [];

export const DEFAULT_LOGO_URL = "/logos/editkub/svg/logo.svg";

export const SOCIAL_LINKS = {
	x: "https://x.com/editkub",
	github: "https://github.com/9teeedev/editkub",
	discord: "",
};
