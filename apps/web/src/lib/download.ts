/**
 * Shared file-download / share helpers. Until now every call site inlined
 * the same createObjectURL + anchor-click dance; keep one copy here.
 */

export function downloadBlob({ blob, filename }: { blob: Blob; filename: string }) {
	const url = URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	// Revoke late, not synchronously: for disk-backed blobs (e.g. the OPFS
	// export sink's File) the browser resolves the blob URL asynchronously,
	// and revoking in the same tick silently cancels the download before it
	// starts. A long delay also covers slow streaming of large files.
	window.setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
}

export interface ShareOrDownloadResult {
	success: boolean;
	cancelled?: boolean;
	action: "shared" | "downloaded" | "cancelled";
}

/**
 * Prefer the Web Share API (mobile share sheet, iOS Files save) and fall
 * back to a plain anchor download where sharing files is unavailable.
 */
export async function shareOrDownloadFile({
	blob,
	filename,
}: {
	blob: Blob;
	filename: string;
}): Promise<ShareOrDownloadResult> {
	const file = new File([blob], filename, { type: blob.type });

	if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
		try {
			await navigator.share({ files: [file] });
			return { success: true, action: "shared" };
		} catch (error) {
			// AbortError = user dismissed the sheet; anything else falls through
			// to the anchor download so the export is never lost.
			if (error instanceof DOMException && error.name === "AbortError") {
				return { success: false, cancelled: true, action: "cancelled" };
			}
		}
	}

	downloadBlob({ blob, filename });
	return { success: true, action: "downloaded" };
}
