/**
 * Real-time frequency-band analyzer for equalizer visualization.
 *
 * Uses a bank of 2nd-order IIR bandpass filters (biquad, constant 0 dB peak
 * gain form from the Audio EQ Cookbook) to split incoming PCM frames into 5
 * perceptual bands: sub-bass, bass/low-mid, mid, high-mid, and treble.
 *
 * This runs entirely in JS on the PCM data already exposed by expo-av's
 * setOnAudioSampleReceived — no native modules required.
 */

export type FrequencyBands = [number, number, number, number, number];

interface BiquadCoeffs {
  b0: number;
  b2: number;
  a1: number;
  a2: number;
}

interface BiquadState {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

/**
 * Design a 2nd-order bandpass biquad filter.
 * @param fc  Center frequency (Hz)
 * @param Q   Quality factor — controls bandwidth (lower = wider)
 * @param fs  Sample rate (Hz)
 */
function designBPF(fc: number, Q: number, fs: number): BiquadCoeffs {
  const omega = (2 * Math.PI * fc) / fs;
  const sinOmega = Math.sin(omega);
  const cosOmega = Math.cos(omega);
  const alpha = sinOmega / (2 * Q);
  const a0 = 1 + alpha;
  return {
    b0: alpha / a0,
    b2: -(alpha / a0),
    a1: (-2 * cosOmega) / a0,
    a2: (1 - alpha) / a0,
  };
}

/** Process one sample through a biquad filter, updating state in-place. */
function processBiquad(
  x: number,
  c: BiquadCoeffs,
  s: BiquadState
): number {
  const y = c.b0 * x + c.b2 * s.x2 - c.a1 * s.y1 - c.a2 * s.y2;
  s.x2 = s.x1;
  s.x1 = x;
  s.y2 = s.y1;
  s.y1 = y;
  return y;
}

function newState(): BiquadState {
  return { x1: 0, x2: 0, y1: 0, y2: 0 };
}

/**
 * Five perceptual bands with center frequency + Q.
 * Q=0.7 gives roughly an octave of bandwidth for each filter, which keeps the
 * bands broad enough to always show energy without being too narrow to "miss" notes.
 */
const BAND_PARAMS: readonly [number, number][] = [
  [80, 0.7],    // Sub-bass  — kick drum body, deep synth
  [300, 0.7],   // Low-mid   — bass guitar, lower vocals
  [1000, 0.7],  // Mid       — guitar, piano, vocals
  [4000, 0.7],  // High-mid  — snare presence, upper harmonics
  [12000, 0.7], // Treble    — hi-hats, cymbals, air
];

const NUM_BANDS = BAND_PARAMS.length;

/**
 * Per-band normalization ranges — typical RMS from a biquad BPF on music.
 * Low frequencies carry more energy in most music, so MIN/MAX differ per band.
 * These are empirically tuned; adjust if visualization feels off.
 */
const BAND_MIN_RMS = [0.003, 0.002, 0.001, 0.0005, 0.0002];
const BAND_MAX_RMS = [0.12, 0.09, 0.07, 0.05, 0.035];

export class FrequencyAnalyzer {
  private readonly coeffs: BiquadCoeffs[];
  private readonly states: BiquadState[];
  private readonly smoothed: number[];

  constructor(sampleRate = 44100) {
    this.coeffs = BAND_PARAMS.map(([fc, Q]) => designBPF(fc, Q, sampleRate));
    this.states = Array.from({ length: NUM_BANDS }, newState);
    this.smoothed = new Array(NUM_BANDS).fill(0);
  }

  /**
   * Process a buffer of PCM frames and return normalized band energies [0–1].
   * Call this from the expo-av AudioSample callback.
   *
   * @param frames  PCM samples from one channel (−1 to +1)
   */
  process(frames: number[]): FrequencyBands {
    const n = frames.length;
    if (n === 0) return this.smoothed.slice() as FrequencyBands;

    const sumSq = new Array(NUM_BANDS).fill(0);

    for (let k = 0; k < n; k++) {
      const x = frames[k];
      for (let b = 0; b < NUM_BANDS; b++) {
        const y = processBiquad(x, this.coeffs[b], this.states[b]);
        sumSq[b] += y * y;
      }
    }

    for (let b = 0; b < NUM_BANDS; b++) {
      const rms = Math.sqrt(sumSq[b] / n);
      const alpha = rms > this.smoothed[b] ? 0.88 : 0.28;
      this.smoothed[b] = alpha * rms + (1 - alpha) * this.smoothed[b];
    }

    const result = new Array(NUM_BANDS) as FrequencyBands;
    for (let b = 0; b < NUM_BANDS; b++) {
      result[b] = Math.max(
        0,
        Math.min(1, (this.smoothed[b] - BAND_MIN_RMS[b]) / (BAND_MAX_RMS[b] - BAND_MIN_RMS[b]))
      );
    }
    return result;
  }

  /** Reset filter state (call when a new track starts). */
  reset(): void {
    for (let b = 0; b < NUM_BANDS; b++) {
      const s = this.states[b];
      s.x1 = s.x2 = s.y1 = s.y2 = 0;
      this.smoothed[b] = 0;
    }
  }
}
