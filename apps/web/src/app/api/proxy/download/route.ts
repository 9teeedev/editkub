import { type NextRequest, NextResponse } from "next/server";
import { isAiEnabled, disabledResponse } from "@/lib/api-guard";

export async function GET(request: NextRequest) {
	if (!isAiEnabled()) return disabledResponse();
	const referer = request.headers.get("referer");
	const origin = request.headers.get("origin");
	const allowedOrigin = request.nextUrl.origin;

	const isAllowed =
		(referer && new URL(referer).origin === allowedOrigin) ||
		origin === allowedOrigin;

	if (!isAllowed) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const url = request.nextUrl.searchParams.get("url");

	if (!url) {
		return NextResponse.json(
			{ error: "Missing url parameter" },
			{ status: 400 },
		);
	}

	try {
		const response = await fetch(url);
		if (!response.ok) {
			return NextResponse.json(
				{ error: `Upstream error: ${response.status}` },
				{ status: response.status },
			);
		}

		const contentType =
			response.headers.get("content-type") ?? "application/octet-stream";
		const body = response.body;

		if (!body) {
			return NextResponse.json(
				{ error: "Empty upstream response" },
				{ status: 502 },
			);
		}

		return new NextResponse(body, {
			status: 200,
			headers: {
				"Content-Type": contentType,
			},
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown error";
		console.error("Proxy download error:", error);
		return NextResponse.json(
			{ error: "Download failed", detail: message },
			{ status: 500 },
		);
	}
}
