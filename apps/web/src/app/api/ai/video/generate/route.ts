import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAiEnabled, disabledResponse } from "@/lib/api-guard";

const proxyRequestSchema = z.object({
	url: z.string().url(),
	headers: z.record(z.string()).optional(),
	body: z.record(z.unknown()),
});

export async function POST(request: NextRequest) {
	if (!isAiEnabled()) return disabledResponse();
	try {
		const json = await request.json();

		const validation = proxyRequestSchema.safeParse(json);
		if (!validation.success) {
			return NextResponse.json(
				{
					error: "Invalid request",
					details: validation.error.flatten().fieldErrors,
				},
				{ status: 400 },
			);
		}

		const { url, headers, body } = validation.data;

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...headers,
			},
			body: JSON.stringify(body),
		});
		const responseText = await response.text();

		let responseData: unknown;
		try {
			responseData = JSON.parse(responseText);
		} catch {
			return NextResponse.json(
				{
					error: "Upstream returned non-JSON response",
					status: response.status,
					body: responseText.slice(0, 500),
				},
				{ status: 502 },
			);
		}

		if (!response.ok) {
			return NextResponse.json(responseData, { status: response.status });
		}

		return NextResponse.json(responseData);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown error";
		console.error("AI video proxy error:", error);
		return NextResponse.json(
			{ error: "Proxy request failed", detail: message },
			{ status: 500 },
		);
	}
}
