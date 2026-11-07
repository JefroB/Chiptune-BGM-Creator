import React from 'react';
import {
  Play,
  Square,
  Pause,
  RotateCcw,
  Circle,
  Repeat,
  AlertTriangle,
  Radio,
  Sliders,
  Cpu,
  Save,
  FolderOpen
} from 'lucide-react';
import { MidiSongModel } from '../types/index.ts';

interface HeaderTransportProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  songModel: MidiSongModel | null;
  isPlaying: boolean;
  isPaused: boolean;
  isRecordingArmed: boolean;
  isLooping: boolean;
  currentTimeSec: number;
  totalTimeSec: number;
  currentTick: number;
  isSimulatorMode: boolean;
  setIsSimulatorMode: (val: boolean) => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRewind: () => void;
  onToggleRecordArm: () => void;
  onToggleLoop: () => void;
  onPanic: () => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
}

export const HeaderTransport: React.FC<HeaderTransportProps> = ({
  activeTab,
  setActiveTab,
  songModel,
  isPlaying,
  isPaused,
  isRecordingArmed,
  isLooping,
  currentTimeSec,
  totalTimeSec,
  currentTick,
  isSimulatorMode,
  setIsSimulatorMode,
  onPlay,
  onPause,
  onStop,
  onRewind,
  onToggleRecordArm,
  onToggleLoop,
  onPanic,
  onSaveProject,
  onLoadProject
}) => {
  // Format Time: MM:SS.mmm
  const formatTime = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  // Format Bar.Beat.Tick (PPQ = 480)
  const formatBarBeatTick = (tick: number): string => {
    const ppq = songModel?.ppq || 480;
    const ticksPerBeat = ppq;
    const ticksPerBar = ppq * 4;
    const bar = Math.floor(tick / ticksPerBar) + 1;
    const beat = Math.floor((tick % ticksPerBar) / ticksPerBeat) + 1;
    const subTick = Math.floor(tick % ticksPerBeat);
    return `${bar.toString().padStart(3, '0')}.${beat.toString().padStart(2, '0')}.${subTick.toString().padStart(3, '0')}`;
  };

  const currentBpm = songModel?.tempoMap[0]?.bpm || 120;

  return (
    <header className="bg-neutral-950 border-b border-neutral-800 text-neutral-100 select-none">
      {/* Top Studio Brand Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800/80 bg-neutral-900/60 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
            <span className="font-mono font-bold tracking-wider text-emerald-400 text-sm">
              CHIPTUNE HARDWARE WORKSTATION
            </span>
          </div>
          <span className="text-neutral-500">|</span>
          <span className="text-neutral-400 font-mono">MIDInes 5-Voice (NES APU)</span>
          <span className="text-neutral-600">+</span>
          <span className="text-neutral-400 font-mono">MIDIbox SID V2 (8-Chip Stereo)</span>
          <span className="text-neutral-600">+</span>
          <span className="text-neutral-400 font-mono">MOTU/AVB Multichannel ASIO</span>
        </div>

        {/* Studio Status Badges */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSimulatorMode(!isSimulatorMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-medium border transition-all ${
              isSimulatorMode
                ? 'bg-amber-950/60 text-amber-300 border-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                : 'bg-emerald-950/60 text-emerald-300 border-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
            }`}
            title="Toggle between Physical ASIO Hardware Setup and Live WebAudio Synth Simulator"
          >
            {isSimulatorMode ? <Cpu className="w-3.5 h-3.5 text-amber-400" /> : <Radio className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{isSimulatorMode ? 'MODE: STUDIO SIMULATOR (LIVE SYNTH)' : 'MODE: PHYSICAL ASIO / MIDI'}</span>
          </button>

          <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-700/80 px-2 py-0.5 rounded text-[11px] font-mono text-neutral-300">
            <span className="text-neutral-500">ASIO:</span>
            <span className="text-emerald-400">48.0 kHz / 128 spl</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onSaveProject}
              className="flex items-center gap-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2 py-1 rounded text-xs transition"
              title="Save project session JSON"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
            <button
              onClick={onLoadProject}
              className="flex items-center gap-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2 py-1 rounded text-xs transition"
              title="Load project session JSON"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Load</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Transport & LED Rack */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-900/90 gap-4">
        {/* Left: Vintage 7-Segment Digital Readouts */}
        <div className="flex items-center gap-3">
          {/* Time Display */}
          <div className="bg-black/90 border border-neutral-700/80 rounded px-3 py-1 font-mono shadow-inner flex flex-col items-center">
            <span className="text-[9px] uppercase tracking-wider text-neutral-500 font-sans font-semibold">Timeline</span>
            <span className="text-xl font-bold tracking-widest text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]">
              {formatTime(currentTimeSec)}
            </span>
          </div>

          {/* Bar / Beat / Tick Display */}
          <div className="bg-black/90 border border-neutral-700/80 rounded px-3 py-1 font-mono shadow-inner flex flex-col items-center">
            <span className="text-[9px] uppercase tracking-wider text-neutral-500 font-sans font-semibold">Bar . Beat . Tick</span>
            <span className="text-xl font-bold tracking-widest text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]">
              {formatBarBeatTick(currentTick)}
            </span>
          </div>

          {/* Tempo Display */}
          <div className="bg-black/90 border border-neutral-700/80 rounded px-3 py-1 font-mono shadow-inner flex flex-col items-center">
            <span className="text-[9px] uppercase tracking-wider text-neutral-500 font-sans font-semibold">Tempo</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold tracking-widest text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]">
                {currentBpm.toFixed(1)}
              </span>
              <span className="text-[10px] text-amber-500/80 font-sans">BPM</span>
            </div>
          </div>
        </div>

        {/* Center: Tactile Hardware Transport Buttons */}
        <div className="flex items-center gap-2 bg-neutral-950 p-1.5 rounded-lg border border-neutral-800 shadow-md">
          {/* Rewind */}
          <button
            onClick={onRewind}
            className="p-2.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 active:scale-95 transition shadow"
            title="Rewind to start"
            aria-label="Rewind"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Stop */}
          <button
            onClick={onStop}
            className="p-2.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 active:scale-95 transition shadow"
            title="Stop playback"
            aria-label="Stop"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>

          {/* Pause */}
          <button
            onClick={onPause}
            className={`p-2.5 rounded transition shadow active:scale-95 ${
              isPaused
                ? 'bg-amber-600 text-white shadow-[0_0_12px_rgba(245,158,11,0.6)]'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
            }`}
            title="Pause playback"
            aria-label="Pause"
          >
            <Pause className="w-4 h-4 fill-current" />
          </button>

          {/* Play */}
          <button
            onClick={onPlay}
            className={`px-4 py-2.5 rounded flex items-center gap-1.5 font-bold transition shadow active:scale-95 ${
              isPlaying && !isPaused
                ? 'bg-emerald-600 text-white shadow-[0_0_14px_rgba(16,185,129,0.8)]'
                : 'bg-emerald-700 hover:bg-emerald-600 text-emerald-100'
            }`}
            title="Play song"
            aria-label="Play"
          >
            <Play className="w-4 h-4 fill-current" />
            <span className="text-xs tracking-wider">PLAY</span>
          </button>

          {/* Loop Toggle */}
          <button
            onClick={onToggleLoop}
            className={`p-2.5 rounded transition shadow active:scale-95 ${
              isLooping
                ? 'bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.6)]'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400'
            }`}
            title="Toggle Seamless BGM Loop"
            aria-label="Loop toggle"
          >
            <Repeat className="w-4 h-4" />
          </button>

          {/* Record Arm (Master Return only) */}
          <button
            onClick={onToggleRecordArm}
            className={`flex items-center gap-1.5 px-3 py-2 rounded transition shadow active:scale-95 ${
              isRecordingArmed
                ? 'bg-red-600 text-white animate-pulse shadow-[0_0_14px_rgba(239,68,68,0.9)]'
                : 'bg-neutral-800 hover:bg-neutral-700 text-red-400'
            }`}
            title="Arm Master Return recording for Archival WAV & RPG Maker MV OGG export"
            aria-label="Arm record master return"
          >
            <Circle className="w-3.5 h-3.5 fill-current" />
            <span className="text-xs font-semibold">ARM REC</span>
          </button>
        </div>

        {/* Right: Master Output & Illuminated PANIC button */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-neutral-500 font-mono">MASTER RETURN</span>
            <span className="text-xs font-mono text-emerald-400 font-bold">MONITORED</span>
          </div>

          {/* Illuminated Red PANIC Button (All Notes Off) */}
          <button
            onClick={onPanic}
            className="flex items-center gap-1.5 px-3 py-2 rounded bg-red-700 hover:bg-red-600 active:bg-red-800 text-white font-mono font-bold text-xs shadow-[0_0_14px_rgba(220,38,38,0.7)] border border-red-500 active:scale-95 transition"
            title="Emergency All Notes Off & Sound Reset across all MIDInes & SID channels"
            aria-label="Emergency panic all notes off"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>PANIC</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-1 px-4 py-1.5 bg-neutral-950 border-t border-neutral-800/80 overflow-x-auto text-xs">
        {[
          { id: 'dashboard', label: '1. Dashboard' },
          { id: 'midi', label: '2. MIDI Import & Matrix' },
          { id: 'midines', label: '3. MIDInes Voice Editor' },
          { id: 'sid', label: '4. MIDIbox SID Editor' },
          { id: 'mixer', label: '5. Multichannel Mixer' },
          { id: 'patchbay', label: '6. ASIO Patchbay & Latency' },
          { id: 'mastering', label: '7. Master Capture & OGG Export' },
          { id: 'composer', label: '8. AI Composer Rules & Linter' },
          { id: 'protocol', label: '9. Protocol Evidence & Logs' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded font-mono font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-neutral-800 text-white border-b-2 border-emerald-400 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
};
