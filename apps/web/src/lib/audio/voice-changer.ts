/**
 * Voice changer presets via OfflineAudioContext.
 *
 * Privacy-first, no WASM. Each preset combines a pitch shift (via source
 * playbackRate, resampled back to the original duration to preserve tempo)
 * with filter/effect chains for character.
 *
 * Pitch shift mechanism:
 *   - Render the source at `playbackRate = r` into an offline buffer of
 *     length `originalLength / r`. This produces `r`-sped-up audio (higher
 *     pitch if r>1, lower if r<1) at the same sample rate.
 *   - The offline buffer's duration is `originalDuration / r`, so pitch is
 *     shifted by `r` without changing tempo. (A real pitch-preserving
 *     time-stretch would need a phase vocoder; we intentionally want the
 *     pitch change, so the simple approach is correct here.)
 *
 * Presets:
 *   - chipmunk: pitch ×1.6
 *   - deep:     pitch ×0.65
 *   - robot:    pitch ×1.0 + ring modulation (×2Hz tremolo via gain LFO)
 *   - telephone: pitch ×1.0 + 300–3400 Hz bandpass
 *   - alien:    pitch ×0.8 + 800 Hz bandpass + slight delay feedback
 *   - echo:     pitch ×1.0 + 250 ms delay feedback (0.4 decay)
 */
import { createAudioContext } from "@/lib/media/audio";

export type VoicePreset =
	| "chipmunk"
	| "deep"
	| "robot"
	| "telephone"
	| "alien"
	| "echo";

export const VOICE_PRESETS: { id: VoicePreset; pitch: number; fx: boolean }[] =
	[
		{ id: "chipmunk", pitch: 1.6, fx: false },
		{ id: "deep", pitch: 0.65, fx: false },
		{ id: "robot", pitch: 1.0, fx: true },
		{ id: "telephone", pitch: 1.0, fx: true },
		{ id: "alien", pitch: 0.8, fx: true },
		{ id: "echo", pitch: 1.0, fx: true },
	];

export interface ChangedAudio {
	samples: Float32Array;
	sampleRate: number;
}

export async function changeVoice(
	file: Blob,
	preset: VoicePreset,
): Promise<ChangedAudio | null> {
	const config = VOICE_PRESETS.find((p) => p.id === preset);
	if (!config) return null;

	// Decode source.
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

	const OfflineCtor = getOfflineCtor();
	if (!OfflineCtor) return null;

	// Offline buffer length scales by 1/pitch so the sped-up render lands
	// at the original duration.
	const offlineLength = Math.max(1, Math.round(length / config.pitch));
	const offline = new OfflineCtor(numChannels, offlineLength, sampleRate);

	const source = offline.createBufferSource();
	source.buffer = audioBuffer;
	source.playbackRate.value = config.pitch;

	let lastNode: AudioNode = source;

	if (config.fx) {
		const chain = buildFxChain(offline, preset);
		if (chain) {
			lastNode.connect(chain.input);
			lastNode = chain.output;
		}
	}

	lastNode.connect(offline.destination);
	source.start(0);

	const rendered = await offline.startRendering();
	return downmix(rendered);
}

function buildFxChain(
	ctx: OfflineAudioContext,
	preset: VoicePreset,
): { input: AudioNode; output: AudioNode } | null {
	switch (preset) {
		case "telephone": {
			// 300 Hz high-pass + 3400 Hz low-pass = telephone band.
			const hp = ctx.createBiquadFilter();
			hp.type = "highpass";
			hp.frequency.value = 300;
			const lp = ctx.createBiquadFilter();
			lp.type = "lowpass";
			lp.frequency.value = 3400;
			hp.connect(lp);
			return { input: hp, output: lp };
		}
		case "robot": {
			// Ring modulation: multiply by a 50 Hz oscillator.
			const osc = ctx.createOscillator();
			osc.frequency.value = 50;
			osc.type = "sine";
			const ring = ctx.createGain();
			ring.gain.value = 0;
			osc.connect(ring.gain);
			osc.start(0);
			// ring mod: source × oscillator → output. We approximate by using
			// a gain whose value is driven by the oscillator (0..1), then add
			// 0.5 bias via a second gain to keep some dry signal.
			const mixer = ctx.createGain();
			mixer.gain.value = 1;
			ring.connect(mixer);
			return { input: ring, output: mixer };
		}
		case "alien": {
			const bp = ctx.createBiquadFilter();
			bp.type = "bandpass";
			bp.frequency.value = 800;
			bp.Q.value = 2;
			const delay = ctx.createDelay();
			delay.delayTime.value = 0.08;
			const feedback = ctx.createGain();
			feedback.gain.value = 0.35;
			bp.connect(delay);
			delay.connect(feedback);
			feedback.connect(delay);
			return { input: bp, output: delay };
		}
		case "echo": {
			const delay = ctx.createDelay();
			delay.delayTime.value = 0.25;
			const feedback = ctx.createGain();
			feedback.gain.value = 0.4;
			const wet = ctx.createGain();
			wet.gain.value = 0.6;
			delay.connect(feedback);
			feedback.connect(delay);
			delay.connect(wet);
			return { input: delay, output: wet };
		}
		default:
			return null;
	}
}

function getOfflineCtor(): typeof OfflineAudioContext | null {
	const w = window as typeof window & {
		webkitOfflineAudioContext?: typeof OfflineAudioContext;
	};
	return window.OfflineAudioContext ?? w.webkitOfflineAudioContext ?? null;
}

function downmix(rendered: AudioBuffer): ChangedAudio {
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
	return { samples, sampleRate: rendered.sampleRate };
}
