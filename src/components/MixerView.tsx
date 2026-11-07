import React from 'react';
import { Volume2, VolumeX, Sliders, ShieldAlert } from 'lucide-react';
import { MixerStrip } from '../types/index.ts';

interface MixerViewProps {
  mixerStrips: MixerStrip[];
  onUpdateStrip: (index: number, partial: Partial<MixerStrip>) => void;
}

export const MixerView: React.FC<MixerViewProps> = ({
  mixerStrips,
  onUpdateStrip
}) => {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-neutral-200">
      {/* Mixer Top Summary Banner */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono text-[11px] font-bold">
              32-BIT FLOAT SUMMATION BUS
            </span>
            <span className="text-neutral-500 font-mono text-xs">MOTU/AVB Multichannel Mixer Console</span>
          </div>
          <h2 className="text-lg font-bold text-white">Multichannel Console & Hardware Effects Routing</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Five analog source strips + two external stereo FX returns + Master Send + dedicated Mastering Return.
            Dual pre/post auxiliary sends feed external rack processors.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="bg-neutral-950 border border-neutral-800 px-3 py-1.5 rounded flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-neutral-400">FX Loop A: <strong className="text-emerald-400">Tape Delay (Out 3/4 & In 10/11)</strong></span>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 px-3 py-1.5 rounded flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-neutral-400">FX Loop B: <strong className="text-emerald-400">Plate Reverb (Out 5/6 & In 12/13)</strong></span>
          </div>
        </div>
      </div>

      {/* Main Mixer Channel Strips Rack */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 shadow-2xl overflow-x-auto">
        <div className="flex gap-2 min-w-[980px] justify-between">
          {mixerStrips.map((strip, idx) => {
            const isMasterSend = strip.sourceType === 'master_send';
            const isMasteringReturn = strip.sourceType === 'mastering_return';
            const isFxReturn = strip.sourceType === 'fx_return';

            return (
              <div
                key={strip.id}
                className={`flex-1 rounded-xl p-3 border flex flex-col justify-between select-none ${
                  isMasteringReturn
                    ? 'bg-red-950/20 border-red-900/60 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                    : isMasterSend
                    ? 'bg-purple-950/20 border-purple-900/60'
                    : isFxReturn
                    ? 'bg-cyan-950/15 border-cyan-900/40'
                    : 'bg-neutral-900/80 border-neutral-800'
                }`}
              >
                {/* Channel Header */}
                <div className="text-center pb-2 border-b border-neutral-800/80">
                  <span
                    className={`text-[10px] font-mono font-bold uppercase tracking-wider block truncate ${
                      isMasteringReturn
                        ? 'text-red-400'
                        : isMasterSend
                        ? 'text-purple-400'
                        : isFxReturn
                        ? 'text-cyan-400'
                        : 'text-neutral-400'
                    }`}
                  >
                    {strip.title}
                  </span>
                  <span className="text-[9px] text-neutral-500 font-mono block">
                    {strip.sourceType === 'nes_mono'
                      ? 'Mono -> Pan'
                      : strip.sourceType === 'sid_stereo'
                      ? 'Stereo In'
                      : strip.sourceType === 'fx_return'
                      ? 'FX Return'
                      : isMasteringReturn
                      ? 'Capture Input'
                      : 'Stereo Mix'}
                  </span>
                </div>

                {/* Gain Trim Knob */}
                {!isMasterSend && !isMasteringReturn && (
                  <div className="py-2 border-b border-neutral-800/60 text-center font-mono text-[10px]">
                    <span className="text-neutral-500 block mb-1">TRIM</span>
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="range"
                        min="-18"
                        max="18"
                        step="0.5"
                        value={strip.gainTrimDb}
                        onChange={(e) =>
                          onUpdateStrip(idx, { gainTrimDb: parseFloat(e.target.value) })
                        }
                        className="w-16 accent-emerald-500"
                      />
                      <span className="text-emerald-400 w-8 text-right">
                        {strip.gainTrimDb > 0 ? `+${strip.gainTrimDb}` : strip.gainTrimDb}
                      </span>
                    </div>
                  </div>
                )}

                {/* External FX Sends (A & B) */}
                {!isMasterSend && !isMasteringReturn && !isFxReturn && (
                  <div className="py-2.5 border-b border-neutral-800/60 space-y-2 font-mono text-[10px]">
                    {/* Send A */}
                    <div>
                      <div className="flex justify-between text-neutral-400">
                        <span>SEND A (Delay)</span>
                        <span className="text-cyan-400">
                          {strip.sendADb <= -30 ? '-inf' : `${strip.sendADb.toFixed(0)}dB`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-30"
                        max="6"
                        step="1"
                        value={strip.sendADb}
                        onChange={(e) =>
                          onUpdateStrip(idx, { sendADb: parseFloat(e.target.value) })
                        }
                        className="w-full accent-cyan-500"
                      />
                    </div>

                    {/* Send B */}
                    <div>
                      <div className="flex justify-between text-neutral-400">
                        <span>SEND B (Reverb)</span>
                        <span className="text-purple-400">
                          {strip.sendBDb <= -30 ? '-inf' : `${strip.sendBDb.toFixed(0)}dB`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-30"
                        max="6"
                        step="1"
                        value={strip.sendBDb}
                        onChange={(e) =>
                          onUpdateStrip(idx, { sendBDb: parseFloat(e.target.value) })
                        }
                        className="w-full accent-purple-500"
                      />
                    </div>
                  </div>
                )}

                {/* Pan / Balance Slider */}
                {!isMasterSend && !isMasteringReturn && (
                  <div className="py-2 border-b border-neutral-800/60 text-center font-mono text-[10px]">
                    <div className="flex justify-between text-neutral-500 mb-1">
                      <span>L</span>
                      <span className="text-neutral-400">
                        {strip.pan === 0
                          ? 'C'
                          : strip.pan < 0
                          ? `L${Math.abs(Math.round(strip.pan * 100))}`
                          : `R${Math.round(strip.pan * 100)}`}
                      </span>
                      <span>R</span>
                    </div>
                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.05"
                      value={strip.pan}
                      onChange={(e) =>
                        onUpdateStrip(idx, { pan: parseFloat(e.target.value) })
                      }
                      className="w-full accent-neutral-400"
                    />
                  </div>
                )}

                {/* Mute & Solo Buttons */}
                {!isMasterSend && !isMasteringReturn && (
                  <div className="flex gap-1.5 py-2 justify-center border-b border-neutral-800/60">
                    <button
                      onClick={() => onUpdateStrip(idx, { muted: !strip.muted })}
                      className={`flex-1 py-1 rounded text-[10px] font-mono font-bold transition ${
                        strip.muted
                          ? 'bg-amber-600 text-white shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                          : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                      }`}
                    >
                      MUTE
                    </button>
                    <button
                      onClick={() => onUpdateStrip(idx, { soloed: !strip.soloed })}
                      className={`flex-1 py-1 rounded text-[10px] font-mono font-bold transition ${
                        strip.soloed
                          ? 'bg-cyan-600 text-white shadow-[0_0_8px_rgba(6,182,212,0.6)]'
                          : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                      }`}
                    >
                      SOLO
                    </button>
                  </div>
                )}

                {/* Fader & LED Meter Section */}
                <div className="flex items-center gap-2 py-4 justify-center h-48">
                  {/* Vertical Fader */}
                  <div className="flex flex-col items-center h-full justify-between">
                    <span className="text-[9px] font-mono text-neutral-500">+6</span>
                    <input
                      type="range"
                      min="-60"
                      max="6"
                      step="0.5"
                      value={strip.faderDb}
                      onChange={(e) =>
                        onUpdateStrip(idx, { faderDb: parseFloat(e.target.value) })
                      }
                      className="h-36 -rotate-90 w-36 accent-emerald-500 my-auto cursor-pointer"
                    />
                    <span className="text-[9px] font-mono text-neutral-500">-inf</span>
                  </div>

                  {/* Dual Stereo LED VU Meter */}
                  <div className="flex gap-1 h-36 bg-black/90 p-1 rounded border border-neutral-800">
                    {/* Left Channel */}
                    <div className="w-2.5 h-full bg-neutral-900 rounded-sm flex flex-col justify-end overflow-hidden relative">
                      {/* Clip indicator */}
                      {strip.clipL && (
                        <div className="w-full h-1.5 bg-red-500 absolute top-0 animate-pulse" />
                      )}
                      <div
                        className="w-full transition-all duration-75"
                        style={{
                          height: `${Math.min(100, strip.meterPeakL * 100)}%`,
                          backgroundColor:
                            strip.meterPeakL > 0.9
                              ? '#ef4444'
                              : strip.meterPeakL > 0.7
                              ? '#eab308'
                              : '#10b981'
                        }}
                      />
                    </div>

                    {/* Right Channel */}
                    <div className="w-2.5 h-full bg-neutral-900 rounded-sm flex flex-col justify-end overflow-hidden relative">
                      {/* Clip indicator */}
                      {strip.clipR && (
                        <div className="w-full h-1.5 bg-red-500 absolute top-0 animate-pulse" />
                      )}
                      <div
                        className="w-full transition-all duration-75"
                        style={{
                          height: `${Math.min(100, strip.meterPeakR * 100)}%`,
                          backgroundColor:
                            strip.meterPeakR > 0.9
                              ? '#ef4444'
                              : strip.meterPeakR > 0.7
                              ? '#eab308'
                              : '#10b981'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Fader Readout & Bottom Label */}
                <div className="pt-2 border-t border-neutral-800/80 text-center font-mono">
                  <span className="text-xs font-bold text-white block">
                    {strip.faderDb <= -60 ? '-inf' : `${strip.faderDb.toFixed(1)} dB`}
                  </span>
                  <span
                    className={`text-[9px] block mt-0.5 font-bold ${
                      isMasteringReturn ? 'text-red-400' : 'text-neutral-500'
                    }`}
                  >
                    {isMasteringReturn ? 'CAPTURE RETURN' : isMasterSend ? 'MASTER BUS' : strip.id}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
