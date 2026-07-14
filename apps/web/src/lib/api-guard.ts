import { NextResponse } from "next/server";

// ponytail: single kill switch for all AI/proxy routes.
// Set EDITKUB_AI_ENABLED=true in env to enable. Omit to disable (demo mode).
export function isAiEnabled(): boolean {
	return process.env.EDITKUB_AI_ENABLED === "true";
}

export function disabledResponse() {
	return NextResponse.json(
		{ error: "This feature is not available in demo mode." },
		{ status: 503 },
	);
}
