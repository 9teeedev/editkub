import { BufferTarget, StreamTarget } from "mediabunny";

/**
 * Disk-backed export output.
 *
 * The whole output file used to accumulate in a growable ArrayBuffer
 * (mediabunny `BufferTarget`) and briefly doubled at `finalize()` — for a
 * long timeline that is gigabytes of live RAM, which pushes the whole
 * machine into swap and freezes the OS, not just the tab. The sink instead
 * streams encoder output chunk-by-chunk into a temporary file in the
 * Origin Private File System and hands back a (disk-backed) `File`.
 *
 * Falls back to `BufferTarget` on browsers without OPFS writable streams
 * (e.g. Firefox), preserving the old in-memory behavior there.
 */
export type ExportOutputSink = {
	target: StreamTarget;
	/** Close the writable after `output.finalize()` has resolved. */
	finish: () => Promise<void>;
	/** Snapshot of the finished temp file; stays readable after cleanup —
	 * stale temp files are swept by the next export's start-of-run cleanup. */
	getFile: () => Promise<File>;
	/** Abort the stream and delete the temp file. Safe to call twice. */
	cleanup: () => Promise<void>;
};

export function createBufferTarget(): BufferTarget {
	return new BufferTarget();
}

export async function createExportSink({
	format,
}: {
	format: string;
}): Promise<ExportOutputSink | null> {
	if (
		typeof navigator === "undefined" ||
		!navigator.storage?.getDirectory ||
		typeof FileSystemWritableFileStream === "undefined"
	) {
		return null;
	}

	try {
		const root = await navigator.storage.getDirectory();
		const dir = await root.getDirectoryHandle("export-tmp", {
			create: true,
		});
		const fileName = `export-${Date.now()}-${Math.random()
			.toString(36)
			.slice(2, 8)}.${format}`;
		const fileHandle = await dir.getFileHandle(fileName, { create: true });
		const writable = await fileHandle.createWritable();

		let finished = false;
		let cleanedUp = false;

		return {
			target: new StreamTarget(writable, { chunked: true }),
			finish: async () => {
				if (!finished && !cleanedUp) {
					finished = true;
					try {
						// mediabunny's StreamTargetWriter closes the writable
						// itself during output.finalize() — closing again here
						// rejects; treat that as success.
						await writable.close();
					} catch {
						// already closed by the muxer
					}
				}
			},
			getFile: async () => {
				if (!finished) {
					throw new Error("Export sink file read before finalize");
				}
				return fileHandle.getFile();
			},
			cleanup: async () => {
				if (cleanedUp) return;
				cleanedUp = true;
				try {
					if (!finished) {
						finished = true;
						await writable.abort();
					}
				} catch {
					// the writable may already be closed/errored
				}
				try {
					await dir.removeEntry(fileName);
				} catch {
					// best effort — the temp dir gets orphaned at worst
				}
			},
		};
	} catch {
		return null;
	}
}

/** Remove the whole temp dir (stale files from previous/crashed exports).
 * Called at the START of an export so finished files stay on disk until the
 * user's download has certainly completed. */
export async function cleanupExportTempDir(): Promise<void> {
	try {
		const root = await navigator.storage?.getDirectory?.();
		if (!root) return;
		await root.removeEntry("export-tmp", { recursive: true });
	} catch {
		// nothing to clean
	}
}

/** Write a temp file into the same OPFS dir (e.g. the ffmpeg fallback's
 * WAV input) and return it for WORKERFS mounting. */
export async function writeExportTempFile({
	name,
	data,
}: {
	name: string;
	data: Uint8Array | Blob;
}): Promise<File | null> {
	try {
		const root = await navigator.storage.getDirectory();
		const dir = await root.getDirectoryHandle("export-tmp", {
			create: true,
		});
		const handle = await dir.getFileHandle(name, { create: true });
		const writable = await handle.createWritable();
		await writable.write(data);
		await writable.close();
		return handle.getFile();
	} catch {
		return null;
	}
}
