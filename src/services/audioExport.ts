/**
 * Archival WAV Master & RPG Maker MV OGG Vorbis Export Engine
 * Encodes 24-bit/32-bit broadcast WAV files and generates genuine
 * RPG Maker MV compliant OGG Vorbis audio with embedded LOOPSTART & LOOPLENGTH tags.
 */

import { LoopRegion } from '../types/index.ts';

export interface ExportResult {
  format: 'wav' | 'ogg';
  blob: Blob;
  fileName: string;
  fileSizeBytes: number;
  sampleRate: number;
  channels: number;
  durationSec: number;
  loopStartSamples?: number;
  loopLengthSamples?: number;
  loopSeamDiscontinuityDb?: number;
  validationStatus: 'PASSED' | 'FAILED' | 'WARNING';
  validationMessage: string;
}

// 1. WAV 24-bit PCM and 32-bit Float Archival Master Encoder
export function encodeWavFile(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  bitDepth: 24 | 32 = 24
): Blob {
  const numChannels = 2;
  const numSamples = left.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF Chunk Descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt Subchunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true); // 1 = PCM, 3 = IEEE Float
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data Subchunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave audio samples
  let offset = 44;
  if (bitDepth === 24) {
    for (let i = 0; i < numSamples; i++) {
      const sL = Math.max(-1, Math.min(1, left[i]));
      const sR = Math.max(-1, Math.min(1, right[i]));

      const intL = Math.floor(sL < 0 ? sL * 0x800000 : sL * 0x7fffff);
      const intR = Math.floor(sR < 0 ? sR * 0x800000 : sR * 0x7fffff);

      view.setUint8(offset++, intL & 0xff);
      view.setUint8(offset++, (intL >> 8) & 0xff);
      view.setUint8(offset++, (intL >> 16) & 0xff);

      view.setUint8(offset++, intR & 0xff);
      view.setUint8(offset++, (intR >> 8) & 0xff);
      view.setUint8(offset++, (intR >> 16) & 0xff);
    }
  } else {
    // 32-bit Float
    for (let i = 0; i < numSamples; i++) {
      view.setFloat32(offset, left[i], true);
      offset += 4;
      view.setFloat32(offset, right[i], true);
      offset += 4;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// Convert Blob to Base64
async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

// 2. Real RPG Maker MV OGG Vorbis Encoder (via native libvorbis server backend)
export async function encodeOggVorbisWithLoop(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  loop: LoopRegion,
  title: string,
  artist = 'Chiptune Hardware Workstation',
  fileName = 'chiptune_bgm'
): Promise<Blob> {
  const loopStart = Math.max(0, Math.floor(loop.startSample));
  const loopLength = Math.max(1, Math.floor(loop.lengthSamples));

  // Generate intermediate uncompressed 24-bit WAV master
  const wavBlob = encodeWavFile(left, right, sampleRate, 24);
  const wavBase64 = await blobToBase64(wavBlob);

  // Request native FFmpeg libvorbis encoding
  const response = await fetch('/api/export-vorbis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wavBase64,
      loopStart,
      loopLength,
      sampleRate,
      title,
      artist,
      fileName
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Real Vorbis encoder failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const oggBlob = await response.blob();
  return oggBlob;
}

// 3. Audio Loop Seam Analysis
export function analyzeLoopSeamDiscontinuity(
  left: Float32Array,
  right: Float32Array,
  startSample: number,
  lengthSamples: number
): { discontinuityDb: number; isSeamless: boolean; startLevel: number; endLevel: number; error?: string } {
  // Validate exact boundary constraints
  if (
    startSample < 0 ||
    lengthSamples <= 0 ||
    startSample >= left.length ||
    startSample + lengthSamples > left.length
  ) {
    return {
      discontinuityDb: 0,
      isSeamless: false,
      startLevel: 0,
      endLevel: 0,
      error: `Loop bounds [${startSample}, ${startSample + lengthSamples}) exceed audio buffer length (${left.length} samples)`
    };
  }

  // Seam occurs between the last sample inside the loop and the first sample of the loop
  const firstSampleIdx = Math.floor(startSample);
  const lastSampleIdx = Math.floor(startSample + lengthSamples - 1);

  const sampleStartL = left[firstSampleIdx];
  const sampleStartR = right[firstSampleIdx];
  const sampleEndL = left[lastSampleIdx];
  const sampleEndR = right[lastSampleIdx];

  const stepL = Math.abs(sampleEndL - sampleStartL);
  const stepR = Math.abs(sampleEndR - sampleStartR);

  // Also evaluate slope continuity across boundary for continuous periodic waveforms
  const prevLastL = lastSampleIdx > 0 ? left[lastSampleIdx - 1] : sampleEndL;
  const prevLastR = lastSampleIdx > 0 ? right[lastSampleIdx - 1] : sampleEndR;
  const nextFirstL = firstSampleIdx + 1 < left.length ? left[firstSampleIdx + 1] : sampleStartL;
  const nextFirstR = firstSampleIdx + 1 < right.length ? right[firstSampleIdx + 1] : sampleStartR;

  const deltaWrapL = sampleStartL - sampleEndL;
  const deltaWrapR = sampleStartR - sampleEndR;
  const deltaLocalL = ((sampleEndL - prevLastL) + (nextFirstL - sampleStartL)) / 2;
  const deltaLocalR = ((sampleEndR - prevLastR) + (nextFirstR - sampleStartR)) / 2;

  const slopeDiffL = Math.abs(deltaWrapL - deltaLocalL);
  const slopeDiffR = Math.abs(deltaWrapR - deltaLocalR);

  // The true seam discontinuity is the minimum of step amplitude (zero crossings) and slope error (periodic waves)
  const effectiveDiffL = Math.min(stepL, slopeDiffL);
  const effectiveDiffR = Math.min(stepR, slopeDiffR);
  const maxDiff = Math.max(effectiveDiffL, effectiveDiffR);

  // Discontinuity in dB relative to full scale (0 dBFS = 1.0)
  const discontinuityDb = maxDiff > 0.00001 ? 20 * Math.log10(maxDiff) : -96.0;
  // Seamless if boundary discontinuity is below -36 dB (inaudible step)
  const isSeamless = discontinuityDb < -36.0;

  return {
    discontinuityDb: Math.round(discontinuityDb * 10) / 10,
    isSeamless,
    startLevel: (Math.abs(sampleStartL) + Math.abs(sampleStartR)) / 2,
    endLevel: (Math.abs(sampleEndL) + Math.abs(sampleEndR)) / 2
  };
}

// 4. Create real seam audition audio buffer (loops 250ms tail + 250ms head)
export function createSeamAuditionBuffer(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  startSample: number,
  lengthSamples: number,
  windowMs = 250
): { left: Float32Array; right: Float32Array; length: number } {
  const windowSamples = Math.floor((sampleRate * windowMs) / 1000);
  const halfWindow = Math.min(windowSamples, Math.floor(lengthSamples / 2));
  const totalLength = halfWindow * 2;

  const outL = new Float32Array(totalLength);
  const outR = new Float32Array(totalLength);

  const tailStart = Math.max(0, startSample + lengthSamples - halfWindow);
  const headStart = startSample;

  // Copy tail (approaching loop point) into first half
  for (let i = 0; i < halfWindow; i++) {
    const src = tailStart + i;
    if (src < left.length) {
      outL[i] = left[src];
      outR[i] = right[src];
    }
  }

  // Copy head (after loop point) into second half
  for (let i = 0; i < halfWindow; i++) {
    const src = headStart + i;
    if (src < left.length) {
      outL[halfWindow + i] = left[src];
      outR[halfWindow + i] = right[src];
    }
  }

  return { left: outL, right: outR, length: totalLength };
}
