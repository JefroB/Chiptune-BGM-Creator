/**
 * Chiptune Hardware Workstation - Express Backend & Real Ogg Vorbis Export Server
 * Integrates Vite middleware in development and provides native FFmpeg / libvorbis
 * encoding with sample-accurate RPG Maker MV LOOPSTART & LOOPLENGTH metadata.
 */

import express, { Request, Response } from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Allow large WAV audio payloads (up to 50MB)
app.use(express.json({ limit: '50mb' }));

/**
 * Cross-platform FFmpeg / FFprobe executable locator
 * Supports Windows PATH / Program Files / AppData and Linux / Unix paths
 */
async function resolveBinary(name: 'ffmpeg' | 'ffprobe'): Promise<string> {
  const envVar = name === 'ffmpeg' ? process.env.FFMPEG_PATH : process.env.FFPROBE_PATH;
  if (envVar && fs.existsSync(envVar)) {
    return envVar;
  }

  const isWin = process.platform === 'win32';
  const binaryName = isWin ? `${name}.exe` : name;

  if (isWin) {
    const winCandidates = [
      `C:\\ffmpeg\\bin\\${binaryName}`,
      `C:\\Program Files\\ffmpeg\\bin\\${binaryName}`,
      `C:\\Program Files (x86)\\ffmpeg\\bin\\${binaryName}`,
      path.join(process.cwd(), 'bin', binaryName),
      path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages', binaryName),
      binaryName
    ];
    for (const cand of winCandidates) {
      if (fs.existsSync(cand)) return cand;
    }
    try {
      const { stdout } = await execFileAsync('where.exe', [binaryName]);
      const first = stdout.trim().split(/\r?\n/)[0];
      if (first && fs.existsSync(first)) return first;
    } catch {}
    return binaryName;
  }

  const unixCandidates = [
    `/usr/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/opt/homebrew/bin/${name}`,
    name
  ];
  for (const cand of unixCandidates) {
    if (fs.existsSync(cand)) return cand;
  }

  try {
    const { stdout } = await execFileAsync('which', [name]);
    const first = stdout.trim().split('\n')[0];
    if (first && fs.existsSync(first)) return first;
  } catch {}

  return name;
}

/**
 * POST /api/export-vorbis
 * Encodes audio using genuine libvorbis with cross-platform FFmpeg resolution,
 * sets exact RPG Maker MV LOOPSTART & LOOPLENGTH tags, and independently verifies
 * by decoding back to raw PCM and probing metadata.
 */
