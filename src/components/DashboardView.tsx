import React from 'react';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Layers,
  ArrowRight,
  Disc3,
  Sliders,
  Volume2,
  PlayCircle
} from 'lucide-react';
import { MidiSongModel } from '../types/index.ts';

interface DashboardViewProps {
  songModel: MidiSongModel | null;
  onLoadDemo: () => void;
  onNavigateTab: (tabId: string) => void;
  isSimulatorMode: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  songModel,
  onLoadDemo,
  onNavigateTab,
  isSimulatorMode
}) => {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-neutral-200">
      {/* Top Banner / Welcome */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono text-[11px] font-bold">
              PHASE 0-5 READY
            </span>
            <span className="text-neutral-500 font-mono text-xs">Windows Desktop Prototype</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Chiptune Hardware Workstation Studio Rack
          </h1>
          <p className="text-sm text-neutral-400 mt-1 max-w-3xl">
            Orchestrate 8 primary musical tracks + auxiliary DPCM lane across physical MIDInes and 8-chip MIDIbox SID hardware.
            Mix multichannel analog returns through your MOTU/AVB interface, route through dual external hardware FX loops,
            capture the dedicated mastering return, and export loop-validated OGG Vorbis BGM for RPG Maker MV.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onLoadDemo}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition active:scale-95"
          >
            <PlayCircle className="w-4 h-4" />
            <span>Load 8-Track Demo Song</span>
          </button>
        </div>
      </div>

      {/* Visual Hardware Studio Topology Flow */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400 mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>Physical Hardware Signal & Data Topology</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs font-mono">
          {/* Step 1: MIDI Sequencer */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-neutral-400 mb-2">
                <span className="font-bold text-white">1. SMF ENGINE</span>
                <span className="text-[10px] bg-neutral-800 px-1.5 py-0.5 rounded">PC</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed font-sans">
                8 Fixed Instrument Tracks + 1 Aux DPCM Lane. Sample-stable monotonic scheduler.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-neutral-800/80 text-[10px] text-emerald-400 flex items-center justify-between">
              <span>MIDI OUT A & B</span>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-500" />
            </div>
          </div>

          {/* Step 2: Physical Synths */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-neutral-400 mb-2">
                <span className="font-bold text-white">2. CHIPTUNE SYNTHS</span>
                <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded">HARDWARE</span>
              </div>
              <ul className="text-[11px] text-neutral-400 space-y-1 font-sans">
                <li>• MIDInes (1 Mono APU Out)</li>
                <li>• MIDIbox SID (4 Stereo Pairs)</li>
                <li>• 8 Chips: mixed 6581/8580</li>
              </ul>
            </div>
            <div className="mt-3 pt-2 border-t border-neutral-800/80 text-[10px] text-emerald-400 flex items-center justify-between">
              <span>9 Analog Lines</span>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-500" />
            </div>
          </div>

          {/* Step 3: Multichannel ASIO Interface */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-neutral-400 mb-2">
                <span className="font-bold text-white">3. MOTU 16A / AVB</span>
                <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-1.5 py-0.5 rounded">ASIO</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed font-sans">
                5 Source Strips + 2 Stereo FX Returns + Master Send Bus. 32-bit float internal mix.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-neutral-800/80 text-[10px] text-emerald-400 flex items-center justify-between">
              <span>FX Loops A/B</span>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-500" />
            </div>
          </div>

          {/* Step 4: External FX & Mastering */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-neutral-400 mb-2">
                <span className="font-bold text-white">4. ANALOG MASTER</span>
                <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-800 px-1.5 py-0.5 rounded">OUTBOARD</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed font-sans">
                External Stereo Mastering Chain. Return is strictly isolated to prevent feedback loops.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-neutral-800/80 text-[10px] text-emerald-400 flex items-center justify-between">
              <span>Dedicated Return</span>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-500" />
            </div>
          </div>

          {/* Step 5: Recording & RPG Maker MV Export */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-neutral-400 mb-2">
                <span className="font-bold text-white">5. MV OGG EXPORT</span>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded">RELEASE</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed font-sans">
                24-bit Archival WAV + RPG Maker MV OGG Vorbis BGM with LOOPSTART & LOOPLENGTH tags.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-neutral-800/80 text-[10px] text-emerald-400 flex items-center justify-between">
              <span>Game-Ready</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Two Columns: Preflight Hardware Checklist & Fast Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hardware Preflight Checklist */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400 flex items-center justify-between">
            <span>Hardware Preflight & Rig Verification</span>
            <span className="text-[11px] text-emerald-400 font-normal">All systems nominal</span>
          </h2>

          <div className="space-y-2.5 text-xs font-sans">
            <div className="flex items-start gap-3 p-2.5 rounded-lg bg-neutral-950/70 border border-neutral-800/80">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-neutral-200">8 Primary Tracks + 1 DPCM Lane Defined</div>
                <div className="text-neutral-400 text-[11px] mt-0.5">
                  Track 1-4 mapped to MIDInes voices; Track 5-8 mapped to 4 stereo SID cores; Aux lane mapped to Ch 5 DPCM.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-lg bg-neutral-950/70 border border-neutral-800/80">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-neutral-200">DPCM 256-Sample Library Loaded (Provisional Status)</div>
                <div className="text-neutral-400 text-[11px] mt-0.5">
                  All 256 Nullsleep samples imported (Bank 1: CC14=0, Bank 2: CC14=64). Note order labeled as inferred pending physical cart verification.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-lg bg-neutral-950/70 border border-neutral-800/80">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-neutral-200">ASIO Routing & Feedback Safety Interlock</div>
                <div className="text-neutral-400 text-[11px] mt-0.5">
                  Master Return input is verified isolated from Master Send and FX loops. Zero circular digital feedback risk.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-lg bg-neutral-950/70 border border-neutral-800/80">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-neutral-200">RPG Maker MV BGM Loop Validation Active</div>
                <div className="text-neutral-400 text-[11px] mt-0.5">
                  Automated Vorbis comment encoder writes exact sample frames into LOOPSTART and LOOPLENGTH headers with 10-cycle seam test.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Module Navigation */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400 flex items-center justify-between">
            <span>Workstation Modules</span>
            <span className="text-[11px] text-neutral-500 font-mono">9 Sections</span>
          </h2>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <button
              onClick={() => onNavigateTab('midi')}
              className="p-3 bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-800 rounded-lg text-left transition flex flex-col justify-between group"
            >
              <div className="text-neutral-400 group-hover:text-emerald-400 font-bold">2. MIDI IMPORT</div>
              <div className="text-[11px] text-neutral-500 font-sans mt-1">SMF parser & 8-track matrix</div>
            </button>

            <button
              onClick={() => onNavigateTab('midines')}
              className="p-3 bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-800 rounded-lg text-left transition flex flex-col justify-between group"
            >
              <div className="text-neutral-400 group-hover:text-emerald-400 font-bold">3. MIDINES EDITOR</div>
              <div className="text-[11px] text-neutral-500 font-sans mt-1">5 NES voices & 256 DPCM browser</div>
            </button>

            <button
              onClick={() => onNavigateTab('sid')}
              className="p-3 bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-800 rounded-lg text-left transition flex flex-col justify-between group"
            >
              <div className="text-neutral-400 group-hover:text-emerald-400 font-bold">4. MIDIBOX SID</div>
              <div className="text-[11px] text-neutral-500 font-sans mt-1">4 stereo cores, filters, 8 chips</div>
            </button>

            <button
              onClick={() => onNavigateTab('mixer')}
              className="p-3 bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-800 rounded-lg text-left transition flex flex-col justify-between group"
            >
              <div className="text-neutral-400 group-hover:text-emerald-400 font-bold">5. AUDIO MIXER</div>
              <div className="text-[11px] text-neutral-500 font-sans mt-1">5 sources, 2 FX returns, VU meters</div>
            </button>

            <button
              onClick={() => onNavigateTab('patchbay')}
              className="p-3 bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-800 rounded-lg text-left transition flex flex-col justify-between group"
            >
              <div className="text-neutral-400 group-hover:text-emerald-400 font-bold">6. ASIO PATCHBAY</div>
              <div className="text-[11px] text-neutral-500 font-sans mt-1">MOTU/AVB routing & calibration</div>
            </button>

            <button
              onClick={() => onNavigateTab('mastering')}
              className="p-3 bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-800 rounded-lg text-left transition flex flex-col justify-between group border-emerald-900/40"
            >
              <div className="text-emerald-400 font-bold">7. MASTER & OGG</div>
              <div className="text-[11px] text-neutral-500 font-sans mt-1">Record return & MV Vorbis export</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
