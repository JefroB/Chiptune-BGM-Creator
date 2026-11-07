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

// MIDIbox SID Parameters & Engine Schemas (V2 Discriminated Unions)
export type SidChipModel = '6581' | '8580' | '6582';
export type SidEngineType = 'lead' | 'bassline' | 'multi' | 'drum';

export interface SidOscillatorParams {
  waveform: 'saw' | 'pulse' | 'triangle' | 'noise' | 'combined';
  pulseWidth: number; // 0-4095 (12-bit SID register)
  octave: number; // -3 to +3
  semitone: number; // -12 to +12
  finetune: number; // -64 to +63
  sync: boolean;
  ringMod: boolean;
  portamentoRate: number; // 0-127
}

export interface SidFilterParams {
  cutoff: number; // 0-2047 (11-bit SID register)
  resonance: number; // 0-15
  lowPass: boolean;
  bandPass: boolean;
  highPass: boolean;
  voice1Filter: boolean;
  voice2Filter: boolean;
  voice3Filter: boolean;
  mode303: boolean;
  externalIn: boolean;
}

export interface SidEnvelopeParams {
  attack: number; // 0-15
  decay: number; // 0-15
  sustain: number; // 0-15
  release: number; // 0-15
  curve?: number; // 0-127 optional extended envelope contour
}

export interface SidLfoParams {
  waveform: 'sine' | 'tri' | 'saw' | 'pulse' | 'rand';
  rate: number; // 0-127
  depth: number; // 0-127
  sync: boolean;
  phase: number; // 0-360
}

export interface SidModMatrixRow {
  id: number; // 1-8
  source1: 'LFO1' | 'LFO2' | 'LFO3' | 'LFO4' | 'LFO5' | 'LFO6' | 'ENV1' | 'ENV2' | 'WT1' | 'WT2' | 'VEL' | 'MOD' | 'PB' | 'NONE';
  source2: 'LFO1' | 'LFO2' | 'LFO3' | 'LFO4' | 'LFO5' | 'LFO6' | 'ENV1' | 'ENV2' | 'WT1' | 'WT2' | 'VEL' | 'MOD' | 'PB' | 'NONE';
  operator: 'NOP' | 'ADD' | 'SUB' | 'MUL' | 'XOR' | 'MIN' | 'MAX';
  depth: number; // -128 to +127
  invertLeft: boolean;
  invertRight: boolean;
  targetLeft: 'PITCH_ALL' | 'PITCH_OSC1' | 'PW_ALL' | 'CUTOFF' | 'RESONANCE' | 'VOLUME' | 'PAN' | 'NONE';
  targetRight: 'PITCH_ALL' | 'PITCH_OSC1' | 'PW_ALL' | 'CUTOFF' | 'RESONANCE' | 'VOLUME' | 'PAN' | 'NONE';
}

export interface SidWavetableParams {
  id: number; // 1-4
  stepCount: number; // 1-16
  speed: number; // 0-127
  loopMode: 'off' | 'forward' | 'pingpong';
  steps: number[]; // 16 values (0-127 or signed pitch)
}

// 1. Lead Engine Patch (6 Oscillators across 2 sockets, 6 LFOs, 2 ENVs, 8-path mod matrix, 4 wavetables)
export interface LeadPatch {
  coreId: 'sid.core1' | 'sid.core2' | 'sid.core3' | 'sid.core4';
  name: string;
  engine: 'lead';
  socketLeftModel: SidChipModel;
  socketRightModel: SidChipModel;
  stereoSpread: number; // 0-100%
  syncStatus: 'synced' | 'pending' | 'unverified' | 'offline';
  // Left SID Chip Oscillators
  osc1: SidOscillatorParams;
  osc2: SidOscillatorParams;
  osc3: SidOscillatorParams;
  // Right SID Chip Oscillators
  osc4: SidOscillatorParams;
  osc5: SidOscillatorParams;
  osc6: SidOscillatorParams;
  filter: SidFilterParams;
  filterRight?: SidFilterParams;
  ampEnv: SidEnvelopeParams;
  filterEnv: SidEnvelopeParams;
  // 6 LFOs
  lfos: [SidLfoParams, SidLfoParams, SidLfoParams, SidLfoParams, SidLfoParams, SidLfoParams];
  // 2 Extended Envelopes
  envs: [SidEnvelopeParams, SidEnvelopeParams];
  // 8-Path Modulation Matrix
  modMatrix: SidModMatrixRow[];
  // 4 Wavetables
  wavetables: [SidWavetableParams, SidWavetableParams, SidWavetableParams, SidWavetableParams];
  arpEnabled: boolean;
  arpRate: '1/16' | '1/32' | '1/8';
  arpRange: number;
  rawSysExDump?: number[];
  rawOpaqueBytes?: number[];
}