app.post('/api/export-vorbis', async (req: Request, res: Response): Promise<void> => {
  const { wavBase64, loopStart, loopLength, sampleRate, title, artist, fileName } = req.body;

  if (!wavBase64) {
    res.status(400).json({ error: 'Missing wavBase64 payload' });
    return;
  }

  const loopStartInt = Math.max(0, Math.floor(Number(loopStart) || 0));
  const loopLengthInt = Math.max(1, Math.floor(Number(loopLength) || (sampleRate || 48000) * 8));
  const outFileName = (fileName || 'chiptune_bgm').replace(/[^a-zA-Z0-9_-]/g, '_') + '.ogg';

  const tmpDir = os.tmpdir();
  const id = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const tmpWavPath = path.join(tmpDir, `input_${id}.wav`);
  const tmpOggPath = path.join(tmpDir, `output_${id}.ogg`);
  const tmpDecodedPcmPath = path.join(tmpDir, `verify_${id}.raw`);

  try {
    // Write WAV buffer to temp file
    const wavBuffer = Buffer.from(wavBase64, 'base64');
    await fs.promises.writeFile(tmpWavPath, wavBuffer);

    // Resolve FFmpeg & FFprobe cross-platform binaries
    const ffmpegBin = await resolveBinary('ffmpeg');
    const ffprobeBin = await resolveBinary('ffprobe');

    // Run FFmpeg with libvorbis
    // Sets exact uppercase LOOPSTART and LOOPLENGTH tags required by RPG Maker MV and MZ
    const ffmpegArgs = [
      '-y',
      '-i', tmpWavPath,
      '-c:a', 'libvorbis',
      '-qscale:a', '6',
      '-metadata', `LOOPSTART=${loopStartInt}`,
      '-metadata', `LOOPLENGTH=${loopLengthInt}`,
      '-metadata', `TITLE=${title || 'Chiptune BGM'}`,
      '-metadata', `ARTIST=${artist || 'Chiptune Workstation'}`,
      tmpOggPath
    ];

    await execFileAsync(ffmpegBin, ffmpegArgs);

    // 1. Independent validation: verify with ffprobe
    const ffprobeArgs = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      tmpOggPath
    ];
    const { stdout: probeStdout } = await execFileAsync(ffprobeBin, ffprobeArgs);
    const probeData = JSON.parse(probeStdout);

    const stream = probeData.streams?.[0] || {};
    const tags = { ...(probeData.format?.tags || {}), ...(stream.tags || {}) };

    if (stream.codec_name !== 'vorbis') {
      throw new Error(`Independent verification failed: Output codec is ${stream.codec_name}, expected vorbis`);
    }

    const startTag = tags.LOOPSTART || tags.loopstart;
    const lenTag = tags.LOOPLENGTH || tags.looplength;
    if (!startTag || !lenTag) {
      throw new Error('Independent verification failed: Missing required LOOPSTART or LOOPLENGTH Vorbis comment');
    }

    // 2. Independent validation: decode back to raw float32 PCM using ffmpeg to verify decodability
    await execFileAsync(ffmpegBin, [
      '-y',
      '-i', tmpOggPath,
      '-f', 'f32le',
      '-acodec', 'pcm_f32le',
      tmpDecodedPcmPath
    ]);
    const decodedStats = await fs.promises.stat(tmpDecodedPcmPath);
    if (decodedStats.size === 0) {
      throw new Error('Independent verification failed: Decoded Vorbis stream yielded 0 bytes');
    }

    // Read generated genuine Ogg Vorbis binary
    const oggBuffer = await fs.promises.readFile(tmpOggPath);

    res.setHeader('Content-Type', 'audio/ogg');
    res.setHeader('Content-Disposition', `attachment; filename="${outFileName}"`);
    res.setHeader('X-Loop-Start', String(loopStartInt));
    res.setHeader('X-Loop-Length', String(loopLengthInt));
    res.setHeader('X-Vorbis-Verified', 'true');
    res.setHeader('X-Decoded-Bytes', String(decodedStats.size));
    res.send(oggBuffer);
  } catch (err: any) {
    console.error('Error during Vorbis export:', err);
    res.status(500).json({
      error: 'Failed to encode Vorbis audio',
      details: err.message
    });
  } finally {
    // Cleanup temporary files
    try { await fs.promises.unlink(tmpWavPath); } catch {}
    try { await fs.promises.unlink(tmpOggPath); } catch {}
    try { await fs.promises.unlink(tmpDecodedPcmPath); } catch {}
  }
});

/**
 * POST /api/probe-audio
 * Diagnostic endpoint to probe any audio binary for duration, codec, and RPG Maker loop tags
 */
app.post('/api/probe-audio', async (req: Request, res: Response): Promise<void> => {
  const { audioBase64, format } = req.body;
  if (!audioBase64) {
    res.status(400).json({ error: 'Missing audioBase64' });
    return;
  }

  const tmpDir = os.tmpdir();
  const id = `${Date.now()}_probe_${Math.random().toString(36).substring(2, 8)}`;
  const ext = format === 'wav' ? '.wav' : '.ogg';
  const tmpPath = path.join(tmpDir, `probe_${id}${ext}`);

  try {
    await fs.promises.writeFile(tmpPath, Buffer.from(audioBase64, 'base64'));
    const ffprobeBin = await resolveBinary('ffprobe');
    const { stdout } = await execFileAsync(ffprobeBin, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      tmpPath
    ]);
    res.json(JSON.parse(stdout));
  } catch (err: any) {
    res.status(500).json({ error: 'ffprobe failed', details: err.message });
  } finally {
    try { await fs.promises.unlink(tmpPath); } catch {}
  }
});

async function startServer() {
  if (!isProduction) {
    // Development mode: attach Vite middleware bound to httpServer
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: isHmrDisabled ? false : { server: httpServer },
        hmr: isHmrDisabled ? false : { server: httpServer }
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: serve built assets
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Chiptune Server] Running on http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer();
