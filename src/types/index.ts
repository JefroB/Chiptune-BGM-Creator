/**
 * Chiptune Hardware Workstation - Core Domain Types
 * Defines voice assignments, MIDI routing, synthesizer parameters,
 * ASIO patchbay routing, mixer topology, and RPG Maker MV export contracts.
 */

export type VoiceId =
  | 'nes.pulse1'
  | 'nes.pulse2'
  | 'nes.triangle'
  | 'nes.noise'
  | 'nes.dpcm'
  | 'sid.core1'
  | 'sid.core2'
  | 'sid.core3'
  | 'sid.core4';

export interface VoiceDefinition {
  id: VoiceId;
  name: string;
  hardware: 'MIDInes' | 'MIDIbox SID';
  defaultMidiChannel: number; // 1-16
  voiceType: 'pulse' | 'triangle' | 'noise' | 'dpcm' | 'sid-stereo';
  polyphony: 'monophonic' | 'stereo-pair';
  color: string;
}

export const SYSTEM_VOICES: VoiceDefinition[] = [
  { id: 'nes.pulse1', name: 'NES Pulse 1', hardware: 'MIDInes', defaultMidiChannel: 1, voiceType: 'pulse', polyphony: 'monophonic', color: '#ef4444' },
  { id: 'nes.pulse2', name: 'NES Pulse 2', hardware: 'MIDInes', defaultMidiChannel: 2, voiceType: 'pulse', polyphony: 'monophonic', color: '#f97316' },
  { id: 'nes.triangle', name: 'NES Triangle', hardware: 'MIDInes', defaultMidiChannel: 3, voiceType: 'triangle', polyphony: 'monophonic', color: '#eab308' },
  { id: 'nes.noise', name: 'NES Noise', hardware: 'MIDInes', defaultMidiChannel: 4, voiceType: 'noise', polyphony: 'monophonic', color: '#84cc16' },
  { id: 'sid.core1', name: 'SID Core 1 (L/R)', hardware: 'MIDIbox SID', defaultMidiChannel: 6, voiceType: 'sid-stereo', polyphony: 'stereo-pair', color: '#06b6d4' },
  { id: 'sid.core2', name: 'SID Core 2 (L/R)', hardware: 'MIDIbox SID', defaultMidiChannel: 7, voiceType: 'sid-stereo', polyphony: 'stereo-pair', color: '#3b82f6' },
  { id: 'sid.core3', name: 'SID Core 3 (L/R)', hardware: 'MIDIbox SID', defaultMidiChannel: 8, voiceType: 'sid-stereo', polyphony: 'stereo-pair', color: '#8b5cf6' },
  { id: 'sid.core4', name: 'SID Core 4 (L/R)', hardware: 'MIDIbox SID', defaultMidiChannel: 9, voiceType: 'sid-stereo', polyphony: 'stereo-pair', color: '#ec4899' },
  { id: 'nes.dpcm', name: 'NES DPCM Aux', hardware: 'MIDInes', defaultMidiChannel: 5, voiceType: 'dpcm', polyphony: 'monophonic', color: '#10b981' },
];

export interface MidiRoute {
  trackIndex: number;
  trackName: string;
  voiceId: VoiceId;
  outputPortId: string;
  midiChannel: number; // 1-16
  muted: boolean;
  soloed: boolean;
}

// MIDInes Synth Parameters
export interface MidinesPulseParams {
  duty: 0 | 1 | 2 | 3; // 12.5%, 25%, 50%, 75%
  volume: number; // 0-15
  decayRate: number; // 0-15
  decayLoop: boolean;
  sweepEnabled: boolean;
  sweepPeriod: number; // 0-7
  sweepShift: number; // 0-7
  sweepDirection: 'up' | 'down';
  finePitch: number; // 0-127 (centered at 64)
}

export interface MidinesTriangleParams {
  volume: number; // 0-15 (linear counter / on-off)
  linearCounter: number; // 0-127
  finePitch: number;
}

