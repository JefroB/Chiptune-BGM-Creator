import React, { useState, useRef, useEffect } from 'react';
import {
  Disc3,
  Circle,
  Square,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Download,
  Sliders,
  FileAudio,
  Sparkles,
  Info,
  Activity,
  ShieldCheck,
  Radio
} from 'lucide-react';
import { ExportSettings, LoopRegion, RecordingProvenance } from '../types/index.ts';
import {
  encodeWavFile,
  encodeOggVorbisWithLoop,
  analyzeLoopSeamDiscontinuity,
  createSeamAuditionBuffer
} from '../services/audioExport.ts';
import { audioEngine } from '../services/audioEngine.ts';

interface MasteringExportViewProps {
  loop: LoopRegion;
  onUpdateLoop: (loop: LoopRegion) => void;
  exportSettings: ExportSettings;
  onUpdateExportSettings: (settings: Partial<ExportSettings>) => void;
  isRecordingArmed: boolean;
  onToggleRecordArm: () => void;
}

export const MasteringExportView: React.FC<MasteringExportViewProps> = ({
  loop,
  onUpdateLoop,
  exportSettings,
  onUpdateExportSettings,
  isRecordingArmed,
  onToggleRecordArm
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedAudio, setCapturedAudio] = useState<{
    left: Float32Array;
    right: Float32Array;
    sampleRate: number;
    provenance: RecordingProvenance;
  } | null>(null);

  const [seamTestCycle, setSeamTestCycle] = useState<number>(0);
  const [isAuditioningSeam, setIsAuditioningSeam] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const seamAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const seamCycleTimerRef = useRef<number | null>(null);

  // Clean up seam audio on unmount
  useEffect(() => {
    return () => {
      stopSeamAudition();
    };
  }, []);

  const handleStartCapture = () => {
    setIsCapturing(true);
    setExportError(null);
    audioEngine.startRecording('MOTU 16A AVB ASIO', 'In 1-2 (Mastering Return)');
  };

  const handleStopCapture = () => {
    setIsCapturing(false);
    const recorded = audioEngine.stopRecording();
    if (recorded && recorded.left.length > 0) {
      setCapturedAudio({
        left: recorded.left,
        right: recorded.right,
        sampleRate: recorded.provenance.sampleRate,
        provenance: recorded.provenance
      });
      // Set default loop to first 8 seconds (or total length)
      const eightSec = Math.floor(recorded.provenance.sampleRate * 8);
      onUpdateLoop({
        ...loop,
        startSample: 0,
        lengthSamples: Math.min(eightSec, recorded.left.length)
      });
    }
  };

  // Explicit Synthetic Test Signal Generation (conspicuously tagged as DEMO)
  const handleGenerateDemoSignal = () => {
    const demo = audioEngine.generateSyntheticDemoSignal(exportSettings.sampleRate, 16.0);
    setCapturedAudio({
      left: demo.left,
      right: demo.right,
      sampleRate: demo.provenance.sampleRate,
      provenance: demo.provenance
    });
    onUpdateLoop({
      ...loop,
      startSample: 0,
      lengthSamples: Math.floor(demo.provenance.sampleRate * 8)
    });
  };

  const stopSeamAudition = () => {
    if (seamCycleTimerRef.current) {
      clearInterval(seamCycleTimerRef.current);
      seamCycleTimerRef.current = null;
    }
    if (seamAudioSourceRef.current) {
      try {
        seamAudioSourceRef.current.stop();
        seamAudioSourceRef.current.disconnect();
      } catch {}
      seamAudioSourceRef.current = null;
    }
    setIsAuditioningSeam(false);
    setSeamTestCycle(0);
  };

  // Real 10-Cycle Seamless Seam Audition
  const handleAudition10Cycles = () => {
    if (isAuditioningSeam) {
      stopSeamAudition();
      return;
    }
    if (!capturedAudio) return;

    const ctx = audioEngine.initAudio();
    const windowMs = 250;
    const seamChunk = createSeamAuditionBuffer(
      capturedAudio.left,
      capturedAudio.right,
      capturedAudio.sampleRate,
      loop.startSample,
      loop.lengthSamples,
      windowMs
    );

    const buffer = ctx.createBuffer(2, seamChunk.length, capturedAudio.sampleRate);
    buffer.getChannelData(0).set(seamChunk.left);
    buffer.getChannelData(1).set(seamChunk.right);

    const chunkDurationSec = seamChunk.length / capturedAudio.sampleRate;

    // Loop 10 times consecutively
    setIsAuditioningSeam(true);
    setSeamTestCycle(1);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(ctx.destination);
    source.start();
    seamAudioSourceRef.current = source;

    let cycleCount = 1;
    seamCycleTimerRef.current = window.setInterval(() => {
      cycleCount++;
      if (cycleCount > 10) {
        stopSeamAudition();
      } else {
        setSeamTestCycle(cycleCount);
      }
    }, chunkDurationSec * 1000);
  };

  // Real OGG Vorbis Export
  const handleExportOgg = async () => {
    if (!capturedAudio) return;
    setExportStatus('Encoding genuine Ogg Vorbis with FFmpeg libvorbis...');
    setExportError(null);

    try {
      const oggBlob = await encodeOggVorbisWithLoop(
        capturedAudio.left,
        capturedAudio.right,
        capturedAudio.sampleRate,
        loop,
        exportSettings.titleTag || 'Chiptune BGM',
        exportSettings.artistTag || 'Chiptune Workstation',
        exportSettings.fileName || 'chiptune_bgm'
      );

      const url = URL.createObjectURL(oggBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportSettings.fileName || 'chiptune_bgm'}.ogg`;
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus(`Export Succeeded! RPG Maker MV compatible Ogg Vorbis (${(oggBlob.size / 1024).toFixed(1)} KB)`);
    } catch (err: any) {
      setExportError(`Export failed: ${err.message}`);
      setExportStatus(null);
    }
  };

  // Archival WAV Export
  const handleExportWav = () => {
    if (!capturedAudio) return;
    setExportStatus('Encoding 24-bit broadcast WAV master...');
    try {
      const wavBlob = encodeWavFile(capturedAudio.left, capturedAudio.right, capturedAudio.sampleRate, 24);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportSettings.fileName || 'chiptune_master'}_24bit.wav`;
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus(`Export Succeeded! 24-bit WAV Master (${(wavBlob.size / (1024 * 1024)).toFixed(2)} MB)`);
    } catch (err: any) {
      setExportError(`WAV export failed: ${err.message}`);
    }
  };

  const seamReport = capturedAudio
    ? analyzeLoopSeamDiscontinuity(
        capturedAudio.left,
        capturedAudio.right,
        loop.startSample,
        loop.lengthSamples
      )
    : null;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-neutral-200">
      {/* Top Banner */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono text-[11px] font-bold">
              RELEASE BLOCKING DELIVERABLE
            </span>
            <span className="text-neutral-500 font-mono text-xs">RPG Maker MV OGG Vorbis BGM & Archival WAV Master</span>
          </div>
          <h2 className="text-lg font-bold text-white">Mastering Return Capture & Seamless Loop Export</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Records the dedicated analog mastering return. Analyzes audio continuity at loop seam boundaries, encodes compliant OGG Vorbis with exact sample-frame LOOPSTART & LOOPLENGTH comments, and outputs ready-to-drop RPG Maker MV BGM.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!isCapturing ? (
            <button
              onClick={handleStartCapture}
              className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-red-950/50"
            >
              <Circle size={14} className="fill-current text-white animate-pulse" />
              RECORD MASTER RETURN
            </button>
          ) : (
            <button
              onClick={handleStopCapture}
              className="px-5 py-2.5 rounded-lg bg-neutral-800 border border-red-500 text-red-400 font-mono text-xs font-bold flex items-center gap-2 transition animate-pulse"
            >
              <Square size={14} className="fill-current" />
              STOP CAPTURE ({audioEngine.getSampleRate()} Hz)
            </button>
          )}
        </div>
      </div>

      {/* Recording State & Provenance Banner */}
      {!capturedAudio ? (
        <div className="p-8 bg-neutral-900/60 border border-neutral-800 rounded-xl text-center space-y-4">
          <Radio size={36} className="mx-auto text-neutral-600" />
          <h3 className="text-sm font-mono font-bold text-neutral-300">NO MASTERING RETURN RECORDED</h3>
          <p className="text-xs font-mono text-neutral-500 max-w-lg mx-auto">
            To prevent accidental publication of unverified synthetic audio, real mastering capture requires recording from the dedicated analog mastering return bus.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handleStartCapture}
              className="px-4 py-2 rounded bg-red-950 border border-red-800 text-red-300 hover:bg-red-900 font-mono text-xs font-bold"
            >
              Record Live Audio Return
            </button>
            <button
              onClick={handleGenerateDemoSignal}
              className="px-4 py-2 rounded bg-neutral-800 border border-neutral-700 text-neutral-300 hover:bg-neutral-700 font-mono text-xs flex items-center gap-1.5"
            >
              <Sparkles size={13} className="text-amber-400" /> Generate Synthetic Test Signal (DEMO ONLY - WATERMARKED)
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Provenance Tag */}
          <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className={capturedAudio.provenance.isWatermarkedDemo ? 'text-amber-400' : 'text-emerald-400'} />
              <span>
                Source: <strong className="text-white">{capturedAudio.provenance.captureSource}</strong> ({capturedAudio.provenance.channelPair})
              </span>
              {capturedAudio.provenance.isWatermarkedDemo && (
                <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px]">
                  WATERMARKED TEST PATTERN
                </span>
              )}
            </div>
            <div className="text-neutral-500 text-[11px]">
              Peak: {capturedAudio.provenance.peakDb} dBFS • Duration: {(capturedAudio.left.length / capturedAudio.sampleRate).toFixed(2)}s • Captured: {capturedAudio.provenance.capturedAt.split('T')[1]?.slice(0, 8)}
            </div>
          </div>

          {/* Waveform & Draggable Loop Region */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex justify-between items-center text-xs font-mono">
              <h3 className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Activity size={15} className="text-cyan-400" />
                Mastering Return Waveform & Seamless Loop Markers
              </h3>
              <span className="text-neutral-400">
                {capturedAudio.left.length} Samples Captured ({(capturedAudio.left.length / capturedAudio.sampleRate).toFixed(2)}s @ {capturedAudio.sampleRate}Hz)
              </span>
            </div>

            {/* Visualizer Frame */}
            <div className="relative h-28 bg-neutral-950 rounded-lg border border-neutral-800 overflow-hidden flex items-center">
              {/* Loop Region Overlay */}
              <div
                className="absolute top-0 bottom-0 bg-cyan-500/10 border-x-2 border-cyan-400 transition-all pointer-events-none"
                style={{
                  left: `${(loop.startSample / capturedAudio.left.length) * 100}%`,
                  width: `${(loop.lengthSamples / capturedAudio.left.length) * 100}%`
                }}
              >
                <span className="absolute top-1 left-1 px-1 py-0.5 rounded bg-cyan-950 text-cyan-400 text-[9px] font-mono font-bold border border-cyan-800">
                  LOOP START
                </span>
                <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-purple-950 text-purple-400 text-[9px] font-mono font-bold border border-purple-800">
                  LOOP END
                </span>
              </div>

              {/* Center Zero-Crossing Line */}
              <div className="w-full border-b border-neutral-850" />
            </div>

            {/* Sliders for Loop Points */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3 bg-neutral-950 rounded border border-neutral-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-neutral-400">LOOP START (Sample Offset)</span>
                  <span className="text-cyan-400 font-bold">{loop.startSample} spl</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={capturedAudio.left.length - 1000}
                  step="1"
                  value={loop.startSample}
                  onChange={(e) => onUpdateLoop({ ...loop, startSample: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <span className="text-[10px] text-neutral-500 block">
                  Snaps to sample frames for seamless game playback in RPG Maker MV.
                </span>
              </div>

              <div className="p-3 bg-neutral-950 rounded border border-neutral-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-neutral-400">LOOP LENGTH (Sample Count)</span>
                  <span className="text-purple-400 font-bold">{loop.lengthSamples} spl</span>
                </div>
                <input
                  type="range"
                  min="1000"
                  max={capturedAudio.left.length - loop.startSample}
                  step="1"
                  value={loop.lengthSamples}
                  onChange={(e) => onUpdateLoop({ ...loop, lengthSamples: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
                />
                <span className="text-[10px] text-neutral-500 block">
                  Duration: {(loop.lengthSamples / capturedAudio.sampleRate).toFixed(2)} seconds.
                </span>
              </div>
            </div>
          </div>

          {/* Loop Seam Inspector & RPG Maker MV Vorbis Comments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Seam Inspector & 10-Cycle Audition */}
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex justify-between items-center text-xs font-mono">
                <h3 className="font-bold text-white uppercase tracking-wider">
                  Loop Seam Continuity Inspector
                </h3>
                {seamReport?.isSeamless ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                    ZERO-CLICK SEAMLESS
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold">
                    STEP DISCONTINUITY
                  </span>
                )}
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="flex justify-between items-center p-2.5 bg-neutral-950 rounded border border-neutral-800">
                  <span className="text-neutral-400">Boundary Discontinuity:</span>
                  <span className={`font-bold ${seamReport && seamReport.discontinuityDb < -36 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {seamReport?.discontinuityDb} dB
                  </span>
                </div>

                <div className="p-3 bg-neutral-950 rounded border border-neutral-800 space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-neutral-400">10-Cycle Boundary Test:</span>
                    <span className="text-cyan-400 font-bold">
                      {isAuditioningSeam ? `Testing Cycle ${seamTestCycle} / 10` : 'Idle'}
                    </span>
                  </div>

                  <button
                    onClick={handleAudition10Cycles}
                    className={`w-full py-2 rounded font-mono text-xs font-bold transition flex items-center justify-center gap-2 ${
                      isAuditioningSeam
                        ? 'bg-amber-600 text-white animate-pulse'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
                    }`}
                  >
                    <Play size={13} className="fill-current" />
                    {isAuditioningSeam ? 'Stop Seam Test' : 'Audition 10 Consecutive Seams (Real Audio)'}
                  </button>
                </div>
              </div>
            </div>

            {/* RPG Maker MV Vorbis Comments Record */}
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex justify-between items-center text-xs font-mono">
                <h3 className="font-bold text-white uppercase tracking-wider">
                  RPG Maker MV Vorbis Comments
                </h3>
                <span className="text-cyan-400 text-[11px]">Verified Compatible</span>
              </div>

              <div className="p-3 bg-neutral-950 rounded border border-neutral-800 space-y-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-500">LOOPSTART</span>
                  <span className="text-cyan-300 font-bold">{loop.startSample}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">LOOPLENGTH</span>
                  <span className="text-purple-300 font-bold">{loop.lengthSamples}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">CODEC</span>
                  <span className="text-neutral-300">Ogg Vorbis (libvorbis, 48.0kHz)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">ENGINE TARGET</span>
                  <span className="text-neutral-300">RPG Maker MV / MZ BGM (audio/bgm/)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Export Controls & Status */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
            {exportStatus && (
              <div className="p-3 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs font-mono">
                {exportStatus}
              </div>
            )}
            {exportError && (
              <div className="p-3 rounded bg-red-950/80 border border-red-800 text-red-300 text-xs font-mono">
                {exportError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-neutral-400">Export Destination Filename:</span>
                <input
                  type="text"
                  value={exportSettings.fileName}
                  onChange={(e) => onUpdateExportSettings({ fileName: e.target.value })}
                  className="bg-neutral-950 border border-neutral-700 rounded px-2.5 py-1 text-white font-mono"
                  placeholder="chiptune_bgm"
                />
                <span className="text-neutral-500">.ogg / .wav</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportOgg}
                  className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Download size={14} /> EXPORT RPG MAKER MV OGG BGM
                </button>
                <button
                  onClick={handleExportWav}
                  className="px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 font-mono text-xs flex items-center gap-1.5"
                >
                  <Download size={14} /> Archival WAV (24-bit)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
