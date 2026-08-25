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
	URL.revokeObjectURL(url);
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
}): Promise<void> {
	const file = new File([blob], filename, { type: blob.type });

	if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
		try {
			await navigator.share({ files: [file] });
			return;
		} catch (error) {
			// AbortError = user dismissed the sheet; anything else falls through
			// to the anchor download so the export is never lost.
			if (error instanceof DOMException && error.name === "AbortError") return;
		}
	}

	downloadBlob({ blob, filename });
}
