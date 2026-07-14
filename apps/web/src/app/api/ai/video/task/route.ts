import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAiEnabled, disabledResponse } from "@/lib/api-guard";

const PROVIDER_TASK_URLS: Record<string, string> = {
	seedance:
		"https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks",
};

const querySchema = z.object({
	providerId: z.string(),
	taskId: z.string(),
});

export async function GET(request: NextRequest) {
	if (!isAiEnabled()) return disabledResponse();

	try {
		const providerId = request.nextUrl.searchParams.get("providerId");
		const taskId = request.nextUrl.searchParams.get("taskId");
		const authorization = request.headers.get("authorization");

		const validation = querySchema.safeParse({ providerId, taskId });
		if (!validation.success) {
			return NextResponse.json(
				{
					error: "Invalid request",
					details: validation.error.flatten().fieldErrors,
				},
				{ status: 400 },
			);
		}

		if (!authorization) {
			return NextResponse.json(
				{ error: "Missing Authorization header" },
				{ status: 401 },
			);
		}

		const baseUrl = PROVIDER_TASK_URLS[validation.data.providerId];
		if (!baseUrl) {
			return NextResponse.json(
				{ error: `Unknown provider: ${validation.data.providerId}` },
				{ status: 400 },
			);
		}

		const url = `${baseUrl}/${validation.data.taskId}`;

		const response = await fetch(url, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				Authorization: authorization,
			},
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
		console.error("AI video task proxy error:", error);
		return NextResponse.json(
			{ error: "Proxy request failed", detail: message },
			{ status: 500 },
		);
	}
}
