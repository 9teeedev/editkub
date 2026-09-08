import { type NextRequest, NextResponse } from "next/server";
import { isAiEnabled, disabledResponse } from "@/lib/api-guard";
import {
	isRelayTargetAllowed,
	RELAY_FORWARDABLE_HEADERS,
	RELAY_TARGET_HEADER,
} from "@/lib/ai/agent/relay";

// Agent chats stream for a while; allow long completions before the
// platform kills the function.
export const maxDuration = 60;

function safeOriginOf(raw: string): string | null {
	try {
		return new URL(raw).origin;
	} catch {
		return null;
	}
}

async function relayRequest(
	request: NextRequest,
	method: "GET" | "POST",
): Promise<NextResponse> {
	if (!isAiEnabled()) return disabledResponse();

	// Only same-origin pages may use the relay.
	const referer = request.headers.get("referer");
	const origin = request.headers.get("origin");
	const allowedOrigin = request.nextUrl.origin;
	const refererOrigin = referer ? safeOriginOf(referer) : null;
	if (refererOrigin !== allowedOrigin && origin !== allowedOrigin) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const target = request.headers.get(RELAY_TARGET_HEADER);
	if (!target || !isRelayTargetAllowed(target)) {
		return NextResponse.json(
			{ error: "Invalid relay target" },
			{ status: 400 },
		);
	}

	const headers = new Headers();
	for (const name of RELAY_FORWARDABLE_HEADERS) {
		const value = request.headers.get(name);
		if (value) headers.set(name, value);
	}

	try {
		const upstream = await fetch(target, {
			method,
			headers,
			body: method === "POST" ? await request.text() : undefined,
			signal: request.signal,
		});

		const contentType =
			upstream.headers.get("content-type") ?? "application/octet-stream";
		if (!upstream.body) {
			return new NextResponse(null, {
				status: upstream.status,
				headers: { "Content-Type": contentType },
			});
		}
		return new NextResponse(upstream.body, {
			status: upstream.status,
			headers: { "Content-Type": contentType },
		});
	} catch (error) {
		if (request.signal.aborted) {
			return new NextResponse(null, { status: 499 });
		}
		console.error("Agent relay error:", error);
		return NextResponse.json(
			{ error: "Relay request failed" },
			{ status: 502 },
		);
	}
}

export async function POST(request: NextRequest) {
	return relayRequest(request, "POST");
}

export async function GET(request: NextRequest) {
	return relayRequest(request, "GET");
}
