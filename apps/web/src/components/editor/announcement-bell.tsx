"use client";

import { useEffect, useState } from "react";
import { Notification03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { Link } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useAssetsPanelStore } from "@/stores/assets-panel-store";
import {
	getRecentAnnouncements,
	readSeenAnnouncementIds,
	writeSeenAnnouncementIds,
	type Announcement,
	type AnnouncementTag,
} from "@/lib/announcements";
import { formatDate } from "@/utils/date";
import { cn } from "@/utils/ui";

const TAG_STYLES: Record<AnnouncementTag, { label: string; className: string }> = {
	new: {
		label: "New",
		className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
	},
	improved: {
		label: "Improved",
		className: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
	},
	fixed: {
		label: "Fixed",
		className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
	},
};

export function AnnouncementBell({ className }: { className?: string }) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	// null until hydrated from localStorage so SSR/first paint shows no dot
	const [seenIds, setSeenIds] = useState<string[] | null>(null);
	const setActiveTab = useAssetsPanelStore((s) => s.setActiveTab);
	const items = getRecentAnnouncements();

	useEffect(() => {
		setSeenIds(readSeenAnnouncementIds());
	}, []);

	if (items.length === 0) return null;

	const hasUnread =
		seenIds !== null && items.some((item) => !seenIds.includes(item.id));

	const handleOpenChange = (next: boolean) => {
		setOpen(next);
		if (!next) return;
		setSeenIds((previous) => {
			const merged = new Set([...(previous ?? readSeenAnnouncementIds())]);
			for (const item of items) merged.add(item.id);
			const ids = Array.from(merged);
			writeSeenAnnouncementIds(ids);
			return ids;
		});
	};

	const handleActivate = (announcement: Announcement) => {
		setOpen(false);
		if (announcement.cta?.panel) {
			setActiveTab(announcement.cta.panel);
		}
	};

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className={cn("relative size-8", className)}
					title={t("What's new")}
					aria-label={t("What's new")}
				>
					<HugeiconsIcon icon={Notification03Icon} className="size-4" />
					{hasUnread && (
						<span className="bg-primary ring-background absolute top-1.5 right-1.5 size-2 rounded-full ring-2" />
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				sideOffset={8}
				className="max-w-[calc(100vw-1.5rem)] w-[340px] p-0"
			>
				<div className="border-b px-4 py-3">
					<p className="text-sm font-semibold">{t("What's new")}</p>
				</div>
				<div className="max-h-[60vh] overflow-y-auto">
					{items.map((item) => (
						<AnnouncementItem
							key={item.id}
							announcement={item}
							unread={seenIds !== null && !seenIds.includes(item.id)}
							onActivate={handleActivate}
						/>
					))}
				</div>
				<div className="border-t p-2">
					<Link href="/roadmap" onClick={() => setOpen(false)}>
						<Button variant="ghost" size="sm" className="text-xs">
							{t("View roadmap")} →
						</Button>
					</Link>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function AnnouncementItem({
	announcement,
	unread,
	onActivate,
}: {
	announcement: Announcement;
	unread: boolean;
	onActivate: (announcement: Announcement) => void;
}) {
	const { t } = useTranslation();
	const tag = TAG_STYLES[announcement.tag];
	const date = formatDate({ date: new Date(`${announcement.date}T00:00:00`) });
	const cta = announcement.cta;

	const body = (
		<div className="min-w-0 flex-1">
			<div className="flex items-center gap-2">
				<span
					className={cn(
						"rounded-full px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase",
						tag.className,
					)}
				>
					{t(tag.label)}
				</span>
				<span className="text-muted-foreground text-[10px]">{date}</span>
			</div>
			<p className="mt-1 text-sm leading-snug font-medium">
				{t(announcement.title)}
			</p>
			<p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-snug">
				{t(announcement.description)}
			</p>
			{cta && (
				<span className="text-primary mt-1.5 block text-xs font-medium">
					{t(cta.label)} →
				</span>
			)}
		</div>
	);

	const rowClassName = cn(
		"flex w-full gap-2.5 px-4 py-3 text-left",
		unread && "bg-accent/40",
		cta && "cursor-pointer transition-colors hover:bg-accent",
	);

	const content = (
		<>
			{unread && (
				<span className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" />
			)}
			{body}
		</>
	);

	if (cta?.href) {
		return (
			<Link href={cta.href} onClick={() => onActivate(announcement)} className={rowClassName}>
				{content}
			</Link>
		);
	}
	if (cta?.panel) {
		return (
			<button
				type="button"
				onClick={() => onActivate(announcement)}
				className={rowClassName}
			>
				{content}
			</button>
		);
	}
	return <div className={rowClassName}>{content}</div>;
}
