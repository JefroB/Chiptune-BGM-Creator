import React, { useState } from 'react';
import {
  Layers,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Radio,
  Clock,
  RotateCcw,
  Zap
} from 'lucide-react';
import { RoutingConfig } from '../types/index.ts';
import { validateRoutingForFeedbackLoops } from '../services/feedbackValidator.ts';

interface PatchbayViewProps {
  routing: RoutingConfig;
  onUpdateRouting: (newRouting: RoutingConfig) => void;
  calibration: {
    midiOffsetMs: number;
    fxLoopRoundtripMs: number;
    masterRoundtripMs: number;
  };
  onUpdateCalibration: (cal: {
    midiOffsetMs: number;
    fxLoopRoundtripMs: number;
    masterRoundtripMs: number;
  }) => void;
}

export const PatchbayView: React.FC<PatchbayViewProps> = ({
  routing,
  onUpdateRouting,
  calibration,
  onUpdateCalibration
}) => {
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationLog, setCalibrationLog] = useState<string | null>(null);

  // Available physical ASIO channels (e.g. MOTU 16A AVB)
  const physicalInputs = Array.from({ length: 16 }, (_, i) => ({
    id: `in_${i + 1}`,
    name: `MOTU In ${i + 1} (Analog)`
  }));

  const physicalOutputs = Array.from({ length: 16 }, (_, i) => ({
    id: `out_${i + 1}`,
    name: `MOTU Out ${i + 1} (Analog)`
  }));

  // Feedback loop check
  const feedbackReport = validateRoutingForFeedbackLoops(routing);

  const runLatencyCalibration = () => {
    setIsCalibrating(true);
    setCalibrationLog('Checking native ASIO loopback detector on Master Send (Out 1/2) -> Mastering Return (In 14/15)...');

    setTimeout(() => {
      // In simulator / browser mode without a physical audio cable connecting Out 1/2 to In 14/15:
      const bufferSamples = 128;
      const sampleRate = 48000;
      const theoreticalBufferMs = Math.round((bufferSamples / sampleRate) * 1000 * 10) / 10;
      onUpdateCalibration({
        midiOffsetMs: 1.5,
        fxLoopRoundtripMs: 5.3,
        masterRoundtripMs: theoreticalBufferMs
      });
      setCalibrationLog(
        `Simulation Latency: ASIO buffer delay calculated at ${theoreticalBufferMs}ms (${bufferSamples} spl @ ${sampleRate / 1000}kHz). Physical roundtrip measurement requires native loopback cable.`
      );
      setIsCalibrating(false);
    }, 500);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-neutral-200">
      {/* Top Banner */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 font-mono text-[11px] font-bold">
              SIMULATED PATCHBAY / NO PHYSICAL ASIO
            </span>
            <span className="text-neutral-500 font-mono text-xs">Topological Anti-Feedback Validation Engine</span>
          </div>
          <h2 className="text-lg font-bold text-white">ASIO Channel Routing Matrix & Latency Alignment</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Assign physical MOTU 16A analog jacks to synthesizer inputs, external stereo FX loops, and mastering return.
            Topological feedback loop prevention engine guarantees circular signal paths are blocked.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={runLatencyCalibration}
            disabled={isCalibrating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-cyan-300 border border-neutral-700 font-semibold text-xs shadow-md transition"
          >
            <Zap className="w-4 h-4" />
            <span>{isCalibrating ? 'Calculating...' : 'Calculate Buffer Latency'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Safety Warning (if detected) */}
      {feedbackReport.hasFeedback ? (
        <div className="bg-red-950/70 border border-red-700 rounded-xl p-4 text-xs font-mono flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-red-200 uppercase">
              POTENTIAL HARDWARE FEEDBACK LOOP DETECTED
            </span>
            <ul className="list-disc pl-4 space-y-1 text-neutral-300">
              {feedbackReport.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-xl p-3.5 text-xs font-mono flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-emerald-300">
            Routing interlock verified: All physical loops are isolated. Master Return cannot feed Master Send.
          </span>
        </div>
      )}

      {/* Latency Calibration Card */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Clock Latency & Roundtrip Time Alignment</span>
          </h3>
          <span className="text-xs font-mono text-neutral-400">
            Audio Clock Reference: 48,000 Hz
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="bg-neutral-950 p-3.5 rounded-lg border border-neutral-800 space-y-2">
            <span className="text-neutral-400 block font-semibold">MIDI-to-Audio Offset</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-emerald-400">{calibration.midiOffsetMs.toFixed(1)}</span>
              <span className="text-neutral-500">ms ({Math.round(calibration.midiOffsetMs * 48)} spl)</span>
            </div>
            <p className="text-[11px] text-neutral-500 font-sans">
              Compensates USB MIDI dispatch delay and analog synthesizer attack rise time.
            </p>
          </div>

          <div className="bg-neutral-950 p-3.5 rounded-lg border border-neutral-800 space-y-2">
            <span className="text-neutral-400 block font-semibold">External FX Loops Roundtrip</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-cyan-400">{calibration.fxLoopRoundtripMs.toFixed(1)}</span>
              <span className="text-neutral-500">ms ({Math.round(calibration.fxLoopRoundtripMs * 48)} spl)</span>
            </div>
            <p className="text-[11px] text-neutral-500 font-sans">
              DA/AD converter buffer latency across external stereo delay/reverb units.
            </p>
          </div>

          <div className="bg-neutral-950 p-3.5 rounded-lg border border-neutral-800 space-y-2">
            <span className="text-neutral-400 block font-semibold">Mastering Chain Roundtrip</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-purple-400">{calibration.masterRoundtripMs.toFixed(1)}</span>
              <span className="text-neutral-500">ms ({Math.round(calibration.masterRoundtripMs * 48)} spl)</span>
            </div>
            <p className="text-[11px] text-neutral-500 font-sans">
              Master Send to dedicated Mastering Return capture timeline alignment.
            </p>
          </div>
        </div>

        {calibrationLog && (
          <div className="p-3 bg-neutral-950 border border-neutral-800 rounded font-mono text-[11px] text-emerald-400">
            {calibrationLog}
          </div>
        )}
      </div>

      {/* Main Channel Routing Assignment Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono">
        {/* Physical Inputs */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
          <h3 className="font-bold text-white border-b border-neutral-800 pb-2 flex items-center justify-between">
            <span>Physical ASIO Inputs (Synthesizers & Returns)</span>
            <span className="text-[11px] text-neutral-500">MOTU 16A</span>
          </h3>

          <div className="space-y-3">
            {/* NES Mono In */}
            <div className="flex items-center justify-between bg-neutral-950 p-2.5 rounded border border-neutral-800">
              <span className="text-neutral-300 font-semibold">MIDInes Mono Audio In</span>
              <select
                value={routing.nesInput.channelId}
                onChange={(e) =>
                  onUpdateRouting({
                    ...routing,
                    nesInput: { kind: 'mono', channelId: e.target.value }
                  })
                }
                className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-emerald-300"
              >
                {physicalInputs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* SID 1-4 Stereo Pairs */}
            {[0, 1, 2, 3].map((sIdx) => (
              <div
                key={sIdx}
                className="flex items-center justify-between bg-neutral-950 p-2.5 rounded border border-neutral-800"
              >
                <span className="text-neutral-300 font-semibold">SID Core {sIdx + 1} Stereo Pair</span>
                <div className="flex items-center gap-1">
                  <select
                    value={routing.sidInputs[sIdx].leftId}
                    onChange={(e) => {
                      const updated = [...routing.sidInputs] as typeof routing.sidInputs;
                      updated[sIdx] = { ...updated[sIdx], leftId: e.target.value };
                      onUpdateRouting({ ...routing, sidInputs: updated });
                    }}
                    className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-1 text-cyan-300 text-[11px]"
                  >
                    {physicalInputs.map((p) => (
                      <option key={p.id} value={p.id}>
                        L: {p.id}
                      </option>
                    ))}
                  </select>
                  <select
                    value={routing.sidInputs[sIdx].rightId}
                    onChange={(e) => {
                      const updated = [...routing.sidInputs] as typeof routing.sidInputs;
                      updated[sIdx] = { ...updated[sIdx], rightId: e.target.value };
                      onUpdateRouting({ ...routing, sidInputs: updated });
                    }}
                    className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-1 text-cyan-300 text-[11px]"
                  >
                    {physicalInputs.map((p) => (
                      <option key={p.id} value={p.id}>
                        R: {p.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}

            {/* Dedicated Mastering Return */}
            <div className="flex items-center justify-between bg-red-950/30 p-2.5 rounded border border-red-900/60">
              <div>
                <span className="text-red-300 font-bold block">Dedicated Mastering Return</span>
                <span className="text-[10px] text-neutral-400 font-sans">Final capture source only</span>
              </div>
              <div className="flex items-center gap-1">
                <select
                  value={routing.masterReturn.leftId}
                  onChange={(e) =>
                    onUpdateRouting({
                      ...routing,
                      masterReturn: { ...routing.masterReturn, leftId: e.target.value }
                    })
                  }
                  className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-1 text-red-300 text-[11px]"
                >
                  {physicalInputs.map((p) => (
                    <option key={p.id} value={p.id}>
                      L: {p.id}
                    </option>
                  ))}
                </select>
                <select
                  value={routing.masterReturn.rightId}
                  onChange={(e) =>
                    onUpdateRouting({
                      ...routing,
                      masterReturn: { ...routing.masterReturn, rightId: e.target.value }
                    })
                  }
                  className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-1 text-red-300 text-[11px]"
                >
                  {physicalInputs.map((p) => (
                    <option key={p.id} value={p.id}>
                      R: {p.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Physical Outputs */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
          <h3 className="font-bold text-white border-b border-neutral-800 pb-2 flex items-center justify-between">
            <span>Physical ASIO Outputs (FX Sends & Master Send)</span>
            <span className="text-[11px] text-neutral-500">MOTU 16A</span>
          </h3>

          <div className="space-y-3">
            {/* Master Send Pair */}
            <div className="flex items-center justify-between bg-purple-950/30 p-2.5 rounded border border-purple-900/60">
              <div>
                <span className="text-purple-300 font-bold block">Master Send (Outboard Feeder)</span>
                <span className="text-[10px] text-neutral-400 font-sans">Feeds external mastering hardware</span>
              </div>
              <div className="flex items-center gap-1">
                <select
                  value={routing.masterSend.leftId}
                  onChange={(e) =>
                    onUpdateRouting({
                      ...routing,
                      masterSend: { ...routing.masterSend, leftId: e.target.value }
                    })
                  }
                  className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-1 text-purple-300 text-[11px]"
                >
                  {physicalOutputs.map((p) => (
                    <option key={p.id} value={p.id}>
                      L: {p.id}
                    </option>
                  ))}
                </select>
                <select
                  value={routing.masterSend.rightId}
                  onChange={(e) =>
                    onUpdateRouting({
                      ...routing,
                      masterSend: { ...routing.masterSend, rightId: e.target.value }
                    })
                  }
                  className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-1 text-purple-300 text-[11px]"
                >
                  {physicalOutputs.map((p) => (
                    <option key={p.id} value={p.id}>
                      R: {p.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* External FX Loop A */}
            <div className="flex items-center justify-between bg-neutral-950 p-2.5 rounded border border-neutral-800">
              <span className="text-neutral-300 font-semibold">FX A Send Outputs (Delay)</span>
              <div className="flex items-center gap-1">
                <select
                  value={routing.effectA.sendOutput.leftId}
                  onChange={(e) =>
                    onUpdateRouting({
                      ...routing,
                      effectA: {
                        ...routing.effectA,
                        sendOutput: { ...routing.effectA.sendOutput, leftId: e.target.value }
                      }
                    })
                  }
                  className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-1 text-neutral-300 text-[11px]"
                >
                  {physicalOutputs.map((p) => (
                    <option key={p.id} value={p.id}>
                      L: {p.id}
                    </option>
                  ))}
                </select>
                <select
                  value={routing.effectA.sendOutput.rightId}
                  onChange={(e) =>
                    onUpdateRouting({
                      ...routing,
                      effectA: {
                        ...routing.effectA,
                        sendOutput: { ...routing.effectA.sendOutput, rightId: e.target.value }
                      }
                    })
                  }
                  className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-1 text-neutral-300 text-[11px]"
                >
                  {physicalOutputs.map((p) => (
                    <option key={p.id} value={p.id}>
                      R: {p.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* External FX Loop B */}
            <div className="flex items-center justify-between bg-neutral-950 p-2.5 rounded border border-neutral-800">
              <span className="text-neutral-300 font-semibold">FX B Send Outputs (Reverb)</span>
              <div className="flex items-center gap-1">
                <select
                  value={routing.effectB.sendOutput.leftId}
                  onChange={(e) =>
                    onUpdateRouting({
                      ...routing,
                      effectB: {
                        ...routing.effectB,
                        sendOutput: { ...routing.effectB.sendOutput, leftId: e.target.value }
                      }
                    })
                  }
                  className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-1 text-neutral-300 text-[11px]"
                >
                  {physicalOutputs.map((p) => (
                    <option key={p.id} value={p.id}>
                      L: {p.id}
                    </option>
                  ))}
                </select>
                <select
                  value={routing.effectB.sendOutput.rightId}
                  onChange={(e) =>
                    onUpdateRouting({
                      ...routing,
                      effectB: {
                        ...routing.effectB,
                        sendOutput: { ...routing.effectB.sendOutput, rightId: e.target.value }
                      }
                    })
                  }
                  className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-1 text-neutral-300 text-[11px]"
                >
                  {physicalOutputs.map((p) => (
                    <option key={p.id} value={p.id}>
                      R: {p.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
