import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  encodeWavFile,
  analyzeLoopSeamDiscontinuity,
  createSeamAuditionBuffer
} from '../src/services/audioExport.ts';
import { LoopRegion } from '../src/types/index.ts';

const execFileAsync = promisify(execFile);

test('WAV Encoder: generates valid 24-bit stereo RIFF/WAVE header and PCM payload', async () => {
  const sampleRate = 48000;
  const numSamples = 4800; // 0.1s
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    left[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    right[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
  }

  const wavBlob = encodeWavFile(left, right, sampleRate, 24);
  assert.equal(wavBlob.type, 'audio/wav');

  const arrayBuffer = await wavBlob.arrayBuffer();
  const view = new DataView(arrayBuffer);

  // Check 'RIFF' and 'WAVE'
  const riffStr = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  assert.equal(riffStr, 'RIFF');
  const waveStr = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  assert.equal(waveStr, 'WAVE');

  // Check format: 1 (PCM), channels: 2, sampleRate: 48000, bitDepth: 24
  assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 48000);
  assert.equal(view.getUint16(34, true), 24);
  assert.equal(arrayBuffer.byteLength, 44 + 4800 * 2 * 3);
});

test('Real OGG Vorbis: FFmpeg libvorbis encodes genuine Vorbis stream verified with ffprobe and decodable audio', async () => {
  const sampleRate = 48000;
  const numSamples = 48000; // exactly 1.0 second
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  // Fill with 440Hz tone
  for (let i = 0; i < numSamples; i++) {
    left[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
    right[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
  }

  const loopStart = 12000;
  const loopLength = 24000;

  // Encode to temporary WAV
  const wavBlob = encodeWavFile(left, right, sampleRate, 24);
  const wavArray = new Uint8Array(await wavBlob.arrayBuffer());

  const tmpDir = os.tmpdir();
  const tmpWav = path.join(tmpDir, `test_in_${Date.now()}.wav`);
  const tmpOgg = path.join(tmpDir, `test_out_${Date.now()}.ogg`);
  const tmpDecodedPcm = path.join(tmpDir, `test_dec_${Date.now()}.raw`);

  await fs.promises.writeFile(tmpWav, wavArray);

  try {
    // 1. Run native /usr/bin/ffmpeg with libvorbis
    await execFileAsync('/usr/bin/ffmpeg', [
      '-y',
      '-i', tmpWav,
      '-c:a', 'libvorbis',
      '-qscale:a', '6',
      '-metadata', `LOOPSTART=${loopStart}`,
      '-metadata', `LOOPLENGTH=${loopLength}`,
      '-metadata', 'TITLE=Adversarial Test BGM',
      tmpOgg
    ]);

    // 2. Run ffprobe to verify Vorbis stream and RPG Maker MV comments
    const { stdout: probeStdout } = await execFileAsync('/usr/bin/ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      tmpOgg
    ]);

    const probe = JSON.parse(probeStdout);
    assert.equal(probe.format.format_name, 'ogg');
    assert.equal(probe.streams[0].codec_name, 'vorbis');
    assert.equal(probe.streams[0].channels, 2);
    assert.equal(probe.streams[0].sample_rate, '48000');

    // Verify Vorbis comments (Vorbis comments can appear in stream tags or format tags in ffprobe)
    const tags = { ...(probe.format.tags || {}), ...(probe.streams?.[0]?.tags || {}) };
    assert.equal(tags.LOOPSTART, String(loopStart), 'Must have exact LOOPSTART comment');
    assert.equal(tags.LOOPLENGTH, String(loopLength), 'Must have exact LOOPLENGTH comment');
    assert.equal(tags.TITLE || tags.title, 'Adversarial Test BGM');

    // 3. Decode back to raw PCM float32 using ffmpeg to verify decodability
    await execFileAsync('/usr/bin/ffmpeg', [
      '-y',
      '-i', tmpOgg,
      '-f', 'f32le',
      '-acodec', 'pcm_f32le',
      tmpDecodedPcm
    ]);

    const decodedStats = await fs.promises.stat(tmpDecodedPcm);
    // 48000 samples * 2 channels * 4 bytes per sample = 384000 bytes (within +/- 1 Vorbis window packet margin)
    assert.ok(decodedStats.size >= 360000 && decodedStats.size <= 410000, `Decoded size ${decodedStats.size} expected ~384000`);
  } finally {
    try { await fs.promises.unlink(tmpWav); } catch {}
    try { await fs.promises.unlink(tmpOgg); } catch {}
    try { await fs.promises.unlink(tmpDecodedPcm); } catch {}
  }
});

test('Loop Seam Analyzer: accurately measures boundary discontinuity and rejects out-of-bounds regions', () => {
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

  // 1. Exactly integer periods (48 * 100 = 4800 samples): sample 4799 wraps to sample 0 seamlessly!
  const seam = analyzeLoopSeamDiscontinuity(left, right, 0, 4800);
  assert.ok(seam.isSeamless, 'Seam should be seamless when boundary matches');
  assert.ok(seam.discontinuityDb < -36.0, `Discontinuity should be < -36dB, got ${seam.discontinuityDb}dB`);

  // 2. Quarter-period offset creates a major discontinuity step
  const badSeam = analyzeLoopSeamDiscontinuity(left, right, 0, 4812);
  assert.equal(badSeam.isSeamless, false, 'Should detect step discontinuity');
  assert.ok(badSeam.discontinuityDb > -10.0, `Discontinuity should be high, got ${badSeam.discontinuityDb}dB`);

  // 3. Out-of-bounds boundaries must fail loudly
  const oobSeam = analyzeLoopSeamDiscontinuity(left, right, -10, 5000);
  assert.equal(oobSeam.isSeamless, false);
  assert.ok(oobSeam.error, 'Must report out-of-bounds error');

  const oobSeam2 = analyzeLoopSeamDiscontinuity(left, right, 90000, 10000); // 90000 + 10000 > 96000
  assert.equal(oobSeam2.isSeamless, false);
  assert.ok(oobSeam2.error, 'Must report out-of-bounds error when length extends past buffer');
});

test('Seam Audition Buffer: constructs crossfade boundary buffer for real audible 10-cycle testing', () => {
  const sampleRate = 48000;
  const numSamples = 48000;
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    left[i] = i / numSamples;
    right[i] = (numSamples - i) / numSamples;
  }

  const chunk = createSeamAuditionBuffer(left, right, sampleRate, 1000, 8000, 100);
  assert.ok(chunk.length > 0);
  assert.equal(chunk.left.length, chunk.length);
  assert.equal(chunk.right.length, chunk.length);
});
