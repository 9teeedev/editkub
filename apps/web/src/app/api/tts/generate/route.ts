import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAiEnabled, disabledResponse } from "@/lib/api-guard";

const TTS_API_BASE = "https://api.milorapart.top/apis/mbAIsc";

const requestSchema = z.object({
	text: z.string().min(1, "Text is required").max(2000, "Text too long"),
	voice: z.string().optional(),
});

const upstreamResponseSchema = z.object({
	code: z.number(),
	url: z.string().url(),
});

export async function POST(request: NextRequest) {
	if (!isAiEnabled()) return disabledResponse();
	try {
		const body = await request.json();
		const validation = requestSchema.safeParse(body);

		if (!validation.success) {
			return NextResponse.json(
				{
					error: "Invalid request",
					details: validation.error.flatten().fieldErrors,
				},
				{ status: 400 },
			);
		}

		const { text } = validation.data;
		const upstreamUrl = `${TTS_API_BASE}?${new URLSearchParams({ text, format: "mp3" })}`;
		const upstreamResponse = await fetch(upstreamUrl);

		if (!upstreamResponse.ok) {
			return NextResponse.json(
				{ error: `Upstream error: ${upstreamResponse.status}` },
				{ status: 502 },
			);
		}

		const upstreamData = await upstreamResponse.json();
		const parsed = upstreamResponseSchema.safeParse(upstreamData);

		if (!parsed.success || parsed.data.code !== 200) {
			return NextResponse.json(
				{ error: "TTS generation failed" },
				{ status: 502 },
			);
		}

		const audioResponse = await fetch(parsed.data.url);
		if (!audioResponse.ok) {
			return NextResponse.json(
				{ error: `Failed to download audio: ${audioResponse.status}` },
				{ status: 502 },
			);
		}

		const audioArrayBuffer = await audioResponse.arrayBuffer();
		const base64 = Buffer.from(audioArrayBuffer).toString("base64");

		return NextResponse.json({ audio: base64 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error("TTS generate error:", error);
		return NextResponse.json(
			{ error: "Internal server error", detail: message },
			{ status: 500 },
		);
	}
}
