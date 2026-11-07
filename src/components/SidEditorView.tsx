import React, { useState } from 'react';
import {
  Layers,
  Sliders,
  Play,
  RotateCcw,
  Sparkles,
  Download,
  Upload,
  FileCode,
  Music,
  Activity,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import {
  SidChipModel,
  SidCorePatch,
  SidEngineType,
  LeadPatch,
  BasslinePatch,
  MultiPatch,
  DrumPatch
} from '../types/index.ts';
import { audioEngine } from '../services/audioEngine.ts';
import { midiDeviceManager } from '../services/midiDeviceManager.ts';
import {
  serializeSidPatchToSysEx,
  deserializeSysExToSidPatch
} from '../services/sidProtocolAdapter.ts';
import {
  DEFAULT_LEAD_PATCH,
  DEFAULT_BASSLINE_PATCH,
  DEFAULT_MULTI_PATCH,
  DEFAULT_DRUM_PATCH
} from '../data/defaultSidPatches.ts';

interface SidEditorViewProps {
  sidPatches: [SidCorePatch, SidCorePatch, SidCorePatch, SidCorePatch];
  onUpdatePatch: (coreIndex: number, patch: SidCorePatch) => void;
}

export const SidEditorView: React.FC<SidEditorViewProps> = ({
  sidPatches,
  onUpdatePatch
}) => {
  const [selectedCoreIdx, setSelectedCoreIdx] = useState<number>(0);
  const [showLibrarian, setShowLibrarian] = useState<boolean>(false);
  const [librarianMessage, setLibrarianMessage] = useState<string | null>(null);

  const activePatch = sidPatches[selectedCoreIdx];

  const handleAuditionCore = (note = 60) => {
    const voiceId = activePatch.coreId;
    audioEngine.triggerNoteOn(voiceId, note, 115);
    setTimeout(() => audioEngine.triggerNoteOff(voiceId, note), 350);

    // Also send note on/off to physical MIDI port if bound
    const ch = selectedCoreIdx + 6;
    midiDeviceManager.sendRaw(null, [0x90 | (ch - 1), note, 115], 'NOTE', ch, `Audition Note On (${note})`);
  };

  const handleEngineChange = (newEngine: SidEngineType) => {
    let newPatch: SidCorePatch;
    if (newEngine === 'lead') {
      newPatch = { ...DEFAULT_LEAD_PATCH, coreId: activePatch.coreId, name: `${activePatch.coreId} Lead Patch` };
    } else if (newEngine === 'bassline') {
      newPatch = { ...DEFAULT_BASSLINE_PATCH, coreId: activePatch.coreId, name: `${activePatch.coreId} Bassline Patch` };
    } else if (newEngine === 'multi') {
      newPatch = { ...DEFAULT_MULTI_PATCH, coreId: activePatch.coreId, name: `${activePatch.coreId} Multi Patch` };
    } else {
      newPatch = { ...DEFAULT_DRUM_PATCH, coreId: activePatch.coreId, name: `${activePatch.coreId} Drum Patch` };
    }
    onUpdatePatch(selectedCoreIdx, newPatch);
  };

  const handleExportSysEx = () => {
    const sysexBytes = serializeSidPatchToSysEx(activePatch, 0, 0, selectedCoreIdx);
    const blob = new Blob([sysexBytes.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activePatch.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_Core${selectedCoreIdx + 1}.syx`;
    a.click();
    URL.revokeObjectURL(url);
    setLibrarianMessage(`Exported ${sysexBytes.length} bytes SysEx dump`);
  };

  const handleImportSysExFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(buffer);
        const imported = deserializeSysExToSidPatch(bytes);
        imported.coreId = activePatch.coreId;
        onUpdatePatch(selectedCoreIdx, imported);
        setLibrarianMessage(`Successfully parsed and loaded "${imported.name}" (${imported.engine.toUpperCase()})`);
      } catch (err: any) {
        setLibrarianMessage(`SysEx Import Error: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
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
            Four independent stereo pairs (8 physical SID sockets). Full parameter models for Lead, Bassline (TB-303), Multi-instrument, and Drum engines.
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
              Core {idx + 1} ({patch.engine.toUpperCase()})
            </button>
          ))}
        </div>
      </div>

      {/* Main Core Configuration & Socket Hardware Profile */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-sm font-mono font-bold text-white">
                {activePatch.name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                  Core ID: {activePatch.coreId}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                  <CheckCircle size={10} /> {activePatch.syncStatus.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Engine Type Dropdown */}
            <div className="flex items-center gap-1 text-xs font-mono ml-4">
              <span className="text-neutral-500">Engine:</span>
              <select
                value={activePatch.engine}
                onChange={(e) => handleEngineChange(e.target.value as SidEngineType)}
                className="bg-neutral-950 border border-cyan-800 rounded px-2.5 py-1 text-cyan-300 font-semibold focus:outline-none focus:border-cyan-500"
              >
                <option value="lead">Lead Engine (Stereo Unison)</option>
                <option value="bassline">Bassline Engine (TB-303 Dual)</option>
                <option value="multi">Multi-Polyphonic Engine</option>
                <option value="drum">Drum & FX Engine</option>
              </select>
            </div>
          </div>

          {/* Physical Socket Chip Models & SysEx Librarian Trigger */}
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5 bg-neutral-950 border border-neutral-800 px-2.5 py-1 rounded">
              <span className="text-neutral-500">Left Socket:</span>
              <select
                value={activePatch.socketLeftModel}
                onChange={(e) =>
                  onUpdatePatch(selectedCoreIdx, {
                    ...activePatch,
                    socketLeftModel: e.target.value as SidChipModel
                  })
                }
                className="bg-transparent text-amber-300 font-bold focus:outline-none"
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
                  onUpdatePatch(selectedCoreIdx, {
                    ...activePatch,
                    socketRightModel: e.target.value as SidChipModel
                  })
                }
                className="bg-transparent text-amber-300 font-bold focus:outline-none"
              >
                <option value="6581">MOS 6581 (Warm/Dirty)</option>
                <option value="8580">CSG 8580 (Clean/Resonant)</option>
                <option value="6582">MOS 6582</option>
              </select>
            </div>

            <button
              onClick={() => setShowLibrarian(!showLibrarian)}
              className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 font-mono text-xs flex items-center gap-1.5 transition"
            >
              <FileCode size={13} /> SysEx / Librarian
            </button>

            <button
              onClick={() => handleAuditionCore(60)}
              className="px-3.5 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1.5 transition shadow"
            >
              <Play size={14} className="fill-current" /> Audition
            </button>
          </div>
        </div>

        {/* SysEx Librarian Modal / Drawer */}
        {showLibrarian && (
          <div className="bg-neutral-950 border border-cyan-900/60 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <div className="flex items-center gap-2">
                <FileCode size={16} className="text-cyan-400" />
                <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  SysEx Librarian & BankStick Storage (Core {selectedCoreIdx + 1})
                </h4>
              </div>
              <span className="text-[11px] font-mono text-neutral-500">
                Official SysEx Header: F0 00 00 7E 46 ... F7
              </span>
            </div>

            {librarianMessage && (
              <div className="p-2 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300 text-xs font-mono">
                {librarianMessage}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-3 bg-neutral-900 rounded border border-neutral-800 space-y-2">
                <span className="text-neutral-400 font-bold block">Raw .syx Import / Export</span>
                <p className="text-[11px] text-neutral-500">
                  Lossless roundtrip serialization preserving engine parameters and opaque firmware bytes.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleExportSysEx}
                    className="flex-1 px-3 py-1.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 hover:bg-cyan-900 flex items-center justify-center gap-1.5"
                  >
                    <Download size={13} /> Export .syx
                  </button>
                  <label className="flex-1 px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-200 hover:bg-neutral-700 flex items-center justify-center gap-1.5 cursor-pointer">
                    <Upload size={13} /> Import .syx
                    <input type="file" accept=".syx" onChange={handleImportSysExFile} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="p-3 bg-neutral-900 rounded border border-neutral-800 space-y-2">
                <span className="text-neutral-400 font-bold block">Analog Filter Calibration</span>
                <p className="text-[11px] text-neutral-500">
                  Physical capacitor values per socket determine resonance response:
                </p>
                <div className="text-[11px] space-y-1 text-neutral-300">
                  <div>Left ({activePatch.socketLeftModel}): {activePatch.socketLeftModel === '6581' ? '470 pF Ceramic' : '22 nF Film'}</div>
                  <div>Right ({activePatch.socketRightModel}): {activePatch.socketRightModel === '6581' ? '470 pF Ceramic' : '22 nF Film'}</div>
                </div>
              </div>

              <div className="p-3 bg-neutral-900 rounded border border-neutral-800 space-y-2">
                <span className="text-neutral-400 font-bold block">Device Direct Write Policy</span>
                <p className="text-[11px] text-neutral-500">
                  Bulk BankStick overwrites require manual confirmation. Live adjustments transmit via high-priority atomic NRPN packets.
                </p>
                <span className="inline-block px-2 py-0.5 rounded bg-neutral-950 text-neutral-400 text-[10px]">
                  Write Guard Active: Safe Parameter Shadowing
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Engine-Specific View Rendering */}
        {activePatch.engine === 'lead' && (
          <LeadEngineView
            patch={activePatch as LeadPatch}
            onChange={(updated) => onUpdatePatch(selectedCoreIdx, updated)}
          />
        )}

        {activePatch.engine === 'bassline' && (
          <BasslineEngineView
            patch={activePatch as BasslinePatch}
            onChange={(updated) => onUpdatePatch(selectedCoreIdx, updated)}
          />
        )}

        {activePatch.engine === 'multi' && (
          <MultiEngineView
            patch={activePatch as MultiPatch}
            onChange={(updated) => onUpdatePatch(selectedCoreIdx, updated)}
          />
        )}

        {activePatch.engine === 'drum' && (
          <DrumEngineView
            patch={activePatch as DrumPatch}
            onChange={(updated) => onUpdatePatch(selectedCoreIdx, updated)}
          />
        )}
      </div>
    </div>
  );
};

// 1. Lead Engine Sub-Component
const LeadEngineView: React.FC<{ patch: LeadPatch; onChange: (p: LeadPatch) => void }> = ({ patch, onChange }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Oscillators Panel (6 Oscillators: Left 1-3, Right 4-6) */}
        <div className="bg-neutral-950/60 p-4 rounded-lg border border-neutral-800 space-y-4">
          <h4 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center justify-between">
            <span>Oscillators (6-Voice Stereo Unison)</span>
            <span className="text-neutral-500 text-[10px]">NRPN 0x0100</span>
          </h4>

          {/* Left OSC 1 */}
          <div className="p-3 bg-neutral-900/80 rounded border border-neutral-800 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-neutral-300 font-semibold">Left Socket - OSC 1</span>
              <span className="text-cyan-400 uppercase">{patch.osc1.waveform}</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {(['saw', 'pulse', 'triangle', 'noise'] as const).map((wf) => (
                <button
                  key={wf}
                  onClick={() => onChange({ ...patch, osc1: { ...patch.osc1, waveform: wf } })}
                  className={`py-1 text-[11px] font-mono rounded uppercase transition ${
                    patch.osc1.waveform === wf ? 'bg-cyan-600 text-white font-bold' : 'bg-neutral-950 text-neutral-400'
                  }`}
                >
                  {wf}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono text-neutral-400">
                <span>Pulse Width (12-bit)</span>
                <span>{patch.osc1.pulseWidth}</span>
              </div>
              <input
                type="range"
                min="0"
                max="4095"
                value={patch.osc1.pulseWidth}
                onChange={(e) =>
                  onChange({ ...patch, osc1: { ...patch.osc1, pulseWidth: parseInt(e.target.value) } })
                }
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </div>

          {/* Right OSC 4 */}
          <div className="p-3 bg-neutral-900/80 rounded border border-neutral-800 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-neutral-300 font-semibold">Right Socket - OSC 4</span>
              <span className="text-cyan-400 uppercase">{patch.osc4.waveform}</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {(['saw', 'pulse', 'triangle', 'noise'] as const).map((wf) => (
                <button
                  key={wf}
                  onClick={() => onChange({ ...patch, osc4: { ...patch.osc4, waveform: wf } })}
                  className={`py-1 text-[11px] font-mono rounded uppercase transition ${
                    patch.osc4.waveform === wf ? 'bg-cyan-600 text-white font-bold' : 'bg-neutral-950 text-neutral-400'
                  }`}
                >
                  {wf}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Resonant Analog Multimode Filter */}
        <div className="bg-neutral-950/60 p-4 rounded-lg border border-neutral-800 space-y-4">
          <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between">
            <span>Analog Filter (NRPN 0x0140)</span>
            <span className="text-neutral-500 text-[10px]">11-bit Cutoff</span>
          </h4>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-mono text-neutral-400 mb-1">
                <span>Filter Cutoff</span>
                <span className="text-cyan-400">{patch.filter.cutoff} / 2047</span>
              </div>
              <input
                type="range"
                min="0"
                max="2047"
                value={patch.filter.cutoff}
                onChange={(e) =>
                  onChange({ ...patch, filter: { ...patch.filter, cutoff: parseInt(e.target.value) } })
                }
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono text-neutral-400 mb-1">
                <span>Resonance</span>
                <span className="text-amber-400">{patch.filter.resonance} / 15</span>
              </div>
              <input
                type="range"
                min="0"
                max="15"
                value={patch.filter.resonance}
                onChange={(e) =>
                  onChange({ ...patch, filter: { ...patch.filter, resonance: parseInt(e.target.value) } })
                }
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>

            <div className="pt-2">
              <span className="text-xs font-mono text-neutral-500 block mb-1.5">Filter Routing Modes:</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'lowPass', label: 'LOWPASS' },
                  { key: 'bandPass', label: 'BANDPASS' },
                  { key: 'highPass', label: 'HIGHPASS' }
                ].map((mode) => (
                  <button
                    key={mode.key}
                    onClick={() =>
                      onChange({
                        ...patch,
                        filter: { ...patch.filter, [mode.key]: !(patch.filter as any)[mode.key] }
                      })
                    }
                    className={`py-1.5 text-xs font-mono font-bold rounded transition ${
                      (patch.filter as any)[mode.key]
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : 'bg-neutral-950 text-neutral-500 border border-neutral-800'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 6 LFOs & ADSR */}
        <div className="bg-neutral-950/60 p-4 rounded-lg border border-neutral-800 space-y-4">
          <h4 className="text-xs font-mono font-bold text-purple-400 uppercase tracking-wider flex items-center justify-between">
            <span>6 LFOs & Envelopes</span>
            <span className="text-neutral-500 text-[10px]">Modulation Sources</span>
          </h4>

          <div className="space-y-3">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-neutral-300">LFO 1 Rate / Depth</span>
              <span className="text-purple-400">{patch.lfos[0].rate} / {patch.lfos[0].depth}</span>
            </div>
            <input
              type="range"
              min="0"
              max="127"
              value={patch.lfos[0].rate}
              onChange={(e) => {
                const newLfos = [...patch.lfos] as LeadPatch['lfos'];
                newLfos[0] = { ...newLfos[0], rate: parseInt(e.target.value) };
                onChange({ ...patch, lfos: newLfos });
              }}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
            />

            <div className="pt-2">
              <span className="text-xs font-mono text-neutral-400 block mb-1">Amp Envelope (ADSR)</span>
              <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-mono text-neutral-400">
                <div>A: {patch.ampEnv.attack}</div>
                <div>D: {patch.ampEnv.decay}</div>
                <div>S: {patch.ampEnv.sustain}</div>
                <div>R: {patch.ampEnv.release}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 8-Row Modulation Matrix */}
      <div className="bg-neutral-950/60 p-4 rounded-lg border border-neutral-800 space-y-3">
        <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center justify-between">
          <span>8-Path Visual Modulation Matrix</span>
          <span className="text-neutral-500 text-[10px]">Sources A/B • Operators • Signed Depth • L/R Targets</span>
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-500 text-[10px]">
                <th className="py-1 px-2">Path</th>
                <th className="py-1 px-2">Source 1</th>
                <th className="py-1 px-2">Source 2</th>
                <th className="py-1 px-2">Op</th>
                <th className="py-1 px-2">Signed Depth (-128..+127)</th>
                <th className="py-1 px-2">Left Target</th>
                <th className="py-1 px-2">Right Target</th>
                <th className="py-1 px-2">Invert L/R</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {patch.modMatrix.slice(0, 4).map((row, idx) => (
                <tr key={row.id}>
                  <td className="py-1.5 px-2 text-neutral-400 font-bold">M{row.id}</td>
                  <td className="py-1.5 px-2 text-cyan-300">{row.source1}</td>
                  <td className="py-1.5 px-2 text-neutral-500">{row.source2}</td>
                  <td className="py-1.5 px-2 text-amber-300">{row.operator}</td>
                  <td className="py-1.5 px-2 text-white">{row.depth}</td>
                  <td className="py-1.5 px-2 text-purple-300">{row.targetLeft}</td>
                  <td className="py-1.5 px-2 text-purple-300">{row.targetRight}</td>
                  <td className="py-1.5 px-2 text-neutral-400">
                    {row.invertRight ? 'Invert R' : 'Normal'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// 2. Bassline Engine Sub-Component (TB-303 Dual Architecture)
const BasslineEngineView: React.FC<{ patch: BasslinePatch; onChange: (p: BasslinePatch) => void }> = ({ patch, onChange }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left SID 303 Bassline */}
        <div className="bg-neutral-950/60 p-4 rounded-lg border border-neutral-800 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
              Bassline 1 (Left SID 6581)
            </h4>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
              TB-303 FILTER CURVE
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div>
              <span className="text-neutral-400 block mb-1">Cutoff: {patch.inst1.cutoff}</span>
              <input
                type="range"
                min="0"
                max="2047"
                value={patch.inst1.cutoff}
                onChange={(e) =>
                  onChange({
                    ...patch,
                    inst1: { ...patch.inst1, cutoff: parseInt(e.target.value) }
                  })
                }
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>
            <div>
              <span className="text-neutral-400 block mb-1">Resonance: {patch.inst1.resonance}</span>
              <input
                type="range"
                min="0"
                max="15"
                value={patch.inst1.resonance}
                onChange={(e) =>
                  onChange({
                    ...patch,
                    inst1: { ...patch.inst1, resonance: parseInt(e.target.value) }
                  })
                }
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>
            <div>
              <span className="text-neutral-400 block mb-1">Env Mod: {patch.inst1.envModDepth}</span>
              <input
                type="range"
                min="0"
                max="127"
                value={patch.inst1.envModDepth}
                onChange={(e) =>
                  onChange({
                    ...patch,
                    inst1: { ...patch.inst1, envModDepth: parseInt(e.target.value) }
                  })
                }
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
            <div>
              <span className="text-neutral-400 block mb-1">Accent Depth: {patch.inst1.accentDepth}</span>
              <input
                type="range"
                min="0"
                max="127"
                value={patch.inst1.accentDepth}
                onChange={(e) =>
                  onChange({
                    ...patch,
                    inst1: { ...patch.inst1, accentDepth: parseInt(e.target.value) }
                  })
                }
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </div>
        </div>

        {/* Right SID 303 Bassline */}
        <div className="bg-neutral-950/60 p-4 rounded-lg border border-neutral-800 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
              Bassline 2 (Right SID Socket)
            </h4>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
              SLAVE / STEREO DETUNE
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div>
              <span className="text-neutral-400 block mb-1">Cutoff: {patch.inst2.cutoff}</span>
              <input
                type="range"
                min="0"
                max="2047"
                value={patch.inst2.cutoff}
                onChange={(e) =>
                  onChange({
                    ...patch,
                    inst2: { ...patch.inst2, cutoff: parseInt(e.target.value) }
                  })
                }
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
            <div>
              <span className="text-neutral-400 block mb-1">Glide (Portamento): {patch.inst1.glideRate}</span>
              <input
                type="range"
                min="0"
                max="127"
                value={patch.inst1.glideRate}
                onChange={(e) =>
                  onChange({
                    ...patch,
                    inst1: { ...patch.inst1, glideRate: parseInt(e.target.value) }
                  })
                }
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 16-Step Pattern Sequencer Grid */}
      <div className="bg-neutral-950/60 p-4 rounded-lg border border-neutral-800 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            TB-303 16-Step Pattern Sequencer (Gate • Slide • Accent)
          </h4>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-neutral-500">Trigger Mode:</span>
            <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-cyan-300">
              {patch.sequencerMode === 'internal_sequencer' ? 'Internal Sequencer' : 'External MIDI Timeline'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5 pt-2">
          {patch.inst1.steps.map((step, idx) => (
            <div
              key={idx}
              className={`p-2 rounded border text-center font-mono text-[10px] space-y-1 transition ${
                step.gate
                  ? step.accent
                    ? 'bg-amber-950/80 border-amber-600 text-amber-200'
                    : 'bg-neutral-900 border-neutral-700 text-white'
                  : 'bg-neutral-950 border-neutral-900 text-neutral-600'
              }`}
            >
              <div className="font-bold">{idx + 1}</div>
              <div>{step.gate ? `N:${step.note}` : 'REST'}</div>
              <div className="text-[9px]">
                {step.slide ? 'SLD' : step.accent ? 'ACC' : '-'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 3. Multi Engine Sub-Component
const MultiEngineView: React.FC<{ patch: MultiPatch; onChange: (p: MultiPatch) => void }> = ({ patch, onChange }) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
          Multi Engine Instruments (Up to 6 Independent Voices across Stereo Sockets)
        </h4>
        <span className="text-xs font-mono text-neutral-500">Static Voice & Filter Allocations</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {patch.instruments.map((inst, idx) => (
          <div key={inst.id} className="p-4 bg-neutral-950/60 rounded-lg border border-neutral-800 space-y-2 text-xs font-mono">
            <div className="flex justify-between items-center text-cyan-400 font-bold">
              <span>{inst.name} (Inst {inst.id})</span>
              <span className="text-neutral-400 text-[10px]">Ch {inst.midiChannel} • {inst.polyphony.toUpperCase()}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px] text-neutral-400 pt-1">
              <div>Wave: <span className="text-white uppercase">{inst.waveform}</span></div>
              <div>Key Range: <span className="text-white">{inst.keyRangeLow}-{inst.keyRangeHigh}</span></div>
              <div>Filter: <span className={inst.filterRouting ? 'text-emerald-400' : 'text-neutral-500'}>{inst.filterRouting ? 'ACTIVE' : 'BYPASS'}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 4. Drum Engine Sub-Component
const DrumEngineView: React.FC<{ patch: DrumPatch; onChange: (p: DrumPatch) => void }> = ({ patch, onChange }) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
          16-Voice SID Drum Synthesizer Kit
        </h4>
        <span className="text-xs font-mono text-neutral-500">MIDI Notes 35-51 • Analog SID Drum Synthesis</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {patch.drums.map((drum) => (
          <div key={drum.id} className="p-3 bg-neutral-950/60 rounded-lg border border-neutral-800 space-y-1.5 text-xs font-mono">
            <div className="flex justify-between items-center text-amber-300 font-bold">
              <span>{drum.name}</span>
              <span className="text-neutral-500 text-[10px]">Note {drum.triggerNote}</span>
            </div>
            <div className="text-[10px] text-neutral-400 space-y-0.5">
              <div>Decay: <span className="text-white">{drum.decay}</span></div>
              <div>Pitch: <span className="text-white">{drum.pitch}</span></div>
              <div>Sweep: <span className="text-white">{drum.sweepRate}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
