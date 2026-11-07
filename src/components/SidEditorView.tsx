import React, { useState } from 'react';
import {
  Cpu,
  Layers,
  Sliders,
  Play,
  Save,
  RotateCcw,
  Sparkles,
  Radio
} from 'lucide-react';
import { SidChipModel, SidCorePatch, SidEngineType } from '../types/index.ts';
import { audioEngine } from '../services/audioEngine.ts';

interface SidEditorViewProps {
  sidPatches: [SidCorePatch, SidCorePatch, SidCorePatch, SidCorePatch];
  onUpdatePatch: (coreIndex: number, patch: Partial<SidCorePatch>) => void;
}

export const SidEditorView: React.FC<SidEditorViewProps> = ({
  sidPatches,
  onUpdatePatch
}) => {
  const [selectedCoreIdx, setSelectedCoreIdx] = useState<number>(0);
  const activePatch = sidPatches[selectedCoreIdx];

  const handleAuditionCore = (note = 60) => {
    const voiceId = activePatch.coreId;
    audioEngine.triggerNoteOn(voiceId, note, 115);
    setTimeout(() => audioEngine.triggerNoteOff(voiceId, note), 350);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-neutral-200">
      {/* Top Header & Core Selector */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono text-[11px] font-bold">
              MIDIBOX SID V2
            </span>
            <span className="text-neutral-500 font-mono text-xs">8-Chip Multichannel Commodore 64 Synthesizer Rig</span>
          </div>
          <h2 className="text-lg font-bold text-white">MIDIbox SID 4-Core Stereo Synth Matrix</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Four independent stereo pairs (8 physical SID sockets). Supports mixed 6581 and 8580 chip models per socket with analog filter curve modeling.
          </p>
        </div>

        {/* 4 Core Selector Tabs */}
        <div className="flex items-center gap-1.5 bg-neutral-950 p-1.5 rounded-lg border border-neutral-800 font-mono text-xs">
          {sidPatches.map((patch, idx) => (
            <button
              key={patch.coreId}
              onClick={() => setSelectedCoreIdx(idx)}
              className={`px-3 py-1.5 rounded transition ${
                selectedCoreIdx === idx
                  ? 'bg-neutral-800 text-cyan-400 font-bold shadow'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Core {idx + 1} (Stereo Pair {idx + 1})
            </button>
          ))}
        </div>
      </div>

      {/* Main Core Configuration & Socket Hardware Profile */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-mono font-bold text-white">
              {activePatch.name}
            </h3>

            {/* Engine Type */}
            <div className="flex items-center gap-1 text-xs font-mono">
              <span className="text-neutral-500">Engine:</span>
              <select
                value={activePatch.engine}
                onChange={(e) =>
                  onUpdatePatch(selectedCoreIdx, { engine: e.target.value as SidEngineType })
                }
                className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-cyan-300 font-semibold"
              >
                <option value="lead">Lead Engine</option>
                <option value="bassline">Bassline (TB-303)</option>
                <option value="multi">Multi-Polyphonic</option>
                <option value="drum">Drum & FX Engine</option>
              </select>
            </div>
          </div>

          {/* Physical Socket Chip Models */}
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5 bg-neutral-950 border border-neutral-800 px-2.5 py-1 rounded">
              <span className="text-neutral-500">Left Socket:</span>
              <select
                value={activePatch.socketLeftModel}
                onChange={(e) =>
                  onUpdatePatch(selectedCoreIdx, { socketLeftModel: e.target.value as SidChipModel })
                }
                className="bg-transparent text-amber-400 font-bold focus:outline-none"
              >
                <option value="6581">MOS 6581 (Warm/Dirty)</option>
                <option value="8580">CSG 8580 (Clean/Resonant)</option>
                <option value="6582">MOS 6582</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-neutral-950 border border-neutral-800 px-2.5 py-1 rounded">
              <span className="text-neutral-500">Right Socket:</span>
              <select
                value={activePatch.socketRightModel}
                onChange={(e) =>
                  onUpdatePatch(selectedCoreIdx, { socketRightModel: e.target.value as SidChipModel })
                }
                className="bg-transparent text-amber-400 font-bold focus:outline-none"
              >
                <option value="6581">MOS 6581 (Warm/Dirty)</option>
                <option value="8580">CSG 8580 (Clean/Resonant)</option>
                <option value="6582">MOS 6582</option>
              </select>
            </div>

            <button
              onClick={() => handleAuditionCore(60)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Audition</span>
            </button>
          </div>
        </div>

        {/* Oscillators, Filter, and Envelopes Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs font-mono">
          {/* Section 1: Oscillators (OSC 1, 2, 3) */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 space-y-4">
            <h4 className="text-neutral-400 font-bold uppercase tracking-wider text-[11px] border-b border-neutral-800 pb-2">
              Voice Oscillators (NRPN 0x0100)
            </h4>

            {/* OSC 1 */}
            <div className="space-y-2">
              <div className="flex justify-between text-neutral-300 font-semibold">
                <span>OSC 1: Sawtooth & Pulse</span>
                <span className="text-cyan-400">{activePatch.osc1.waveform}</span>
              </div>
              <div className="flex gap-1.5">
                {(['saw', 'pulse', 'triangle', 'noise'] as const).map((wf) => (
                  <button
                    key={wf}
                    onClick={() =>
                      onUpdatePatch(selectedCoreIdx, {
                        osc1: { ...activePatch.osc1, waveform: wf }
                      })
                    }
                    className={`flex-1 py-1 rounded border text-center transition ${
                      activePatch.osc1.waveform === wf
                        ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    {wf.toUpperCase()}
                  </button>
                ))}
              </div>
              <div>
                <div className="flex justify-between text-neutral-500 text-[10px]">
                  <span>Pulse Width: {activePatch.osc1.pulseWidth}</span>
                  <span>(0-4095 12-bit)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="4095"
                  value={activePatch.osc1.pulseWidth}
                  onChange={(e) =>
                    onUpdatePatch(selectedCoreIdx, {
                      osc1: { ...activePatch.osc1, pulseWidth: parseInt(e.target.value, 10) }
                    })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>
            </div>

            {/* Hard Sync & Ring Mod */}
            <div className="flex items-center gap-3 pt-2 border-t border-neutral-800">
              <button
                onClick={() =>
                  onUpdatePatch(selectedCoreIdx, {
                    osc1: { ...activePatch.osc1, sync: !activePatch.osc1.sync }
                  })
                }
                className={`flex-1 py-1.5 rounded border text-center transition ${
                  activePatch.osc1.sync
                    ? 'bg-amber-950 border-amber-500 text-amber-300 font-bold'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                }`}
              >
                HARD SYNC
              </button>
              <button
                onClick={() =>
                  onUpdatePatch(selectedCoreIdx, {
                    osc1: { ...activePatch.osc1, ringMod: !activePatch.osc1.ringMod }
                  })
                }
                className={`flex-1 py-1.5 rounded border text-center transition ${
                  activePatch.osc1.ringMod
                    ? 'bg-purple-950 border-purple-500 text-purple-300 font-bold'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                }`}
              >
                RING MOD
              </button>
            </div>
          </div>

          {/* Section 2: Resonant SID Filter */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 space-y-4">
            <h4 className="text-neutral-400 font-bold uppercase tracking-wider text-[11px] border-b border-neutral-800 pb-2">
              Resonant Multimode Filter (NRPN 0x0140)
            </h4>

            {/* Cutoff Slider */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-neutral-400 font-semibold">Filter Cutoff</span>
                <span className="text-cyan-400 font-bold">{activePatch.filter.cutoff} / 2047</span>
              </div>
              <input
                type="range"
                min="0"
                max="2047"
                value={activePatch.filter.cutoff}
                onChange={(e) =>
                  onUpdatePatch(selectedCoreIdx, {
                    filter: { ...activePatch.filter, cutoff: parseInt(e.target.value, 10) }
                  })
                }
                className="w-full accent-cyan-500"
              />
            </div>

            {/* Resonance Slider */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-neutral-400 font-semibold">Filter Resonance</span>
                <span className="text-amber-400 font-bold">{activePatch.filter.resonance} / 15</span>
              </div>
              <input
                type="range"
                min="0"
                max="15"
                value={activePatch.filter.resonance}
                onChange={(e) =>
                  onUpdatePatch(selectedCoreIdx, {
                    filter: { ...activePatch.filter, resonance: parseInt(e.target.value, 10) }
                  })
                }
                className="w-full accent-amber-500"
              />
            </div>

            {/* Filter Modes */}
            <div className="space-y-2 pt-2 border-t border-neutral-800">
              <span className="text-neutral-400 text-[10px] block">Filter Routing Modes:</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() =>
                    onUpdatePatch(selectedCoreIdx, {
                      filter: { ...activePatch.filter, lowPass: !activePatch.filter.lowPass }
                    })
                  }
                  className={`py-1.5 rounded border text-center transition ${
                    activePatch.filter.lowPass
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-bold'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  LOWPASS
                </button>
                <button
                  onClick={() =>
                    onUpdatePatch(selectedCoreIdx, {
                      filter: { ...activePatch.filter, bandPass: !activePatch.filter.bandPass }
                    })
                  }
                  className={`py-1.5 rounded border text-center transition ${
                    activePatch.filter.bandPass
                      ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  BANDPASS
                </button>
                <button
                  onClick={() =>
                    onUpdatePatch(selectedCoreIdx, {
                      filter: { ...activePatch.filter, highPass: !activePatch.filter.highPass }
                    })
                  }
                  className={`py-1.5 rounded border text-center transition ${
                    activePatch.filter.highPass
                      ? 'bg-purple-950 border-purple-500 text-purple-300 font-bold'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  HIGHPASS
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: ADSR Envelopes & Modulation */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 space-y-4">
            <h4 className="text-neutral-400 font-bold uppercase tracking-wider text-[11px] border-b border-neutral-800 pb-2">
              Amp & Filter ADSR Envelopes
            </h4>

            {/* Amp ADSR */}
            <div className="space-y-2">
              <div className="flex justify-between text-neutral-300 font-semibold text-[11px]">
                <span>Amp Envelope (ADSR)</span>
                <span className="text-neutral-400">
                  {activePatch.ampEnv.attack}/{activePatch.ampEnv.decay}/{activePatch.ampEnv.sustain}/{activePatch.ampEnv.release}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(['attack', 'decay', 'sustain', 'release'] as const).map((param) => (
                  <div key={param} className="text-center space-y-1">
                    <span className="text-[10px] text-neutral-500 uppercase">{param[0]}</span>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      value={activePatch.ampEnv[param]}
                      onChange={(e) =>
                        onUpdatePatch(selectedCoreIdx, {
                          ampEnv: { ...activePatch.ampEnv, [param]: parseInt(e.target.value, 10) }
                        })
                      }
                      className="w-full accent-cyan-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Stereo Spread */}
            <div className="space-y-1 pt-3 border-t border-neutral-800">
              <div className="flex justify-between">
                <span className="text-neutral-400 font-semibold">Stereo Spread</span>
                <span className="text-cyan-400 font-bold">{activePatch.stereoSpread}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={activePatch.stereoSpread}
                onChange={(e) =>
                  onUpdatePatch(selectedCoreIdx, { stereoSpread: parseInt(e.target.value, 10) })
                }
                className="w-full accent-cyan-500"
              />
              <span className="text-[10px] text-neutral-500 block font-sans">
                Controls detune and panning offset between the two physical socket chips.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
