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
  AlertCircle,
  Lock,
  Radio,
  SlidersHorizontal
} from 'lucide-react';
import {
  SidChipModel,
  SidCorePatch,
  SidEngineType,
  LeadPatch,
  BasslinePatch,
  MultiPatch,
  DrumPatch,
  MultiInstrument,
  DrumInstrument,
  SidModMatrixRow,
  SidWavetableParams,
  SidLfoParams
} from '../types/index.ts';
import { audioEngine } from '../services/audioEngine.ts';
import { midiDeviceManager } from '../services/midiDeviceManager.ts';
import {
  serializeSidPatchToSysEx,
  deserializeSysExToSidPatch,
  checkHardwareWritePermission
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

    // Send to physical MIDI port strictly bound to this SID Core
    const target = midiDeviceManager.resolveVoiceTarget(voiceId);
    if (target.portId) {
      midiDeviceManager.sendNoteOn(target.portId, target.channel, note, 115);
      setTimeout(() => midiDeviceManager.sendNoteOff(target.portId, target.channel, note), 350);
    }
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
    setLibrarianMessage(`Exported authentic 512-byte SysEx patch (${sysexBytes.length} bytes framed)`);
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
        setLibrarianMessage(`Successfully verified and loaded "${imported.name}" (${imported.engine.toUpperCase()})`);
      } catch (err: any) {
        setLibrarianMessage(`SysEx Import Error: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const writeGuard = checkHardwareWritePermission(activePatch, false);

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
              <input
                type="text"
                value={activePatch.name}
                onChange={(e) => onUpdatePatch(selectedCoreIdx, { ...activePatch, name: e.target.value })}
                className="text-sm font-mono font-bold text-white bg-neutral-950 border border-neutral-800 rounded px-2 py-0.5 focus:outline-none focus:border-cyan-500"
              />
              <div className="flex items-center gap-2 mt-1">
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
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <Lock size={12} />
                  <span>Hardware Direct Write Guard</span>
                </div>
                <p className="text-[11px] text-neutral-500">
                  {writeGuard.reason}
                </p>
                <span className="inline-block px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 text-[10px] font-bold">
                  DIRECT WRITE LOCKED (SAFE SHADOW ONLY)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Engine-Specific Interactive Views */}
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

// ============================================================================
// 1. Lead Engine Sub-Component (Fully Editable 6 OSCs, 6 LFOs, 8 Matrix, 4 WTs)
// ============================================================================
const LeadEngineView: React.FC<{ patch: LeadPatch; onChange: (p: LeadPatch) => void }> = ({ patch, onChange }) => {
  const [selectedLfoIdx, setSelectedLfoIdx] = useState<number>(0);
  const [selectedWtIdx, setSelectedWtIdx] = useState<number>(0);

  const activeLfo = patch.lfos[selectedLfoIdx];
  const activeWt = patch.wavetables[selectedWtIdx];

  const updateOsc = (key: 'osc1' | 'osc2' | 'osc3' | 'osc4' | 'osc5' | 'osc6', updates: Partial<LeadPatch['osc1']>) => {
    onChange({
      ...patch,
      [key]: { ...patch[key], ...updates }
    });
  };

  const updateMatrixRow = (rowIdx: number, updates: Partial<SidModMatrixRow>) => {
    const newMatrix = [...patch.modMatrix];
    newMatrix[rowIdx] = { ...newMatrix[rowIdx], ...updates };
    onChange({ ...patch, modMatrix: newMatrix });
  };

  const updateLfo = (idx: number, updates: Partial<SidLfoParams>) => {
    const newLfos = [...patch.lfos] as LeadPatch['lfos'];
    newLfos[idx] = { ...newLfos[idx], ...updates };
    onChange({ ...patch, lfos: newLfos });
  };

  const updateWt = (idx: number, updates: Partial<SidWavetableParams>) => {
    const newWts = [...patch.wavetables] as LeadPatch['wavetables'];
    newWts[idx] = { ...newWts[idx], ...updates };
    onChange({ ...patch, wavetables: newWts });
  };

  return (
    <div className="space-y-6">
      {/* 6 Oscillators Matrix: Left (OSC 1-3) & Right (OSC 4-6) */}
      <div className="bg-neutral-950/60 p-4 rounded-lg border border-neutral-800 space-y-4">
        <h4 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center justify-between">
          <span>6-Voice Stereo Unison Oscillators (NRPN 0x0100..0x011F)</span>
          <span className="text-neutral-500 text-[10px]">Left Sockets 1-3 • Right Sockets 4-6</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(['osc1', 'osc2', 'osc3', 'osc4', 'osc5', 'osc6'] as const).map((oscKey, idx) => {
            const osc = patch[oscKey];
            const isRight = idx >= 3;
            return (
              <div key={oscKey} className="p-3 bg-neutral-900/80 rounded border border-neutral-800 space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className={`font-bold ${isRight ? 'text-blue-300' : 'text-cyan-300'}`}>
                    {isRight ? `Right Socket - OSC ${idx + 1}` : `Left Socket - OSC ${idx + 1}`}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateOsc(oscKey, { sync: !osc.sync })}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${osc.sync ? 'bg-amber-600 text-white' : 'bg-neutral-800 text-neutral-500'}`}
                    >
                      SYNC
                    </button>
                    <button
                      onClick={() => updateOsc(oscKey, { ringMod: !osc.ringMod })}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${osc.ringMod ? 'bg-purple-600 text-white' : 'bg-neutral-800 text-neutral-500'}`}
                    >
                      RING
                    </button>
                  </div>
                </div>

                {/* Waveform Selector */}
                <div className="grid grid-cols-4 gap-1">
                  {(['saw', 'pulse', 'triangle', 'noise'] as const).map((wf) => (
                    <button
                      key={wf}
                      onClick={() => updateOsc(oscKey, { waveform: wf })}
                      className={`py-1 text-[10px] font-mono rounded uppercase transition ${
                        osc.waveform === wf ? 'bg-cyan-600 text-white font-bold' : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      {wf}
                    </button>
                  ))}
                </div>

                {/* Pulse Width (12-bit) */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-neutral-400">
                    <span>Pulse Width</span>
                    <span className="text-white">{osc.pulseWidth}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="4095"
                    value={osc.pulseWidth}
                    onChange={(e) => updateOsc(oscKey, { pulseWidth: parseInt(e.target.value) })}
                    className="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                {/* Tuning (Octave & Finetune) */}
                <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-400">
                  <div>
                    <span>Octave: {osc.octave}</span>
                    <input
                      type="range"
                      min="-2"
                      max="2"
                      value={osc.octave}
                      onChange={(e) => updateOsc(oscKey, { octave: parseInt(e.target.value) })}
                      className="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-amber-400"
                    />
                  </div>
                  <div>
                    <span>Finetune: {osc.finetune}</span>
                    <input
                      type="range"
                      min="-64"
                      max="63"
                      value={osc.finetune}
                      onChange={(e) => updateOsc(oscKey, { finetune: parseInt(e.target.value) })}
                      className="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-amber-400"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter and Envelopes Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                <span className="text-cyan-400 font-bold">{patch.filter.cutoff} / 2047</span>
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
                <span className="text-amber-400 font-bold">{patch.filter.resonance} / 15</span>
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

        {/* Amp & Filter ADSR Envelopes */}
        <div className="bg-neutral-950/60 p-4 rounded-lg border border-neutral-800 space-y-4">
          <h4 className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
            <span>Envelopes (Amp & Filter)</span>
            <span className="text-neutral-500 text-[10px]">4-bit ADSR (0-15)</span>
          </h4>

          {/* Amp Envelope */}
          <div className="space-y-2">
            <span className="text-xs font-mono text-neutral-300 font-semibold block">Amp ADSR</span>
            <div className="grid grid-cols-4 gap-2 text-xs font-mono">
              {(['attack', 'decay', 'sustain', 'release'] as const).map((stage) => (
                <div key={stage} className="text-center bg-neutral-900 p-2 rounded border border-neutral-800">
                  <span className="text-neutral-500 block uppercase text-[10px]">{stage[0]}</span>
                  <span className="text-white font-bold">{patch.ampEnv[stage]}</span>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    value={patch.ampEnv[stage]}
                    onChange={(e) =>
                      onChange({ ...patch, ampEnv: { ...patch.ampEnv, [stage]: parseInt(e.target.value) } })
                    }
                    className="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-emerald-400 mt-1"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Filter Envelope */}
          <div className="space-y-2 pt-2 border-t border-neutral-800">
            <span className="text-xs font-mono text-neutral-300 font-semibold block">Filter ADSR</span>
            <div className="grid grid-cols-4 gap-2 text-xs font-mono">
              {(['attack', 'decay', 'sustain', 'release'] as const).map((stage) => (
                <div key={stage} className="text-center bg-neutral-900 p-2 rounded border border-neutral-800">
                  <span className="text-neutral-500 block uppercase text-[10px]">{stage[0]}</span>
                  <span className="text-amber-300 font-bold">{patch.filterEnv[stage]}</span>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    value={patch.filterEnv[stage]}
                    onChange={(e) =>
                      onChange({ ...patch, filterEnv: { ...patch.filterEnv, [stage]: parseInt(e.target.value) } })
                    }
                    className="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-amber-400 mt-1"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 6 LFOs Editor */}
        <div className="bg-neutral-950/60 p-4 rounded-lg border border-neutral-800 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono font-bold text-purple-400 uppercase tracking-wider">
              6 LFOs Matrix
            </h4>
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  onClick={() => setSelectedLfoIdx(i)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                    selectedLfoIdx === i ? 'bg-purple-600 text-white' : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  LFO{i + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 bg-neutral-900/80 rounded border border-neutral-800 space-y-3 text-xs font-mono">
            <div className="flex justify-between items-center">
              <span className="text-purple-300 font-bold">LFO {selectedLfoIdx + 1} Parameters</span>
              <button
                onClick={() => updateLfo(selectedLfoIdx, { sync: !activeLfo.sync })}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${activeLfo.sync ? 'bg-purple-900 text-purple-200 border border-purple-700' : 'bg-neutral-800 text-neutral-500'}`}
              >
                {activeLfo.sync ? 'SYNC: ON' : 'SYNC: FREE'}
              </button>
            </div>

            <div className="grid grid-cols-5 gap-1">
              {(['sine', 'tri', 'saw', 'pulse', 'rand'] as const).map((wf) => (
                <button
                  key={wf}
                  onClick={() => updateLfo(selectedLfoIdx, { waveform: wf })}
                  className={`py-1 text-[10px] rounded uppercase font-bold ${
                    activeLfo.waveform === wf ? 'bg-purple-600 text-white' : 'bg-neutral-950 text-neutral-400'
                  }`}
                >
                  {wf}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-neutral-400">
                <span>Rate</span>
                <span className="text-white">{activeLfo.rate}</span>
              </div>
              <input
                type="range"
                min="0"
                max="127"
                value={activeLfo.rate}
                onChange={(e) => updateLfo(selectedLfoIdx, { rate: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-neutral-800 rounded appearance-none cursor-pointer accent-purple-400"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-neutral-400">
                <span>Depth</span>
                <span className="text-white">{activeLfo.depth}</span>
              </div>
              <input
                type="range"
                min="0"
                max="127"
                value={activeLfo.depth}
                onChange={(e) => updateLfo(selectedLfoIdx, { depth: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-neutral-800 rounded appearance-none cursor-pointer accent-purple-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 8-Row Interactive Modulation Matrix */}
      <div className="bg-neutral-950/60 p-4 rounded-lg border border-neutral-800 space-y-3">
        <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center justify-between">
          <span>8-Path Fully Editable Modulation Matrix</span>
          <span className="text-neutral-500 text-[10px]">Sources A/B • Operators • Signed Depth (-128..+127) • Left/Right Targets</span>
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-500 text-[10px]">
                <th className="py-1 px-2">Path</th>
                <th className="py-1 px-2">Source 1</th>
                <th className="py-1 px-2">Source 2</th>
                <th className="py-1 px-2">Operator</th>
                <th className="py-1 px-2">Depth (-128..127)</th>
                <th className="py-1 px-2">Left Target</th>
                <th className="py-1 px-2">Right Target</th>
                <th className="py-1 px-2">Invert Right</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {patch.modMatrix.slice(0, 8).map((row, idx) => (
                <tr key={row.id}>
                  <td className="py-1.5 px-2 text-cyan-400 font-bold">M{row.id}</td>
                  <td className="py-1.5 px-2">
                    <select
                      value={row.source1}
                      onChange={(e) => updateMatrixRow(idx, { source1: e.target.value as any })}
                      className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-cyan-300 text-[11px]"
                    >
                      <option value="NONE">NONE</option>
                      <option value="LFO1">LFO1</option>
                      <option value="LFO2">LFO2</option>
                      <option value="LFO3">LFO3</option>
                      <option value="LFO4">LFO4</option>
                      <option value="LFO5">LFO5</option>
                      <option value="LFO6">LFO6</option>
                      <option value="ENV1">ENV1</option>
                      <option value="ENV2">ENV2</option>
                      <option value="WT1">WT1</option>
                      <option value="WT2">WT2</option>
                      <option value="VELOCITY">VELOCITY</option>
                      <option value="MODWHEEL">MODWHEEL</option>
                    </select>
                  </td>
                  <td className="py-1.5 px-2">
                    <select
                      value={row.source2}
                      onChange={(e) => updateMatrixRow(idx, { source2: e.target.value as any })}
                      className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-neutral-300 text-[11px]"
                    >
                      <option value="NONE">NONE</option>
                      <option value="LFO1">LFO1</option>
                      <option value="LFO2">LFO2</option>
                      <option value="ENV1">ENV1</option>
                      <option value="VELOCITY">VELOCITY</option>
                    </select>
                  </td>
                  <td className="py-1.5 px-2">
                    <select
                      value={row.operator}
                      onChange={(e) => updateMatrixRow(idx, { operator: e.target.value as any })}
                      className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-amber-300 text-[11px]"
                    >
                      <option value="NOP">NOP</option>
                      <option value="ADD">ADD</option>
                      <option value="SUB">SUB</option>
                      <option value="MUL">MUL</option>
                    </select>
                  </td>
                  <td className="py-1.5 px-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="-128"
                        max="127"
                        value={row.depth}
                        onChange={(e) => updateMatrixRow(idx, { depth: parseInt(e.target.value) })}
                        className="w-20 h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-cyan-400"
                      />
                      <span className="w-8 text-right font-bold text-white text-[11px]">{row.depth}</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-2">
                    <select
                      value={row.targetLeft}
                      onChange={(e) => updateMatrixRow(idx, { targetLeft: e.target.value as any })}
                      className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-purple-300 text-[11px]"
                    >
                      <option value="NONE">NONE</option>
                      <option value="PITCH_ALL">PITCH_ALL</option>
                      <option value="PITCH_OSC1">PITCH_OSC1</option>
                      <option value="PW_ALL">PW_ALL</option>
                      <option value="CUTOFF">CUTOFF</option>
                      <option value="RESONANCE">RESONANCE</option>
                      <option value="VOLUME">VOLUME</option>
                      <option value="PAN">PAN</option>
                    </select>
                  </td>
                  <td className="py-1.5 px-2">
                    <select
                      value={row.targetRight}
                      onChange={(e) => updateMatrixRow(idx, { targetRight: e.target.value as any })}
                      className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-purple-300 text-[11px]"
                    >
                      <option value="NONE">NONE</option>
                      <option value="PITCH_ALL">PITCH_ALL</option>
                      <option value="PITCH_OSC1">PITCH_OSC4</option>
                      <option value="PW_ALL">PW_ALL</option>
                      <option value="CUTOFF">CUTOFF</option>
                      <option value="RESONANCE">RESONANCE</option>
                      <option value="VOLUME">VOLUME</option>
                      <option value="PAN">PAN</option>
                    </select>
                  </td>
                  <td className="py-1.5 px-2">
                    <button
                      onClick={() => updateMatrixRow(idx, { invertRight: !row.invertRight })}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.invertRight ? 'bg-amber-950 text-amber-300 border border-amber-700' : 'bg-neutral-900 text-neutral-500'}`}
                    >
                      {row.invertRight ? 'INVERT R' : 'NORMAL'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4 Wavetables Editor */}
      <div className="bg-neutral-950/60 p-4 rounded-lg border border-neutral-800 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
            4 Wavetable Sequencers (WT 1..4)
          </h4>
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3].map((i) => (
              <button
                key={i}
                onClick={() => setSelectedWtIdx(i)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                  selectedWtIdx === i ? 'bg-amber-600 text-white' : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                WT{i + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 bg-neutral-900/80 rounded border border-neutral-800 space-y-3 text-xs font-mono">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-neutral-400">Speed:</span>
              <input
                type="range"
                min="0"
                max="127"
                value={activeWt.speed}
                onChange={(e) => updateWt(selectedWtIdx, { speed: parseInt(e.target.value) })}
                className="w-24 h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-amber-400"
              />
              <span className="text-white font-bold">{activeWt.speed}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-neutral-400">Mode:</span>
              <select
                value={activeWt.loopMode}
                onChange={(e) => updateWt(selectedWtIdx, { loopMode: e.target.value as any })}
                className="bg-neutral-950 border border-neutral-800 rounded px-2 py-0.5 text-amber-300 text-[11px]"
              >
                <option value="forward">Forward Loop</option>
                <option value="pingpong">Ping-Pong</option>
                <option value="off">One-Shot</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5 pt-2">
            {activeWt.steps.slice(0, 16).map((stepVal, s) => (
              <div key={s} className="bg-neutral-950 p-1.5 rounded border border-neutral-800 text-center space-y-1">
                <span className="text-[9px] text-neutral-500 block">{s + 1}</span>
                <span className="text-white font-bold block text-[10px]">{stepVal}</span>
                <input
                  type="range"
                  min="0"
                  max="127"
                  value={stepVal}
                  onChange={(e) => {
                    const newSteps = [...activeWt.steps];
                    newSteps[s] = parseInt(e.target.value);
                    updateWt(selectedWtIdx, { steps: newSteps });
                  }}
                  className="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-amber-400"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. Bassline Engine Sub-Component (Fully Editable TB-303 Dual Architecture)
// ============================================================================
const BasslineEngineView: React.FC<{ patch: BasslinePatch; onChange: (p: BasslinePatch) => void }> = ({ patch, onChange }) => {
  const updateStep = (instKey: 'inst1' | 'inst2', stepIdx: number, updates: Partial<BasslinePatch['inst1']['steps'][0]>) => {
    const newSteps = [...patch[instKey].steps];
    newSteps[stepIdx] = { ...newSteps[stepIdx], ...updates };
    onChange({
      ...patch,
      [instKey]: { ...patch[instKey], steps: newSteps }
    });
  };

  const renderBasslineControls = (instKey: 'inst1' | 'inst2', title: string, color: string) => {
    const inst = patch[instKey];
    return (
      <div className="bg-neutral-950/60 p-4 rounded-lg border border-neutral-800 space-y-4">
        <div className="flex justify-between items-center">
          <h4 className={`text-xs font-mono font-bold ${color} uppercase tracking-wider`}>
            {title}
          </h4>
          <div className="flex items-center gap-1 font-mono text-xs">
            <button
              onClick={() => onChange({ ...patch, [instKey]: { ...inst, waveform: 'saw' } })}
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${inst.waveform === 'saw' ? 'bg-amber-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
            >
              SAW
            </button>
            <button
              onClick={() => onChange({ ...patch, [instKey]: { ...inst, waveform: 'pulse' } })}
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${inst.waveform === 'pulse' ? 'bg-cyan-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
            >
              PULSE
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          <div>
            <div className="flex justify-between mb-1 text-neutral-400">
              <span>Cutoff</span>
              <span className="text-white font-bold">{inst.cutoff}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2047"
              value={inst.cutoff}
              onChange={(e) => onChange({ ...patch, [instKey]: { ...inst, cutoff: parseInt(e.target.value) } })}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1 text-neutral-400">
              <span>Resonance</span>
              <span className="text-white font-bold">{inst.resonance}</span>
            </div>
            <input
              type="range"
              min="0"
              max="15"
              value={inst.resonance}
              onChange={(e) => onChange({ ...patch, [instKey]: { ...inst, resonance: parseInt(e.target.value) } })}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1 text-neutral-400">
              <span>Env Mod</span>
              <span className="text-white font-bold">{inst.envModDepth}</span>
            </div>
            <input
              type="range"
              min="0"
              max="127"
              value={inst.envModDepth}
              onChange={(e) => onChange({ ...patch, [instKey]: { ...inst, envModDepth: parseInt(e.target.value) } })}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1 text-neutral-400">
              <span>Accent Depth</span>
              <span className="text-white font-bold">{inst.accentDepth}</span>
            </div>
            <input
              type="range"
              min="0"
              max="127"
              value={inst.accentDepth}
              onChange={(e) => onChange({ ...patch, [instKey]: { ...inst, accentDepth: parseInt(e.target.value) } })}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1 text-neutral-400">
              <span>Decay</span>
              <span className="text-white font-bold">{inst.decay}</span>
            </div>
            <input
              type="range"
              min="0"
              max="127"
              value={inst.decay}
              onChange={(e) => onChange({ ...patch, [instKey]: { ...inst, decay: parseInt(e.target.value) } })}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1 text-neutral-400">
              <span>Glide (Portamento)</span>
              <span className="text-white font-bold">{inst.glideRate}</span>
            </div>
            <input
              type="range"
              min="0"
              max="127"
              value={inst.glideRate}
              onChange={(e) => onChange({ ...patch, [instKey]: { ...inst, glideRate: parseInt(e.target.value) } })}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
          </div>
        </div>

        {/* 16-Step Pattern Sequencer */}
        <div className="pt-2 border-t border-neutral-800 space-y-2">
          <span className="text-xs font-mono font-bold text-neutral-300 block">16-Step Pattern Sequencer</span>
          <div className="grid grid-cols-8 sm:grid-cols-16 gap-1">
            {inst.steps.map((st, idx) => {
              const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
              return (
                <div
                  key={idx}
                  className={`p-1.5 rounded border text-center font-mono text-[9px] space-y-1 transition ${
                    st.gate
                      ? st.accent
                        ? 'bg-amber-950/90 border-amber-500 text-amber-200'
                        : 'bg-neutral-900 border-neutral-700 text-white'
                      : 'bg-neutral-950 border-neutral-900 text-neutral-600'
                  }`}
                >
                  <div className="font-bold text-[10px]">{idx + 1}</div>
                  <button
                    onClick={() => updateStep(instKey, idx, { gate: !st.gate })}
                    className={`w-full py-0.5 rounded font-bold ${st.gate ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
                  >
                    {st.gate ? 'ON' : 'OFF'}
                  </button>
                  <select
                    value={st.note}
                    onChange={(e) => updateStep(instKey, idx, { note: parseInt(e.target.value) })}
                    disabled={!st.gate}
                    className="w-full bg-neutral-950 text-white text-[9px] border border-neutral-800 rounded text-center"
                  >
                    {noteNames.map((n, ni) => (
                      <option key={ni} value={ni}>{n}</option>
                    ))}
                  </select>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => updateStep(instKey, idx, { slide: !st.slide })}
                      disabled={!st.gate}
                      className={`flex-1 py-0.5 rounded text-[8px] font-bold ${st.slide ? 'bg-cyan-600 text-white' : 'bg-neutral-800 text-neutral-500'}`}
                    >
                      SLD
                    </button>
                    <button
                      onClick={() => updateStep(instKey, idx, { accent: !st.accent })}
                      disabled={!st.gate}
                      className={`flex-1 py-0.5 rounded text-[8px] font-bold ${st.accent ? 'bg-amber-600 text-white' : 'bg-neutral-800 text-neutral-500'}`}
                    >
                      ACC
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Global Sequencer Settings */}
      <div className="bg-neutral-950/60 p-4 rounded-lg border border-neutral-800 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-4">
          <span className="text-neutral-400 font-bold">Sequencer Mode:</span>
          <select
            value={patch.sequencerMode}
            onChange={(e) => onChange({ ...patch, sequencerMode: e.target.value as any })}
            className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1 text-cyan-300 font-bold"
          >
            <option value="internal_sequencer">Internal 16-Step Pattern Sequencer</option>
            <option value="external_midi">External MIDI Timeline Trigger</option>
          </select>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-neutral-400 font-bold">Clock Sync:</span>
          <select
            value={patch.clockSync}
            onChange={(e) => onChange({ ...patch, clockSync: e.target.value as any })}
            className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1 text-emerald-300 font-bold"
          >
            <option value="midi_clock">MIDI Clock (24 PPQN)</option>
            <option value="internal">Internal BPM Clock</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-neutral-400 font-bold">Swing:</span>
          <input
            type="range"
            min="0"
            max="100"
            value={patch.swing}
            onChange={(e) => onChange({ ...patch, swing: parseInt(e.target.value) })}
            className="w-20 h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-cyan-400"
          />
          <span className="text-white font-bold">{patch.swing}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderBasslineControls('inst1', 'Bassline 1 (Left SID 6581)', 'text-amber-400')}
        {renderBasslineControls('inst2', 'Bassline 2 (Right SID 8580)', 'text-cyan-400')}
      </div>
    </div>
  );
};

// ============================================================================
// 3. Multi Engine Sub-Component (Fully Editable 6 Multi Instruments)
// ============================================================================
const MultiEngineView: React.FC<{ patch: MultiPatch; onChange: (p: MultiPatch) => void }> = ({ patch, onChange }) => {
  const updateInstrument = (instIdx: number, updates: Partial<MultiInstrument>) => {
    const newInsts = [...patch.instruments];
    newInsts[instIdx] = { ...newInsts[instIdx], ...updates };
    onChange({ ...patch, instruments: newInsts });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
          Multi Engine Instruments (Up to 6 Independent Synthesizer Voices)
        </h4>
        <span className="text-xs font-mono text-neutral-500">Full Modulation, Key Ranges & Synthesis Controls</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {patch.instruments.map((inst, idx) => (
          <div key={inst.id} className="p-4 bg-neutral-950/60 rounded-lg border border-neutral-800 space-y-3 text-xs font-mono">
            <div className="flex justify-between items-center text-cyan-400 font-bold border-b border-neutral-800 pb-2">
              <input
                type="text"
                value={inst.name}
                onChange={(e) => updateInstrument(idx, { name: e.target.value })}
                className="bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5 text-white font-bold"
              />
              <div className="flex items-center gap-2">
                <span>Ch:</span>
                <input
                  type="number"
                  min="1"
                  max="16"
                  value={inst.midiChannel}
                  onChange={(e) => updateInstrument(idx, { midiChannel: parseInt(e.target.value) || 1 })}
                  className="w-12 bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-center text-cyan-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <span className="text-neutral-500 block">Waveform</span>
                <select
                  value={inst.waveform}
                  onChange={(e) => updateInstrument(idx, { waveform: e.target.value as any })}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-white"
                >
                  <option value="saw">SAW</option>
                  <option value="pulse">PULSE</option>
                  <option value="triangle">TRI</option>
                  <option value="noise">NOISE</option>
                </select>
              </div>

              <div>
                <span className="text-neutral-500 block">Polyphony</span>
                <select
                  value={inst.polyphony}
                  onChange={(e) => updateInstrument(idx, { polyphony: e.target.value as any })}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-white"
                >
                  <option value="poly">POLY</option>
                  <option value="mono">MONO</option>
                </select>
              </div>

              <div>
                <span className="text-neutral-500 block">Filter Routing</span>
                <button
                  onClick={() => updateInstrument(idx, { filterRouting: !inst.filterRouting })}
                  className={`w-full py-0.5 rounded font-bold ${inst.filterRouting ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'bg-neutral-900 text-neutral-500'}`}
                >
                  {inst.filterRouting ? 'FILTER ON' : 'BYPASS'}
                </button>
              </div>
            </div>

            {/* Key Range Low & High */}
            <div className="grid grid-cols-2 gap-3 text-[11px] text-neutral-400">
              <div>
                <span>Key Range Low: {inst.keyRangeLow}</span>
                <input
                  type="range"
                  min="0"
                  max="127"
                  value={inst.keyRangeLow}
                  onChange={(e) => updateInstrument(idx, { keyRangeLow: parseInt(e.target.value) })}
                  className="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
              <div>
                <span>Key Range High: {inst.keyRangeHigh}</span>
                <input
                  type="range"
                  min="0"
                  max="127"
                  value={inst.keyRangeHigh}
                  onChange={(e) => updateInstrument(idx, { keyRangeHigh: parseInt(e.target.value) })}
                  className="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
            </div>

            {/* LFO Rate & Depth */}
            <div className="grid grid-cols-2 gap-3 text-[11px] text-neutral-400 pt-1 border-t border-neutral-900">
              <div>
                <span>LFO Rate: {inst.lfoRate}</span>
                <input
                  type="range"
                  min="0"
                  max="127"
                  value={inst.lfoRate}
                  onChange={(e) => updateInstrument(idx, { lfoRate: parseInt(e.target.value) })}
                  className="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-purple-400"
                />
              </div>
              <div>
                <span>LFO Depth: {inst.lfoDepth}</span>
                <input
                  type="range"
                  min="0"
                  max="127"
                  value={inst.lfoDepth}
                  onChange={(e) => updateInstrument(idx, { lfoDepth: parseInt(e.target.value) })}
                  className="w-full h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-purple-400"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 4. Drum Engine Sub-Component (Fully Editable 16 Drum Voices + Step Matrix)
// ============================================================================
const DrumEngineView: React.FC<{ patch: DrumPatch; onChange: (p: DrumPatch) => void }> = ({ patch, onChange }) => {
  const [selectedDrumIdx, setSelectedDrumIdx] = useState<number>(0);
  const activeDrum = patch.drums[selectedDrumIdx] || patch.drums[0];

  const updateDrum = (drumIdx: number, updates: Partial<DrumInstrument>) => {
    const newDrums = [...patch.drums];
    newDrums[drumIdx] = { ...newDrums[drumIdx], ...updates };
    onChange({ ...patch, drums: newDrums });
  };

  const toggleDrumStep = (drumIdx: number, stepIdx: number) => {
    const newDrums = [...patch.drums];
    const newSteps = [...newDrums[drumIdx].steps];
    newSteps[stepIdx] = !newSteps[stepIdx];
    newDrums[drumIdx] = { ...newDrums[drumIdx], steps: newSteps };
    onChange({ ...patch, drums: newDrums });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
          16-Voice Analog SID Drum Synthesizer Kit
        </h4>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-neutral-500">Clock Multiplier:</span>
          <select
            value={patch.clockMultiplier}
            onChange={(e) => onChange({ ...patch, clockMultiplier: e.target.value as any })}
            className="bg-neutral-950 border border-neutral-800 rounded px-2 py-0.5 text-amber-300 font-bold"
          >
            <option value="1x">1x Normal</option>
            <option value="2x">2x Double Time</option>
            <option value="0.5x">0.5x Half Time</option>
          </select>
        </div>
      </div>

      {/* Drum Voice Selector Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
        {patch.drums.map((drum, idx) => (
          <button
            key={drum.id}
            onClick={() => setSelectedDrumIdx(idx)}
            className={`p-2 rounded border text-left font-mono text-[11px] transition ${
              selectedDrumIdx === idx
                ? 'bg-amber-950/80 border-amber-600 text-amber-200 font-bold shadow'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            <div className="text-[10px] text-neutral-500 font-bold">V{drum.id}</div>
            <div className="truncate">{drum.name}</div>
            <div className="text-[9px] text-amber-400/80">Note {drum.triggerNote}</div>
          </button>
        ))}
      </div>

      {/* Selected Drum Sound Shaping Panel */}
      <div className="p-4 bg-neutral-950/60 rounded-lg border border-neutral-800 space-y-4 text-xs font-mono">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-amber-400 font-bold uppercase tracking-wider">
              Voice {activeDrum.id}:
            </span>
            <input
              type="text"
              value={activeDrum.name}
              onChange={(e) => updateDrum(selectedDrumIdx, { name: e.target.value })}
              className="bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5 text-white font-bold"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-500">Trigger Note:</span>
              <input
                type="number"
                min="0"
                max="127"
                value={activeDrum.triggerNote}
                onChange={(e) => updateDrum(selectedDrumIdx, { triggerNote: parseInt(e.target.value) || 36 })}
                className="w-14 bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-center text-white"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-neutral-500">Type:</span>
              <select
                value={activeDrum.voiceType}
                onChange={(e) => updateDrum(selectedDrumIdx, { voiceType: e.target.value as any })}
                className="bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5 text-cyan-300 font-bold"
              >
                <option value="analog_kick">Analog Kick</option>
                <option value="analog_snare">Analog Snare</option>
                <option value="noise_hat">Noise Hat</option>
                <option value="tom">Analog Tom</option>
                <option value="zap">Laser Zap</option>
                <option value="metallic">Metallic Cymbal</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="flex justify-between mb-1 text-neutral-400">
              <span>Decay</span>
              <span className="text-white font-bold">{activeDrum.decay}</span>
            </div>
            <input
              type="range"
              min="0"
              max="127"
              value={activeDrum.decay}
              onChange={(e) => updateDrum(selectedDrumIdx, { decay: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-neutral-800 rounded appearance-none cursor-pointer accent-amber-400"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1 text-neutral-400">
              <span>Pitch Tuning</span>
              <span className="text-white font-bold">{activeDrum.pitch}</span>
            </div>
            <input
              type="range"
              min="0"
              max="127"
              value={activeDrum.pitch}
              onChange={(e) => updateDrum(selectedDrumIdx, { pitch: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-neutral-800 rounded appearance-none cursor-pointer accent-amber-400"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1 text-neutral-400">
              <span>Pitch Sweep Rate</span>
              <span className="text-white font-bold">{activeDrum.sweepRate}</span>
            </div>
            <input
              type="range"
              min="0"
              max="127"
              value={activeDrum.sweepRate}
              onChange={(e) => updateDrum(selectedDrumIdx, { sweepRate: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-neutral-800 rounded appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1 text-neutral-400">
              <span>Filter Cutoff</span>
              <span className="text-white font-bold">{activeDrum.filterCutoff}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2047"
              value={activeDrum.filterCutoff}
              onChange={(e) => updateDrum(selectedDrumIdx, { filterCutoff: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-neutral-800 rounded appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
        </div>

        {/* 16-Step Drum Sequencer Trigger Lane */}
        <div className="pt-3 border-t border-neutral-800 space-y-2">
          <span className="text-xs font-mono font-bold text-neutral-300 block">
            16-Step Rhythm Sequencer (Voice {activeDrum.id} Triggers)
          </span>
          <div className="grid grid-cols-8 sm:grid-cols-16 gap-1">
            {activeDrum.steps.map((st, sIdx) => (
              <button
                key={sIdx}
                onClick={() => toggleDrumStep(selectedDrumIdx, sIdx)}
                className={`py-2 rounded font-mono text-center text-[10px] font-bold transition ${
                  st
                    ? 'bg-amber-500 text-black shadow'
                    : 'bg-neutral-900 border border-neutral-800 text-neutral-600 hover:text-neutral-400'
                }`}
              >
                {sIdx + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
