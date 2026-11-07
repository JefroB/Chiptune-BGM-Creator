import React, { useState } from 'react';
import {
  FileCode,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Cpu,
  BookOpen
} from 'lucide-react';
import { AiComposerLinter, ComposerLinterReport } from '../services/aiComposerLinter.ts';
import { MidiSongModel } from '../types/index.ts';

interface AiComposerViewProps {
  songModel: MidiSongModel | null;
}

export const AiComposerView: React.FC<AiComposerViewProps> = ({ songModel }) => {
  const [linterReport, setLinterReport] = useState<ComposerLinterReport | null>(
    songModel ? AiComposerLinter.lint(songModel) : null
  );

  const handleRunLinter = () => {
    if (songModel) {
      setLinterReport(AiComposerLinter.lint(songModel));
    }
  };

  const handleDownloadRulesMd = () => {
    const md = AiComposerLinter.generateComposerRulesMarkdown();
    triggerDownload(new Blob([md], { type: 'text/markdown' }), 'composer_rules.md');
  };

  const handleDownloadCapabilitiesJson = () => {
    const json = AiComposerLinter.generateInstrumentCapabilitiesJson();
    triggerDownload(new Blob([json], { type: 'application/json' }), 'instrument_capabilities.json');
  };

  const handleDownloadDpcmJson = () => {
    const json = AiComposerLinter.generateDpcmSamplesJson();
    triggerDownload(new Blob([json], { type: 'application/json' }), 'dpcm_samples.json');
  };

  const triggerDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-neutral-200">
      {/* Top Banner */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800 font-mono text-[11px] font-bold">
              AI COMPOSITION CONTRACT
            </span>
            <span className="text-neutral-500 font-mono text-xs">Standardized Machine-Readable Handoff Specs</span>
          </div>
          <h2 className="text-lg font-bold text-white">AI Composer Specification, Linter & Rules</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Ensure AI-generated MIDI adheres strictly to the 8 primary musical tracks, 5-voice MIDInes limitations, and 8-chip MIDIbox SID hardware profiles.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadRulesMd}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-mono text-xs border border-neutral-700 transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>composer_rules.md</span>
          </button>
          <button
            onClick={handleDownloadCapabilitiesJson}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-mono text-xs border border-neutral-700 transition"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>capabilities.json</span>
          </button>
          <button
            onClick={handleDownloadDpcmJson}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-mono text-xs border border-neutral-700 transition"
          >
            <Download className="w-3.5 h-3.5 text-purple-400" />
            <span>dpcm_samples.json</span>
          </button>
        </div>
      </div>

      {/* Linter Execution & Diagnostic Report */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <span>Automated MIDI File Linter</span>
          </h3>
          <button
            onClick={handleRunLinter}
            className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition"
          >
            Re-run Linter Checks
          </button>
        </div>

        {linterReport && (
          <div className="space-y-3 font-mono text-xs">
            <div
              className={`p-4 rounded-lg border flex items-center justify-between ${
                linterReport.passed
                  ? 'bg-emerald-950/30 border-emerald-800 text-emerald-300'
                  : 'bg-red-950/30 border-red-800 text-red-300'
              }`}
            >
              <div className="flex items-center gap-3">
                {linterReport.passed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                )}
                <span className="font-bold text-sm">{linterReport.summary}</span>
              </div>
              <div className="flex items-center gap-3 text-neutral-400 text-xs">
                <span>Errors: <strong className="text-red-400">{linterReport.errorCount}</strong></span>
                <span>Warnings: <strong className="text-amber-400">{linterReport.warningCount}</strong></span>
              </div>
            </div>

            {/* Issues Breakdown */}
            {linterReport.issues.length > 0 && (
              <div className="space-y-2 pt-2">
                {linterReport.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg flex items-start gap-3"
                  >
                    {issue.severity === 'error' ? (
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <div className="font-semibold text-neutral-200">
                        {issue.trackIndex !== undefined ? `[Track ${issue.trackIndex + 1}] ` : ''}
                        {issue.message}
                      </div>
                      <div className="text-neutral-400 text-[11px] font-sans">
                        <span className="text-emerald-400 font-mono">Remediation: </span>
                        {issue.suggestion}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rules Summary Card */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-3 text-xs font-mono">
        <h3 className="font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span>Core Hardware Rules Quick Reference</span>
        </h3>
        <ul className="list-disc pl-5 space-y-1.5 text-neutral-300 font-sans leading-relaxed">
          <li><strong>Monophonic Channels (Tracks 1 to 4):</strong> NES Pulse 1, Pulse 2, Triangle, and Noise can only play 1 note at a time. Polyphonic chords must be voiced across tracks or arpeggiated.</li>
          <li><strong>DPCM Bank Timing:</strong> You must send CC14 (0 for Bank 1, 64 for Bank 2) strictly before note triggers on Channel 5.</li>
          <li><strong>Stereo SID Cores (Tracks 5 to 8):</strong> Each core represents a physical stereo pair with independent filter resonance, waveform selection, and analog overdrive.</li>
          <li><strong>Seamless RPG Maker MV Looping:</strong> Music should be designed to loop seamlessly. Ensure loop start and length snap to musical beat boundaries.</li>
        </ul>
      </div>
    </div>
  );
};