export interface MidinesNoiseParams {
  volume: number; // 0-15
  mode: 'long' | 'short'; // 32767-step periodic vs 93-step metallic loop
  pitchIndex: number; // 0-15 (NES timer period table)
  decayLoop: boolean;
}

export interface MidinesDpcmParams {
  activeBank: 1 | 2; // Bank 1 (CC14 = 0), Bank 2 (CC14 = 64)
  sampleRate: number; // 0-15 (NES DPCM frequency index)
  loop: boolean;
  volume: number; // 0-15
}

export interface MidinesState {
  pulse1: MidinesPulseParams;
  pulse2: MidinesPulseParams;
  triangle: MidinesTriangleParams;
  noise: MidinesNoiseParams;
  dpcm: MidinesDpcmParams;
}

// MIDIbox SID Parameters
export type SidChipModel = '6581' | '8580' | '6582';
export type SidEngineType = 'lead' | 'bassline' | 'multi' | 'drum';

export interface SidOscillatorParams {
  waveform: 'saw' | 'pulse' | 'triangle' | 'noise' | 'combined';
  pulseWidth: number; // 0-4095 (or 0-127 scaled)
  octave: number; // -3 to +3
  semitone: number; // -12 to +12
  finetune: number; // -64 to +63
  sync: boolean;
  ringMod: boolean;
  portamentoRate: number;
}

export interface SidFilterParams {
  cutoff: number; // 0-2047 (0-127 MIDI scaled)
  resonance: number; // 0-15
  lowPass: boolean;
  bandPass: boolean;
  highPass: boolean;
  voice1Filter: boolean;
  voice2Filter: boolean;
  voice3Filter: boolean;
  mode303: boolean;
}

export interface SidEnvelopeParams {
  attack: number; // 0-15
  decay: number; // 0-15
  sustain: number; // 0-15
  release: number; // 0-15
}

export interface SidCorePatch {
  coreId: 'sid.core1' | 'sid.core2' | 'sid.core3' | 'sid.core4';
  name: string;
  engine: SidEngineType;
  socketLeftModel: SidChipModel;
  socketRightModel: SidChipModel;
  stereoSpread: number; // 0-100%
  osc1: SidOscillatorParams;
  osc2: SidOscillatorParams;
  osc3: SidOscillatorParams;
  filter: SidFilterParams;
  filterEnv: SidEnvelopeParams;
  ampEnv: SidEnvelopeParams;
  lfo1Rate: number;
  lfo1Depth: number;
  lfo1Target: 'pitch' | 'pulseWidth' | 'filterCutoff';
  lfo2Rate: number;
  lfo2Depth: number;
  lfo2Target: 'pitch' | 'pulseWidth' | 'filterCutoff';
  arpEnabled: boolean;
  arpRate: '1/16' | '1/32' | '1/8';
  arpRange: number;
}

// ASIO and Physical Routing Matrix
export interface AsioChannel {
  id: string; // e.g. "asio_in_1", "asio_out_1"
  index: number; // 0-based
  name: string; // e.g. "MOTU 16A In 1", "Analog 1-2"
  type: 'input' | 'output';
}

export interface MonoInputRoute {
  kind: 'mono';
  channelId: string;
}

export interface StereoInputRoute {
  kind: 'stereo';
  leftId: string;
  rightId: string;
}

export interface StereoOutputRoute {
  leftId: string;
  rightId: string;
}

export interface RoutingConfig {
  nesInput: MonoInputRoute;
  sidInputs: [StereoInputRoute, StereoInputRoute, StereoInputRoute, StereoInputRoute];
  effectA: {
    sendOutput: StereoOutputRoute;
    returnInput: StereoInputRoute;
  };
  effectB: {
    sendOutput: StereoOutputRoute;
    returnInput: StereoInputRoute;
  };
  masterSend: StereoOutputRoute;
  masterReturn: StereoInputRoute; // Dedicated mastering return, capture-only
}

