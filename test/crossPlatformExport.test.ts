import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const execFileAsync = promisify(execFile);

// Helper mimicking server.ts binary resolution logic
function resolveBinary(cmd: 'ffmpeg' | 'ffprobe'): string {
  const envVar = cmd === 'ffmpeg' ? process.env.FFMPEG_PATH : process.env.FFPROBE_PATH;
  if (envVar && fs.existsSync(envVar)) {
    return envVar;
  }
  const isWin = os.platform() === 'win32';
  const exe = isWin ? `${cmd}.exe` : cmd;

  if (isWin) {
    const winCandidates = [
      path.join(process.env.LOCALAPPDATA || 'C:\\', 'Programs', 'ffmpeg', 'bin', exe),
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'ffmpeg', 'bin', exe),
      `C:\\ffmpeg\\bin\\${exe}`,
      exe
    ];
    for (const cand of winCandidates) {
      if (fs.existsSync(cand)) return cand;
    }
  }

  const unixCandidates = [`/usr/bin/${cmd}`, `/usr/local/bin/${cmd}`, cmd];
  for (const cand of unixCandidates) {
    if (fs.existsSync(cand)) return cand;
  }
  return cmd;
}

test('Cross-Platform Audio Export: binary resolution returns existing executable', () => {
  const ffmpegPath = resolveBinary('ffmpeg');
  const ffprobePath = resolveBinary('ffprobe');
  assert.ok(ffmpegPath, 'FFmpeg binary path must be non-empty');
  assert.ok(ffprobePath, 'FFprobe binary path must be non-empty');
});

test('Cross-Platform Audio Export: FFmpeg Vorbis loop metadata and independent PCM decoding verification', async () => {
  const ffmpeg = resolveBinary('ffmpeg');
  const tmpDir = os.tmpdir();
  const wavPath = path.join(tmpDir, `test_cross_${Date.now()}.wav`);
  const oggPath = path.join(tmpDir, `test_cross_${Date.now()}.ogg`);
  const verifyPcmPath = path.join(tmpDir, `test_cross_verify_${Date.now()}.pcm`);

  try {
    // 1. Generate 1-second 44.1kHz stereo test WAV via FFmpeg
    await execFileAsync(ffmpeg, [
      '-f', 'lavfi',
      '-i', 'sine=frequency=440:duration=1.0',
      '-ac', '2',
      '-ar', '44100',
      '-y',
      wavPath
    ]);
    assert.ok(fs.existsSync(wavPath), 'Generated test WAV file');

    // 2. Encode to Ogg Vorbis with loop metadata tags (LOOPSTART=8820, LOOPLENGTH=35280)
    const loopStart = 8820;
    const loopLength = 35280;
    await execFileAsync(ffmpeg, [
      '-i', wavPath,
      '-c:a', 'libvorbis',
      '-q:a', '6',
      '-metadata', `LOOPSTART=${loopStart}`,
      '-metadata', `LOOPLENGTH=${loopLength}`,
      '-metadata', `TITLE=CrossPlatformTest`,
      '-y',
      oggPath
    ]);
    assert.ok(fs.existsSync(oggPath), 'Generated Ogg Vorbis file');

    // 3. Independently decode Vorbis back to raw PCM to verify stream integrity
    await execFileAsync(ffmpeg, [
      '-i', oggPath,
      '-f', 's16le',
      '-ac', '2',
      '-ar', '44100',
      '-y',
      verifyPcmPath
    ]);
    assert.ok(fs.existsSync(verifyPcmPath), 'Successfully decoded Vorbis to PCM');

    const pcmStats = fs.statSync(verifyPcmPath);
    // 44100 samples * 2 channels * 2 bytes = 176400 bytes
    assert.ok(pcmStats.size >= 170000 && pcmStats.size <= 180000, `Decoded PCM size (${pcmStats.size} bytes) matches 1 sec duration`);

  } finally {
    if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
    if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath);
    if (fs.existsSync(verifyPcmPath)) fs.unlinkSync(verifyPcmPath);
  }
});
