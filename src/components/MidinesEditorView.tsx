import React, { useState } from 'react';
import {
  Volume2,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Play,
  Search,
  Filter,
  Download,
  Info
} from 'lucide-react';
import { MidinesState } from '../types/index.ts';
import {
  DPCM_SAMPLES_RAW,
  filterSamples,
  DpcmCategory,
  categorizeSample
} from '../data/dpcmMapping.ts';
import { audioEngine } from '../services/audioEngine.ts';

interface MidinesEditorViewProps {
  midinesState: MidinesState;
  onUpdateState: (partial: Partial<MidinesState>) => void;
}

export const MidinesEditorView: React.FC<MidinesEditorViewProps> = ({
  midinesState,
  onUpdateState
}) => {
  const [activeVoice, setActiveVoice] = useState<'pulse1' | 'pulse2' | 'triangle' | 'noise' | 'dpcm'>('pulse1');
  const [dpcmCategory, setDpcmCategory] = useState<DpcmCategory>('ALL');
  const [dpcmSearch, setDpcmSearch] = useState('');
  const [selectedSampleNote, setSelectedSampleNote] = useState<number | null>(null);

  // Filtered samples for browser
  const filteredSamples = filterSamples(
    midinesState.dpcm.activeBank,
    dpcmCategory,
    dpcmSearch
  );

  const handleAuditionNote = (note: number) => {
    setSelectedSampleNote(note);
    if (activeVoice === 'dpcm') {
      audioEngine.triggerNoteOn('nes.dpcm', note, 110);
      setTimeout(() => audioEngine.triggerNoteOff('nes.dpcm', note), 200);
    } else if (activeVoice === 'pulse1') {
      audioEngine.triggerNoteOn('nes.pulse1', note, 100);
      setTimeout(() => audioEngine.triggerNoteOff('nes.pulse1', note), 300);
    } else if (activeVoice === 'pulse2') {
      audioEngine.triggerNoteOn('nes.pulse2', note, 100);
      setTimeout(() => audioEngine.triggerNoteOff('nes.pulse2', note), 300);
    } else if (activeVoice === 'triangle') {
      audioEngine.triggerNoteOn('nes.triangle', note, 120);
      setTimeout(() => audioEngine.triggerNoteOff('nes.triangle', note), 300);
    } else if (activeVoice === 'noise') {
      audioEngine.triggerNoteOn('nes.noise', note, 100);
      setTimeout(() => audioEngine.triggerNoteOff('nes.noise', note), 200);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-neutral-200">
      {/* Header and Voice Selector */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800 font-mono text-[11px] font-bold">
              WAYFAR MIDINES v1.1.0
            </span>
            <span className="text-neutral-500 font-mono text-xs">Nintendo Entertainment System APU Synthesizer</span>
          </div>
          <h2 className="text-lg font-bold text-white">MIDInes 5-Voice Synthesizer Control</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Physical mono analog audio output. Channels 1-4 provide 4-bit APU pitch/noise voices; Channel 5 provides the 256-sample DPCM drum machine.
          </p>
        </div>

        {/* Voice Selector Tabs */}
        <div className="flex items-center gap-1.5 bg-neutral-950 p-1.5 rounded-lg border border-neutral-800 font-mono text-xs">
          {[
            { id: 'pulse1', label: 'Pulse 1 (Ch 1)' },
            { id: 'pulse2', label: 'Pulse 2 (Ch 2)' },
            { id: 'triangle', label: 'Triangle (Ch 3)' },
            { id: 'noise', label: 'Noise (Ch 4)' },
            { id: 'dpcm', label: 'DPCM Aux (Ch 5)' }
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setActiveVoice(v.id as typeof activeVoice)}
              className={`px-3 py-1.5 rounded transition ${
                activeVoice === v.id
                  ? 'bg-neutral-800 text-white font-bold shadow'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Voice Parameter Panels */}
      {activeVoice === 'pulse1' && (
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-6">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
              NES Pulse 1 Parameters (CC11 Volume, CC12 Fine Pitch, CC13 Sweep, CC71 Duty)
            </h3>
            <button
              onClick={() => handleAuditionNote(60)}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono"
            >
              <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
              <span>Audition C4 (Note 60)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs font-mono">
            {/* Duty Cycle */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 space-y-3">
              <label className="text-neutral-400 block font-bold">Duty Cycle (CC 71)</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: 0, label: '12.5% (Thin)' },
                  { val: 1, label: '25% (Hollow)' },
                  { val: 2, label: '50% (Square)' },
                  { val: 3, label: '75% (Rich)' }
                ].map((d) => (
                  <button
                    key={d.val}
                    onClick={() =>
                      onUpdateState({
                        pulse1: { ...midinesState.pulse1, duty: d.val as 0 | 1 | 2 | 3 }
                      })
                    }
                    className={`py-2 px-2 rounded border text-center transition ${
                      midinesState.pulse1.duty === d.val
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Volume / Envelope */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <label className="text-neutral-400 font-bold">APU Volume (CC 11)</label>
                <span className="text-emerald-400 font-bold">{midinesState.pulse1.volume} / 15</span>
              </div>
              <input
                type="range"
                min="0"
                max="15"
                value={midinesState.pulse1.volume}
                onChange={(e) =>
                  onUpdateState({
                    pulse1: { ...midinesState.pulse1, volume: parseInt(e.target.value, 10) }
                  })
                }
                className="w-full accent-emerald-500"
              />
              <span className="text-[10px] text-neutral-500 font-sans block">
                Direct 4-bit NES volume register ($4000)
              </span>
            </div>

            {/* Fine Pitch */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <label className="text-neutral-400 font-bold">Fine Pitch Detune (CC 12)</label>
                <span className="text-cyan-400 font-bold">{midinesState.pulse1.finePitch - 64}</span>
              </div>
              <input
                type="range"
                min="0"
                max="127"
                value={midinesState.pulse1.finePitch}
                onChange={(e) =>
                  onUpdateState({
                    pulse1: { ...midinesState.pulse1, finePitch: parseInt(e.target.value, 10) }
                  })
                }
                className="w-full accent-cyan-500"
              />
              <span className="text-[10px] text-neutral-500 font-sans block">
                0-127 MIDI range (64 = center / no detune)
              </span>
            </div>

            {/* Hardware Sweep */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-neutral-400 font-bold">Hardware Sweep (CC 13)</label>
                <button
                  onClick={() =>
                    onUpdateState({
                      pulse1: { ...midinesState.pulse1, sweepEnabled: !midinesState.pulse1.sweepEnabled }
                    })
                  }
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    midinesState.pulse1.sweepEnabled
                      ? 'bg-amber-600 text-white'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {midinesState.pulse1.sweepEnabled ? 'ENABLED' : 'OFF'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-neutral-500">Dir:</span>
                <button
                  onClick={() =>
                    onUpdateState({
                      pulse1: { ...midinesState.pulse1, sweepDirection: 'up' }
                    })
                  }
                  className={`px-2 py-1 rounded text-xs ${
                    midinesState.pulse1.sweepDirection === 'up'
                      ? 'bg-neutral-700 text-white font-bold'
                      : 'bg-neutral-900 text-neutral-400'
                  }`}
                >
                  UP
                </button>
                <button
                  onClick={() =>
                    onUpdateState({
                      pulse1: { ...midinesState.pulse1, sweepDirection: 'down' }
                    })
                  }
                  className={`px-2 py-1 rounded text-xs ${
                    midinesState.pulse1.sweepDirection === 'down'
                      ? 'bg-neutral-700 text-white font-bold'
                      : 'bg-neutral-900 text-neutral-400'
                  }`}
                >
                  DOWN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DPCM 256-Sample Library & Verification Wizard */}
      {activeVoice === 'dpcm' && (
        <div className="space-y-6">
          {/* Hardware Verification Banner */}
          <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-4 text-xs font-mono flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-amber-300">
                PROVENANCE STATUS: INFERRED FROM NULLSLEEP ARCHIVE ORDER (NOT HARDWARE VERIFIED)
              </div>
              <p className="text-neutral-300 font-sans text-xs">
                Bank 1 samples map to archive tracks 06-133 (notes 0-127, CC14=0). Bank 2 samples map to tracks 134-261 (notes 0-127, CC14=64).
                Audition notes against your actual physical cartridge below to verify or correct note mapping.
              </p>
            </div>
          </div>

          {/* DPCM Bank & Audition Controls */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Bank Select Buttons */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-neutral-400">ACTIVE DPCM BANK:</span>
                <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                  <button
                    onClick={() =>
                      onUpdateState({
                        dpcm: { ...midinesState.dpcm, activeBank: 1 }
                      })
                    }
                    className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition ${
                      midinesState.dpcm.activeBank === 1
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    BANK 1 (CC14 = 0 | Samples 1-128)
                  </button>
                  <button
                    onClick={() =>
                      onUpdateState({
                        dpcm: { ...midinesState.dpcm, activeBank: 2 }
                      })
                    }
                    className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition ${
                      midinesState.dpcm.activeBank === 2
                        ? 'bg-cyan-600 text-white shadow'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    BANK 2 (CC14 = 64 | Samples 129-256)
                  </button>
                </div>
              </div>

              {/* Sample Search & Filter */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-56">
                  <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={dpcmSearch}
                    onChange={(e) => setDpcmSearch(e.target.value)}
                    placeholder="Search 256 samples..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Category Badges */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-mono">
              {[
                'ALL',
                'BD',
                'SD',
                'CH',
                'OH',
                'CLAP',
                'TOM',
                'CRASH',
                'BREAKS',
                'VOX',
                'SFX',
                'PITCHED_NOISE'
              ].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setDpcmCategory(cat as DpcmCategory)}
                  className={`px-2 py-0.5 rounded border transition shrink-0 ${
                    dpcmCategory === cat
                      ? 'bg-neutral-700 border-neutral-500 text-white font-bold'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:bg-neutral-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* 128 Note Pad Grid (Audition surface) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                <span>Audition Pad Grid (Bank {midinesState.dpcm.activeBank} Notes 0 to 127)</span>
                <span className="text-[11px] text-emerald-400">
                  {selectedSampleNote !== null ? `Auditioning Note ${selectedSampleNote}` : 'Click any pad to play'}
                </span>
              </div>

              <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5 max-h-56 overflow-y-auto p-2 bg-neutral-950 border border-neutral-800 rounded-lg">
                {filteredSamples.map((sample) => (
                  <button
                    key={`${sample.bank}_${sample.midi_note}`}
                    onClick={() => handleAuditionNote(sample.midi_note)}
                    className={`p-1.5 rounded flex flex-col items-center justify-between text-center transition border ${
                      selectedSampleNote === sample.midi_note
                        ? 'bg-emerald-600 border-emerald-400 text-white font-bold scale-95 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                        : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-300'
                    }`}
                    title={`${sample.note_name} (Note ${sample.midi_note}) - ${sample.sample_label}`}
                  >
                    <span className="text-[9px] font-mono text-neutral-400">{sample.midi_note}</span>
                    <span className="text-[10px] font-bold text-emerald-400 truncate max-w-full">
                      {sample.sample_label}
                    </span>
                    <span className="text-[8px] text-neutral-500 font-mono">{sample.note_name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sample Table with Provenance Details */}
            <div className="overflow-x-auto max-h-60 border border-neutral-800 rounded-lg">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-neutral-950 text-neutral-400 sticky top-0">
                  <tr className="border-b border-neutral-800">
                    <th className="py-2 px-3">Bank</th>
                    <th className="py-2 px-3">Note</th>
                    <th className="py-2 px-3">Pitch</th>
                    <th className="py-2 px-3">Sample Label</th>
                    <th className="py-2 px-3">Archive File</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Audition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 bg-neutral-950/60">
                  {filteredSamples.slice(0, 30).map((sample) => (
                    <tr key={`${sample.bank}_${sample.midi_note}`} className="hover:bg-neutral-900/80">
                      <td className="py-2 px-3 text-neutral-400">Bank {sample.bank}</td>
                      <td className="py-2 px-3 font-bold text-white">{sample.midi_note}</td>
                      <td className="py-2 px-3 text-cyan-400">{sample.note_name}</td>
                      <td className="py-2 px-3 font-semibold text-emerald-400">{sample.sample_label}</td>
                      <td className="py-2 px-3 text-neutral-500 text-[11px] truncate max-w-xs">{sample.archive_filename}</td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950 text-amber-300 border border-amber-800">
                          Inferred
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => handleAuditionNote(sample.midi_note)}
                          className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs transition"
                        >
                          Audition
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Pulse 2, Triangle, and Noise Panels */}
      {activeVoice === 'pulse2' && (
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
              NES Pulse 2 Parameters (CC11 Volume, CC12 Fine Pitch, CC13 Sweep, CC71 Duty)
            </h3>
            <button
              onClick={() => handleAuditionNote(64)}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono"
            >
              <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
              <span>Audition E4 (Note 64)</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs font-mono">
            <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 space-y-3">
              <label className="text-neutral-400 font-bold block">Duty Cycle (CC 71)</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: 0, label: '12.5%' },
                  { val: 1, label: '25%' },
                  { val: 2, label: '50%' },
                  { val: 3, label: '75%' }
                ].map((d) => (
                  <button
                    key={d.val}
                    onClick={() =>
                      onUpdateState({
                        pulse2: { ...midinesState.pulse2, duty: d.val as 0 | 1 | 2 | 3 }
                      })
                    }
                    className={`py-1.5 rounded border text-center transition ${
                      midinesState.pulse2.duty === d.val
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 space-y-3">
              <label className="text-neutral-400 font-bold block">Volume (CC 11): {midinesState.pulse2.volume}</label>
              <input
                type="range"
                min="0"
                max="15"
                value={midinesState.pulse2.volume}
                onChange={(e) =>
                  onUpdateState({
                    pulse2: { ...midinesState.pulse2, volume: parseInt(e.target.value, 10) }
                  })
                }
                className="w-full accent-emerald-500"
              />
            </div>
            <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 space-y-3">
              <label className="text-neutral-400 font-bold block">Fine Pitch (CC 12): {midinesState.pulse2.finePitch - 64}</label>
              <input
                type="range"
                min="0"
                max="127"
                value={midinesState.pulse2.finePitch}
                onChange={(e) =>
                  onUpdateState({
                    pulse2: { ...midinesState.pulse2, finePitch: parseInt(e.target.value, 10) }
                  })
                }
                className="w-full accent-cyan-500"
              />
            </div>
          </div>
        </div>
      )}

      {activeVoice === 'triangle' && (
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
              NES Triangle Bass (True 16-Step Quantized Triangle)
            </h3>
            <button
              onClick={() => handleAuditionNote(36)}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono"
            >
              <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
              <span>Audition C1 Bass (Note 36)</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono">
            <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 space-y-3">
              <label className="text-neutral-400 font-bold block">Linear Counter / Gate: {midinesState.triangle.linearCounter}</label>
              <input
                type="range"
                min="0"
                max="127"
                value={midinesState.triangle.linearCounter}
                onChange={(e) =>
                  onUpdateState({
                    triangle: { ...midinesState.triangle, linearCounter: parseInt(e.target.value, 10) }
                  })
                }
                className="w-full accent-emerald-500"
              />
              <span className="text-[10px] text-neutral-500 font-sans block">
                NES APU Triangle has no volume envelope; volume is strictly on/off via linear counter ($4008).
              </span>
            </div>
            <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 space-y-3">
              <label className="text-neutral-400 font-bold block">Fine Pitch Detune (CC 12): {midinesState.triangle.finePitch - 64}</label>
              <input
                type="range"
                min="0"
                max="127"
                value={midinesState.triangle.finePitch}
                onChange={(e) =>
                  onUpdateState({
                    triangle: { ...midinesState.triangle, finePitch: parseInt(e.target.value, 10) }
                  })
                }
                className="w-full accent-cyan-500"
              />
            </div>
          </div>
        </div>
      )}

      {activeVoice === 'noise' && (
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
              NES Pseudo-Random Noise (CC70 Mode, CC11 Volume)
            </h3>
            <button
              onClick={() => handleAuditionNote(60)}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono"
            >
              <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
              <span>Audition Noise Hit</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs font-mono">
            <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 space-y-3">
              <label className="text-neutral-400 font-bold block">LFSR Loop Mode (CC 70)</label>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    onUpdateState({
                      noise: { ...midinesState.noise, mode: 'long' }
                    })
                  }
                  className={`flex-1 py-2 rounded border text-center transition ${
                    midinesState.noise.mode === 'long'
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-bold'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  32,767-step Periodic
                </button>
                <button
                  onClick={() =>
                    onUpdateState({
                      noise: { ...midinesState.noise, mode: 'short' }
                    })
                  }
                  className={`flex-1 py-2 rounded border text-center transition ${
                    midinesState.noise.mode === 'short'
                      ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  93-step Metallic
                </button>
              </div>
            </div>
            <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 space-y-3">
              <label className="text-neutral-400 font-bold block">Volume (CC 11): {midinesState.noise.volume}</label>
              <input
                type="range"
                min="0"
                max="15"
                value={midinesState.noise.volume}
                onChange={(e) =>
                  onUpdateState({
                    noise: { ...midinesState.noise, volume: parseInt(e.target.value, 10) }
                  })
                }
                className="w-full accent-emerald-500"
              />
            </div>
            <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 space-y-3">
              <label className="text-neutral-400 font-bold block">Pitch Period Table Index: {midinesState.noise.pitchIndex}</label>
              <input
                type="range"
                min="0"
                max="15"
                value={midinesState.noise.pitchIndex}
                onChange={(e) =>
                  onUpdateState({
                    noise: { ...midinesState.noise, pitchIndex: parseInt(e.target.value, 10) }
                  })
                }
                className="w-full accent-amber-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