// 2. Bassline Engine Patch (TB-303 Architecture with 2 independent basslines Left/Right)
export interface BasslineInstrument {
  waveform: 'saw' | 'pulse';
  pulseWidth: number; // 0-4095
  cutoff: number; // 0-2047
  resonance: number; // 0-15
  envModDepth: number; // 0-127
  decay: number; // 0-127
  accentDepth: number; // 0-127
  glideRate: number; // 0-127
  octave: number;
  steps: Array<{
    note: number; // 0-11
    octave: number; // -2 to +2
    gate: boolean;
    slide: boolean;
    accent: boolean;
  }>; // 16 steps
}

export interface BasslinePatch {
  coreId: 'sid.core1' | 'sid.core2' | 'sid.core3' | 'sid.core4';
  name: string;
  engine: 'bassline';
  socketLeftModel: SidChipModel;
  socketRightModel: SidChipModel;
  stereoSpread: number;
  syncStatus: 'synced' | 'pending' | 'unverified' | 'offline';
  inst1: BasslineInstrument; // Left SID
  inst2: BasslineInstrument; // Right SID
  sequencerMode: 'internal_sequencer' | 'external_midi';
  clockSync: 'internal' | 'midi_clock';
  swing: number; // 0-100%
  rawSysExDump?: number[];
  rawOpaqueBytes?: number[];
}

// 3. Multi Engine Patch (Up to 6 independent instruments inside the core)
export interface MultiInstrument {
  id: number; // 1-6
  name: string;
  midiChannel: number; // 1-16
  keyRangeLow: number; // 0-127
  keyRangeHigh: number; // 0-127
  polyphony: 'mono' | 'poly';
  voiceAllocation: number; // 1-6 SID voices
  waveform: 'saw' | 'pulse' | 'triangle' | 'noise';
  octave: number;
  pulseWidth: number;
  env: SidEnvelopeParams;
  lfoRate: number;
  lfoDepth: number;
  filterRouting: boolean;
}

export interface MultiPatch {
  coreId: 'sid.core1' | 'sid.core2' | 'sid.core3' | 'sid.core4';
  name: string;
  engine: 'multi';
  socketLeftModel: SidChipModel;
  socketRightModel: SidChipModel;
  stereoSpread: number;
  syncStatus: 'synced' | 'pending' | 'unverified' | 'offline';
  instruments: MultiInstrument[];
  filter: SidFilterParams;
  rawSysExDump?: number[];
  rawOpaqueBytes?: number[];
}

// 4. Drum Engine Patch (16-voice SID Drum Synthesizer)
export interface DrumInstrument {
  id: number; // 1-16
  name: string;
  triggerNote: number; // MIDI note 35-81
  voiceType: 'analog_kick' | 'analog_snare' | 'noise_hat' | 'tom' | 'zap' | 'metallic';
  decay: number; // 0-127
  pitch: number; // 0-127
  sweepRate: number; // 0-127
  filterCutoff: number; // 0-2047
  filterResonance: number; // 0-15
  accent: number; // 0-127
  steps: boolean[]; // 16 steps
}

export interface DrumPatch {
  coreId: 'sid.core1' | 'sid.core2' | 'sid.core3' | 'sid.core4';
  name: string;
  engine: 'drum';
  socketLeftModel: SidChipModel;
  socketRightModel: SidChipModel;
  stereoSpread: number;
  syncStatus: 'synced' | 'pending' | 'unverified' | 'offline';
  drums: DrumInstrument[];
  clockMultiplier: '1x' | '2x' | '0.5x';
  rawSysExDump?: number[];
  rawOpaqueBytes?: number[];
}

// Discriminated Union for all MIDIbox SID Core Patches
export type SidCorePatch = LeadPatch | BasslinePatch | MultiPatch | DrumPatch;

// Web MIDI and Hardware Device Types
export interface MidiPortInfo {
  id: string;
  name: string;
  manufacturer?: string;
  state: 'connected' | 'disconnected';
  type: 'input' | 'output';
}

export interface HardwareBindingConfig {
  mode: 'simulator' | 'hardware';
  midinesPortId: string | null;
  midinesChannel: number; // default 1
  sidCorePorts: [string | null, string | null, string | null, string | null];
  sidCoreChannels: [number, number, number, number]; // default 6, 7, 8, 9
  syncClockOutput: boolean;
}

export interface RecordingProvenance {
  captureSource: 'physical_mastering_return' | 'synthetic_demo_watermarked';
  deviceId: string;
  channelPair: string;
  sampleRate: number;
  durationSamples: number;
  capturedAt: string;
  isWatermarkedDemo: boolean;
  peakDb: number;
  rmsDb: number;
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
  isConductor: boolean;
  noteCount: number;
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
  midiFileBase64?: string; // Stored raw SMF binary bytes to prevent silent fabrication of demo content
  midiHash?: string;
  recordingProvenance?: RecordingProvenance | null;
  hardwareBinding?: HardwareBindingConfig;
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
    isLoopbackVerified: boolean;
  };
}
