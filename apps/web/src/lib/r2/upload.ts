import { AwsClient } from "aws4fetch";
import { webEnv } from "@editkub/env/web";

function getR2Config() {
	const {
		R2_ACCOUNT_ID,
		R2_ACCESS_KEY_ID,
		R2_SECRET_ACCESS_KEY,
		R2_BUCKET_NAME,
		R2_PUBLIC_URL,
	} = webEnv;

	if (
		!R2_ACCOUNT_ID ||
		!R2_ACCESS_KEY_ID ||
		!R2_SECRET_ACCESS_KEY ||
		!R2_BUCKET_NAME ||
		!R2_PUBLIC_URL
	) {
		throw new Error(
			"R2 storage is not configured. Please set R2_* environment variables.",
		);
	}

	return {
		R2_ACCOUNT_ID,
		R2_ACCESS_KEY_ID,
		R2_SECRET_ACCESS_KEY,
		R2_BUCKET_NAME,
		R2_PUBLIC_URL,
	};
}

function buildR2Client({
	accessKeyId,
	secretAccessKey,
}: {
	accessKeyId: string;
	secretAccessKey: string;
}): AwsClient {
	return new AwsClient({
		accessKeyId,
		secretAccessKey,
		region: "auto",
		service: "s3",
	});
}

export async function uploadToR2({
	data,
	key,
	contentType,
}: {
	data: ArrayBuffer | Uint8Array;
	key: string;
	contentType: string;
}): Promise<string> {
	const config = getR2Config();
	const client = buildR2Client({
		accessKeyId: config.R2_ACCESS_KEY_ID,
		secretAccessKey: config.R2_SECRET_ACCESS_KEY,
	});

	const endpoint = `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${config.R2_BUCKET_NAME}/${key}`;

	const body = data instanceof ArrayBuffer ? new Uint8Array(data) : data;

	const response = await client.fetch(endpoint, {
		method: "PUT",
		headers: {
			"Content-Type": contentType,
			"Content-Length": String(body.byteLength),
		},
		body: body as unknown as BodyInit,
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`R2 upload failed: ${response.status} - ${errorText}`);
	}

	const publicUrl = config.R2_PUBLIC_URL.replace(/\/$/, "");
	return `${publicUrl}/${key}`;
}

export function generateUploadKey({ filename }: { filename: string }): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).slice(2, 10);
	const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
	return `uploads/${timestamp}-${random}-${sanitized}`;
}

export function isR2Configured(): boolean {
	const {
		R2_ACCOUNT_ID,
		R2_ACCESS_KEY_ID,
		R2_SECRET_ACCESS_KEY,
		R2_BUCKET_NAME,
		R2_PUBLIC_URL,
	} = webEnv;
	return !!(
		R2_ACCOUNT_ID &&
		R2_ACCESS_KEY_ID &&
		R2_SECRET_ACCESS_KEY &&
		R2_BUCKET_NAME &&
		R2_PUBLIC_URL
	);
}
