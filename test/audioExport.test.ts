import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeWavFile,
  encodeOggVorbisWithLoop,
  analyzeLoopSeamDiscontinuity
} from '../src/services/audioExport.ts';
import { LoopRegion } from '../src/types/index.ts';

test('WAV Encoder: generates valid 24-bit stereo RIFF/WAVE header', async () => {
  const sampleRate = 48000;
  const numSamples = 4800; // 0.1s
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  // Fill with 440Hz test sine
  for (let i = 0; i < numSamples; i++) {
    left[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    right[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
  }

  const wavBlob = encodeWavFile(left, right, sampleRate, 24);
  assert.equal(wavBlob.type, 'audio/wav');

  const arrayBuffer = await wavBlob.arrayBuffer();
  const view = new DataView(arrayBuffer);

  // Check 'RIFF'
  const riffStr = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  assert.equal(riffStr, 'RIFF');

  // Check 'WAVE'
  const waveStr = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  assert.equal(waveStr, 'WAVE');

  // Check format: 1 (PCM)
  assert.equal(view.getUint16(20, true), 1);
  // Check channels: 2
  assert.equal(view.getUint16(22, true), 2);
  // Check sample rate: 48000
  assert.equal(view.getUint32(24, true), 48000);
  // Check bit depth: 24
  assert.equal(view.getUint16(34, true), 24);
  // Total size: 44 bytes header + (4800 * 2 * 3) = 44 + 28800 = 28844
  assert.equal(arrayBuffer.byteLength, 28844);
});

test('RPG Maker MV OGG Vorbis: generates compliant Ogg container with LOOPSTART and LOOPLENGTH comments', async () => {
  const sampleRate = 44100;
  const numSamples = 4410; // 0.1s
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  const loop: LoopRegion = {
    startTick: 0,
    endTick: 1920,
    startSample: 1000,
    lengthSamples: 3000,
    startBar: 1,
    startBeat: 1,
    endBar: 2,
    endBeat: 1,
    tailCrossfadeMs: 20
  };

  const oggBlob = encodeOggVorbisWithLoop(left, right, sampleRate, loop, 'Chiptune BGM');
  assert.equal(oggBlob.type, 'audio/ogg');

  const arrayBuffer = await oggBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Check first 4 bytes 'OggS'
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  assert.equal(magic, 'OggS');

  // Convert bytes to string to verify metadata tags
  const text = new TextDecoder('latin1').decode(bytes);
  assert.ok(text.includes('vorbis'), 'Must contain Vorbis identification');
  assert.ok(text.includes('LOOPSTART=1000'), 'Must contain RPG Maker MV LOOPSTART tag');
  assert.ok(text.includes('LOOPLENGTH=3000'), 'Must contain RPG Maker MV LOOPLENGTH tag');
});

test('Loop Seam Analyzer: verifies seamless audio transition', () => {
  const sampleRate = 48000;
  const numSamples = 96000;
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  // Fill with exact period sine wave (1000 Hz, period = 48 samples)
  for (let i = 0; i < numSamples; i++) {
    const val = Math.sin((2 * Math.PI * 1000 * i) / sampleRate);
    left[i] = val;
    right[i] = val;
  }

  // Exactly integer number of periods: 48 * 100 = 4800 samples length
  const seam = analyzeLoopSeamDiscontinuity(left, right, 0, 4800);
  assert.ok(seam.isSeamless, 'Seam should be seamless when boundary matches');
  assert.ok(seam.discontinuityDb < -30);
});