// Mixer Strip
export interface MixerStrip {
  id: string;
  title: string;
  sourceType: 'nes_mono' | 'sid_stereo' | 'fx_return' | 'master_send' | 'mastering_return';
  gainTrimDb: number; // -18 to +18 dB
  pan: number; // -1.0 (Left) to +1.0 (Right)
  faderDb: number; // -inf to +6 dB (0 dB unity)
  muted: boolean;
  soloed: boolean;
  sendADb: number; // -inf to +6 dB
  sendAPre: boolean;
  sendBDb: number; // -inf to +6 dB
  sendBPre: boolean;
  meterPeakL: number; // 0.0 to 1.5+
  meterPeakR: number;
  meterRmsL: number;
  meterRmsR: number;
  clipL: boolean;
  clipR: boolean;
}

// Recording & RPG Maker MV Export
export interface LoopRegion {
  startTick: number;
  endTick: number;
  startSample: number;
  lengthSamples: number;
  startBar: number;
  startBeat: number;
  endBar: number;
  endBeat: number;
  tailCrossfadeMs: number;
}

export interface ExportSettings {
  format: 'ogg_vorbis_bgm' | 'archival_wav' | 'both';
  oggQuality: number; // 4 to 8 (nominal 6)
  sampleRate: 44100 | 48000;
  bitDepth: 24 | 32;
  fileName: string;
  titleTag: string;
  artistTag: string;
  targetMvProjectFolder: string;
  applyLoopTags: boolean; // LOOPSTART and LOOPLENGTH tags
}

export interface DpcmSampleEntry {
  bank: 1 | 2;
  midi_channel: number;
  midi_note: number;
  note_name: string;
  cc14_value: 0 | 64;
  sample_label: string;
  archive_track_number: number;
  archive_filename: string;
  mapping_status: string;
}

export interface MidiParsedEvent {
  tick: number;
  timeSec: number;
  trackIndex: number;
  type: 'noteOn' | 'noteOff' | 'cc' | 'pitchBend' | 'programChange' | 'sysEx' | 'tempo' | 'timeSignature';
  channel: number; // 0-15 (stored 0-indexed internally, rendered 1-16)
  note?: number;
  velocity?: number;
  controller?: number;
  value?: number;
  data?: Uint8Array;
  bpm?: number;
  numerator?: number;
  denominator?: number;
}

export interface MidiParsedTrack {
  index: number;
  name: string;
  eventCount: number;
  channelMask: number[];
  noteRange: { min: number; max: number };
  events: MidiParsedEvent[];
}

export interface MidiSongModel {
  format: 0 | 1 | 2;
  ppq: number;
  durationSec: number;
  totalTicks: number;
  tracks: MidiParsedTrack[];
  tempoMap: Array<{ tick: number; timeSec: number; bpm: number }>;
  timeSignatures: Array<{ tick: number; numerator: number; denominator: number }>;
  preflightWarnings: PreflightWarning[];
}

export interface PreflightWarning {
  severity: 'error' | 'warning' | 'info';
  category: 'polyphony' | 'note_range' | 'bank_select' | 'sysex' | 'track_count' | 'cc_whitelist';
  trackIndex?: number;
  voiceId?: VoiceId;
  tick?: number;
  message: string;
  suggestion: string;
}

export interface ProjectSession {
  schemaVersion: number;
  id: string;
  title: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  midiFileName: string;
  routes: MidiRoute[];
  midinesState: MidinesState;
  sidPatches: [SidCorePatch, SidCorePatch, SidCorePatch, SidCorePatch];
  routing: RoutingConfig;
  mixer: MixerStrip[];
  loop: LoopRegion;
  exportSettings: ExportSettings;
  calibration: {
    midiOffsetMs: number;
    fxLoopRoundtripMs: number;
    masterRoundtripMs: number;
  };
}
