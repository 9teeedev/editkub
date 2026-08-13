/**
 * Voice enhancement via OfflineAudioContext.
 *
 * Privacy-first, fully local: no WASM binary dependency. Renders the source
 * audio through a chain that approximates RNNoise-style denoise + leveling:
 *
 *   source → high-pass filter (80 Hz, kill rumble/hum)
 *          → dynamics compressor (leveling, evens out volume)
 *          → makeup gain
 *          → destination
 *
 * The compressor with a low threshold + high ratio acts as both a leveler
 * and a crude noise suppressor: quiet background noise gets pushed down
 * further by the makeup-gain-then-target ratio. For heavy stationary noise
 * a noise gate (WaveShaper) can be inserted, but the compressor alone is
 * a good default that doesn't clip speech.
 *
 * Returns the processed mono Float32Array at the original sample rate.
 */
import { createAudioContext } from "@/lib/media/audio";

export interface EnhancedAudio {
	samples: Float32Array;
	sampleRate: number;
}

export async function enhanceVoice(file: Blob): Promise<EnhancedAudio | null> {
	// Decode the source file to an AudioBuffer (preserving its sample rate
	// and channel count for faithful rendering).
	const decodeCtx = createAudioContext();
	let audioBuffer: AudioBuffer;
	try {
		const arrayBuffer = await file.arrayBuffer();
		audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
	} catch {
		return null;
	} finally {
		await decodeCtx.close();
	}

	const sampleRate = audioBuffer.sampleRate;
	const numChannels = audioBuffer.numberOfChannels;
	const length = audioBuffer.length;

	// Render the enhancement chain offline at the original rate/channels.
	const w = window as typeof window & {
		webkitOfflineAudioContext?: typeof OfflineAudioContext;
	};
	const OfflineCtor = window.OfflineAudioContext ?? w.webkitOfflineAudioContext;
	if (!OfflineCtor) return null;

	const offline = new OfflineCtor(numChannels, length, sampleRate);

	// Source buffer node.
	const source = offline.createBufferSource();
	source.buffer = audioBuffer;

	// 1. High-pass at 80 Hz — remove rumble, HVAC, mic handling noise.
	const highpass = offline.createBiquadFilter();
	highpass.type = "highpass";
	highpass.frequency.value = 80;
	highpass.Q.value = 0.7;

	// 2. Presence boost around 3 kHz — improves speech intelligibility.
	const presence = offline.createBiquadFilter();
	presence.type = "peaking";
	presence.frequency.value = 3000;
	presence.Q.value = 0.8;
	presence.gain.value = 2.5; // +2.5 dB

	// 3. Compressor — leveler + crude noise suppression.
	const compressor = offline.createDynamicsCompressor();
	compressor.threshold.value = -40; // start compressing below -40 dBFS
	compressor.knee.value = 15; // soft knee
	compressor.ratio.value = 4; // 4:1 compression
	compressor.attack.value = 0.005; // 5 ms
	compressor.release.value = 0.15; // 150 ms

	// 4. Makeup gain — compensate for compressor output reduction.
	const makeup = offline.createGain();
	makeup.gain.value = 1.4;

	// Wire the chain: source → highpass → presence → compressor → makeup → out
	source.connect(highpass);
	highpass.connect(presence);
	presence.connect(compressor);
	compressor.connect(makeup);
	makeup.connect(offline.destination);

	source.start(0);

	const rendered = await offline.startRendering();

	// Downmix to mono Float32Array (consistent with decodeAudioToFloat32).
	const samples = new Float32Array(rendered.length);
	if (rendered.numberOfChannels === 2) {
		const left = rendered.getChannelData(0);
		const right = rendered.getChannelData(1);
		const scaling = Math.sqrt(2);
		for (let i = 0; i < rendered.length; i++) {
			samples[i] = (scaling * (left[i] + right[i])) / 2;
		}
	} else {
		const ch = rendered.getChannelData(0);
		for (let i = 0; i < rendered.length; i++) {
			samples[i] = ch[i];
		}
	}

	return { samples, sampleRate };
}
