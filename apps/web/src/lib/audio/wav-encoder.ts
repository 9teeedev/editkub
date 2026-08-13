/**
 * Minimal 16-bit PCM mono WAV encoder.
 *
 * Pure domain logic (per AGENTS.md → lives in `lib/`). Takes mono Float32
 * samples in [-1, 1] and a sample rate, returns a WAV Blob. Standard 44-byte
 * header (RIFF/WAVE/fmt/data chunks), little-endian.
 */

export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
	const numSamples = samples.length;
	const bytesPerSample = 2; // 16-bit
	const blockAlign = 1 * bytesPerSample; // mono
	const dataSize = numSamples * bytesPerSample;
	const bufferSize = 44 + dataSize;

	const buffer = new ArrayBuffer(bufferSize);
	const view = new DataView(buffer);

	// RIFF header
	writeString(view, 0, "RIFF");
	view.setUint32(4, 36 + dataSize, true);
	writeString(view, 8, "WAVE");

	// fmt chunk
	writeString(view, 12, "fmt ");
	view.setUint32(16, 16, true); // PCM chunk size
	view.setUint16(20, 1, true); // PCM format
	view.setUint16(22, 1, true); // mono
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * blockAlign, true); // byte rate
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, 16, true); // bits per sample

	// data chunk
	writeString(view, 36, "data");
	view.setUint32(40, dataSize, true);

	// Write 16-bit PCM samples (clamp + scale)
	let offset = 44;
	for (let i = 0; i < numSamples; i++) {
		const clamped = Math.max(-1, Math.min(1, samples[i]));
		const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
		view.setInt16(offset, int16 | 0, true);
		offset += 2;
	}

	return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string): void {
	for (let i = 0; i < str.length; i++) {
		view.setUint8(offset + i, str.charCodeAt(i));
	}
}
