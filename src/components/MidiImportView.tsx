import React, { useRef } from 'react';
import {
  Upload,
  Music,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sliders,
  Volume2,
  VolumeX,
  Play
} from 'lucide-react';
import { MidiRoute, MidiSongModel, SYSTEM_VOICES, VoiceId } from '../types/index.ts';
import { MidiParser } from '../services/midiParser.ts';

interface MidiImportViewProps {
  songModel: MidiSongModel | null;
  routes: MidiRoute[];
  onSongLoaded: (song: MidiSongModel, fileName: string) => void;
  onUpdateRoute: (trackIndex: number, partial: Partial<MidiRoute>) => void;
  onLoadDemo: () => void;
  currentTimeSec: number;
}

export const MidiImportView: React.FC<MidiImportViewProps> = ({
  songModel,
  routes,
  onSongLoaded,
  onUpdateRoute,
  onLoadDemo,
  currentTimeSec
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      try {
        const parser = new MidiParser(buffer);
        const song = parser.parse();
        onSongLoaded(song, file.name);
      } catch (err) {
        alert(`Failed to parse MIDI file: ${(err as Error).message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-neutral-200">
      {/* Top Controls: Import or Load Demo */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Music className="w-5 h-5 text-emerald-400" />
            <span>Standard MIDI File (SMF) Import & Track Router</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Import Format 0 or 1 MIDI files. Automatically maps the 8 primary musical tracks to fixed MIDInes and SID synthesizer voice slots, with an independent auxiliary DPCM lane.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".mid,.midi"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs border border-neutral-700 transition"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Select .MID File</span>
          </button>
          <button
            onClick={onLoadDemo}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Load Demo Chiptune (8-Trk + DPCM)</span>
          </button>
        </div>
      </div>

      {/* Song Metadata Card (if loaded) */}
      {songModel && (
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 shadow-lg grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
          <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
            <span className="text-neutral-500 text-[10px] uppercase block">SMF Format</span>
            <span className="text-white font-bold text-sm">Format {songModel.format}</span>
          </div>
          <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
            <span className="text-neutral-500 text-[10px] uppercase block">Time Resolution</span>
            <span className="text-cyan-400 font-bold text-sm">{songModel.ppq} PPQ</span>
          </div>
          <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
            <span className="text-neutral-500 text-[10px] uppercase block">Duration</span>
            <span className="text-emerald-400 font-bold text-sm">{songModel.durationSec.toFixed(2)} sec</span>
          </div>
          <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
            <span className="text-neutral-500 text-[10px] uppercase block">Total Ticks</span>
            <span className="text-amber-400 font-bold text-sm">{songModel.totalTicks}</span>
          </div>
          <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
            <span className="text-neutral-500 text-[10px] uppercase block">Track Count</span>
            <span className="text-white font-bold text-sm">{songModel.tracks.length} Tracks</span>
          </div>
        </div>
      )}

      {/* 8 Primary Tracks + 1 DPCM Routing Matrix */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300">
            8 Fixed Instrument Tracks + Auxiliary DPCM Routing Matrix
          </h3>
          <span className="text-[11px] text-neutral-500 font-mono">
            Output Port Namespace: Port A (MIDInes), Port B (MIDIbox SID)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400">
                <th className="py-2.5 px-3">Slot</th>
                <th className="py-2.5 px-3">Hardware Voice Target</th>
                <th className="py-2.5 px-3">Physical Synth</th>
                <th className="py-2.5 px-3">MIDI Port</th>
                <th className="py-2.5 px-3">MIDI Ch</th>
                <th className="py-2.5 px-3">Source Track Name</th>
                <th className="py-2.5 px-3 text-center">Mute / Solo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {routes.map((route, idx) => {
                const voiceDef = SYSTEM_VOICES.find((v) => v.id === route.voiceId);
                const isAux = route.voiceId === 'nes.dpcm';

                return (
                  <tr
                    key={route.voiceId}
                    className={`hover:bg-neutral-800/40 transition-colors ${
                      isAux ? 'bg-emerald-950/20' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold"
                        style={{ backgroundColor: `${voiceDef?.color}22`, color: voiceDef?.color }}
                      >
                        {isAux ? 'AUX' : `TRK ${idx + 1}`}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 font-semibold text-white">
                      {voiceDef?.name}
                    </td>

                    <td className="py-2.5 px-3 text-neutral-400">
                      {voiceDef?.hardware}
                    </td>

                    <td className="py-2.5 px-3">
                      <select
                        value={route.outputPortId}
                        onChange={(e) => onUpdateRoute(idx, { outputPortId: e.target.value })}
                        className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
                      >
                        <option value="port_a">Port A: MIDInes USB MIDI</option>
                        <option value="port_b">Port B: MIDIbox SID USB MIDI</option>
                        <option value="virtual_sim">Virtual Engine Simulator</option>
                      </select>
                    </td>

                    <td className="py-2.5 px-3">
                      <select
                        value={route.midiChannel}
                        onChange={(e) => onUpdateRoute(idx, { midiChannel: parseInt(e.target.value, 10) })}
                        className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
                      >
                        {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => (
                          <option key={ch} value={ch}>
                            Ch {ch}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-2.5 px-3 text-neutral-300">
                      <input
                        type="text"
                        value={route.trackName}
                        onChange={(e) => onUpdateRoute(idx, { trackName: e.target.value })}
                        className="bg-neutral-950 border border-neutral-800 focus:border-neutral-600 rounded px-2 py-1 text-xs text-neutral-200 w-full"
                      />
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onUpdateRoute(idx, { muted: !route.muted })}
                          className={`p-1 rounded text-xs transition ${
                            route.muted
                              ? 'bg-amber-600 text-white'
                              : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400'
                          }`}
                          title="Mute outgoing MIDI"
                        >
                          {route.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => onUpdateRoute(idx, { soloed: !route.soloed })}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                            route.soloed
                              ? 'bg-cyan-600 text-white'
                              : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400'
                          }`}
                          title="Solo this track"
                        >
                          S
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preflight Checklist & Diagnostics from Parser */}
      {songModel && songModel.preflightWarnings.length > 0 && (
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>Preflight Diagnostic Report ({songModel.preflightWarnings.length} Issues Detected)</span>
          </h3>

          <div className="space-y-2">
            {songModel.preflightWarnings.map((warning, wIdx) => (
              <div
                key={wIdx}
                className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-xs font-mono flex items-start gap-3"
              >
                {warning.severity === 'error' ? (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                ) : warning.severity === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="font-semibold text-neutral-200">{warning.message}</div>
                  <div className="text-neutral-400 text-[11px] font-sans">
                    <span className="text-emerald-400 font-mono">Remediation: </span>
                    {warning.suggestion}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
