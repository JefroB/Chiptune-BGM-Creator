/**
 * Default MIDIbox SID V2 Patches for Cores 1 to 4
 * Fully conforms to the discriminated union schemas for Lead, Bassline, Multi, and Drum engines.
 */

import {
  SidCorePatch,
  LeadPatch,
  BasslinePatch,
  MultiPatch,
  DrumPatch
} from '../types/index.ts';

export const DEFAULT_LEAD_PATCH: LeadPatch = {
  coreId: 'sid.core2',
  name: 'Core 2: 8580 Stereo PWM Lead',
  engine: 'lead',
  socketLeftModel: '8580',
  socketRightModel: '8580',
  stereoSpread: 65,
  syncStatus: 'synced',
  // Left SID Chip Oscillators
  osc1: { waveform: 'pulse', pulseWidth: 1500, octave: 0, semitone: 0, finetune: 0, sync: false, ringMod: false, portamentoRate: 0 },
  osc2: { waveform: 'pulse', pulseWidth: 2500, octave: 0, semitone: 0, finetune: 8, sync: false, ringMod: false, portamentoRate: 0 },
  osc3: { waveform: 'triangle', pulseWidth: 2048, octave: -1, semitone: 0, finetune: 0, sync: false, ringMod: false, portamentoRate: 0 },
  // Right SID Chip Oscillators
  osc4: { waveform: 'pulse', pulseWidth: 1550, octave: 0, semitone: 0, finetune: -8, sync: false, ringMod: false, portamentoRate: 0 },
  osc5: { waveform: 'pulse', pulseWidth: 2450, octave: 0, semitone: 0, finetune: 0, sync: false, ringMod: false, portamentoRate: 0 },
  osc6: { waveform: 'triangle', pulseWidth: 2048, octave: -1, semitone: 0, finetune: 0, sync: false, ringMod: false, portamentoRate: 0 },
  filter: {
    cutoff: 1850,
    resonance: 12,
    lowPass: true,
    bandPass: true,
    highPass: false,
    voice1Filter: true,
    voice2Filter: true,
    voice3Filter: false,
    mode303: false,
    externalIn: false
  },
  ampEnv: { attack: 1, decay: 5, sustain: 12, release: 5 },
  filterEnv: { attack: 2, decay: 8, sustain: 6, release: 5 },
  // 6 LFOs
  lfos: [
    { waveform: 'sine', rate: 48, depth: 60, sync: true, phase: 0 },
    { waveform: 'tri', rate: 20, depth: 15, sync: false, phase: 90 },
    { waveform: 'saw', rate: 15, depth: 30, sync: false, phase: 0 },
    { waveform: 'pulse', rate: 10, depth: 40, sync: false, phase: 180 },
    { waveform: 'rand', rate: 65, depth: 25, sync: false, phase: 0 },
    { waveform: 'tri', rate: 25, depth: 10, sync: true, phase: 270 }
  ],
  // 2 Extended Envelopes
  envs: [
    { attack: 2, decay: 6, sustain: 8, release: 4, curve: 32 },
    { attack: 0, decay: 4, sustain: 0, release: 2, curve: 64 }
  ],
  // 8-Path Modulation Matrix
  modMatrix: [
    { id: 1, source1: 'LFO1', source2: 'NONE', operator: 'NOP', depth: 45, invertLeft: false, invertRight: true, targetLeft: 'PW_ALL', targetRight: 'PW_ALL' },
    { id: 2, source1: 'ENV1', source2: 'NONE', operator: 'NOP', depth: 60, invertLeft: false, invertRight: false, targetLeft: 'CUTOFF', targetRight: 'CUTOFF' },
    { id: 3, source1: 'LFO2', source2: 'NONE', operator: 'NOP', depth: 15, invertLeft: false, invertRight: true, targetLeft: 'PITCH_ALL', targetRight: 'PITCH_ALL' },
    { id: 4, source1: 'WT1', source2: 'NONE', operator: 'NOP', depth: 30, invertLeft: false, invertRight: false, targetLeft: 'CUTOFF', targetRight: 'CUTOFF' },
    { id: 5, source1: 'NONE', source2: 'NONE', operator: 'NOP', depth: 0, invertLeft: false, invertRight: false, targetLeft: 'NONE', targetRight: 'NONE' },
    { id: 6, source1: 'NONE', source2: 'NONE', operator: 'NOP', depth: 0, invertLeft: false, invertRight: false, targetLeft: 'NONE', targetRight: 'NONE' },
    { id: 7, source1: 'NONE', source2: 'NONE', operator: 'NOP', depth: 0, invertLeft: false, invertRight: false, targetLeft: 'NONE', targetRight: 'NONE' },
    { id: 8, source1: 'NONE', source2: 'NONE', operator: 'NOP', depth: 0, invertLeft: false, invertRight: false, targetLeft: 'NONE', targetRight: 'NONE' }
  ],
  // 4 Wavetables
  wavetables: [
    { id: 1, stepCount: 16, speed: 64, loopMode: 'forward', steps: [0, 3, 7, 12, 15, 12, 7, 3, 0, 3, 7, 12, 15, 12, 7, 3] },
    { id: 2, stepCount: 8, speed: 32, loopMode: 'pingpong', steps: [0, 4, 7, 11, 14, 11, 7, 4, 0, 0, 0, 0, 0, 0, 0, 0] },
    { id: 3, stepCount: 16, speed: 127, loopMode: 'off', steps: Array(16).fill(0) },
    { id: 4, stepCount: 16, speed: 127, loopMode: 'off', steps: Array(16).fill(0) }
  ],
  arpEnabled: false,
  arpRate: '1/16',
  arpRange: 2
};

export const DEFAULT_BASSLINE_PATCH: BasslinePatch = {
  coreId: 'sid.core1',
  name: 'Core 1: 6581 Heavy Bassline (Pair 1)',
  engine: 'bassline',
  socketLeftModel: '6581',
  socketRightModel: '6581',
  stereoSpread: 25,
  syncStatus: 'synced',
  inst1: {
    waveform: 'saw',
    pulseWidth: 2048,
    cutoff: 1400,
    resonance: 9,
    envModDepth: 75,
    decay: 65,
    accentDepth: 80,
    glideRate: 25,
    octave: -1,
    steps: [
      { note: 0, octave: 0, gate: true, slide: false, accent: true },
      { note: 0, octave: 0, gate: true, slide: false, accent: false },
      { note: 3, octave: 0, gate: true, slide: true, accent: false },
      { note: 5, octave: 0, gate: true, slide: false, accent: false },
      { note: 7, octave: 0, gate: true, slide: false, accent: true },
      { note: 7, octave: 0, gate: true, slide: false, accent: false },
      { note: 10, octave: 0, gate: true, slide: true, accent: false },
      { note: 12, octave: 1, gate: true, slide: false, accent: true },
      { note: 0, octave: 0, gate: true, slide: false, accent: true },
      { note: 0, octave: 0, gate: false, slide: false, accent: false },
      { note: 3, octave: 0, gate: true, slide: false, accent: false },
      { note: 5, octave: 0, gate: true, slide: true, accent: false },
      { note: 7, octave: 0, gate: true, slide: false, accent: true },
      { note: 10, octave: 0, gate: true, slide: false, accent: false },
      { note: 12, octave: 1, gate: true, slide: true, accent: false },
      { note: 0, octave: 1, gate: true, slide: false, accent: true }
    ]
  },
  inst2: {
    waveform: 'pulse',
    pulseWidth: 1024,
    cutoff: 1200,
    resonance: 6,
    envModDepth: 60,
    decay: 50,
    accentDepth: 70,
    glideRate: 20,
    octave: -1,
    steps: Array.from({ length: 16 }, (_, i) => ({
      note: (i * 2) % 12,
      octave: -1,
      gate: i % 2 === 0,
      slide: i === 7,
      accent: i === 0 || i === 8
    }))
  },
  sequencerMode: 'external_midi',
  clockSync: 'midi_clock',
  swing: 15
};

export const DEFAULT_MULTI_PATCH: MultiPatch = {
  coreId: 'sid.core3',
  name: 'Core 3: Mixed 6581/8580 Poly Brass',
  engine: 'multi',
  socketLeftModel: '6581',
  socketRightModel: '8580',
  stereoSpread: 50,
  syncStatus: 'synced',
  instruments: [
    { id: 1, name: 'Brass Lead', midiChannel: 8, keyRangeLow: 36, keyRangeHigh: 96, polyphony: 'poly', voiceAllocation: 2, waveform: 'saw', octave: 0, pulseWidth: 2048, env: { attack: 2, decay: 6, sustain: 10, release: 5 }, lfoRate: 35, lfoDepth: 15, filterRouting: true },
    { id: 2, name: 'Chime Poly', midiChannel: 8, keyRangeLow: 48, keyRangeHigh: 108, polyphony: 'poly', voiceAllocation: 2, waveform: 'triangle', octave: 1, pulseWidth: 2048, env: { attack: 0, decay: 8, sustain: 2, release: 6 }, lfoRate: 50, lfoDepth: 25, filterRouting: false },
    { id: 3, name: 'Sub Octave', midiChannel: 8, keyRangeLow: 24, keyRangeHigh: 60, polyphony: 'mono', voiceAllocation: 1, waveform: 'pulse', octave: -1, pulseWidth: 3000, env: { attack: 1, decay: 4, sustain: 12, release: 4 }, lfoRate: 20, lfoDepth: 10, filterRouting: true },
    { id: 4, name: 'FX Noise', midiChannel: 8, keyRangeLow: 60, keyRangeHigh: 127, polyphony: 'mono', voiceAllocation: 1, waveform: 'noise', octave: 0, pulseWidth: 2048, env: { attack: 0, decay: 3, sustain: 0, release: 3 }, lfoRate: 80, lfoDepth: 40, filterRouting: true }
  ],
  filter: {
    cutoff: 1600,
    resonance: 6,
    lowPass: true,
    bandPass: false,
    highPass: false,
    voice1Filter: true,
    voice2Filter: true,
    voice3Filter: true,
    mode303: false,
    externalIn: false
  }
};

export const DEFAULT_DRUM_PATCH: DrumPatch = {
  coreId: 'sid.core4',
  name: 'Core 4: 8580 Analog & Noise Drum Rig',
  engine: 'drum',
  socketLeftModel: '8580',
  socketRightModel: '8580',
  stereoSpread: 80,
  syncStatus: 'synced',
  drums: [
    { id: 1, name: 'SID Bass Drum 1', triggerNote: 36, voiceType: 'analog_kick', decay: 55, pitch: 45, sweepRate: 85, filterCutoff: 600, filterResonance: 3, accent: 100, steps: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false] },
    { id: 2, name: 'SID Snare Drum', triggerNote: 38, voiceType: 'analog_snare', decay: 45, pitch: 65, sweepRate: 40, filterCutoff: 1400, filterResonance: 8, accent: 90, steps: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false] },
    { id: 3, name: 'SID Closed Hi-Hat', triggerNote: 42, voiceType: 'noise_hat', decay: 20, pitch: 90, sweepRate: 10, filterCutoff: 1800, filterResonance: 2, accent: 70, steps: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true] },
    { id: 4, name: 'SID Open Hi-Hat', triggerNote: 46, voiceType: 'noise_hat', decay: 60, pitch: 90, sweepRate: 10, filterCutoff: 1800, filterResonance: 2, accent: 85, steps: [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false] },
    { id: 5, name: 'SID Low Tom', triggerNote: 41, voiceType: 'tom', decay: 50, pitch: 48, sweepRate: 60, filterCutoff: 800, filterResonance: 4, accent: 80, steps: Array(16).fill(false) },
    { id: 6, name: 'SID High Tom', triggerNote: 48, voiceType: 'tom', decay: 45, pitch: 60, sweepRate: 60, filterCutoff: 1100, filterResonance: 4, accent: 80, steps: Array(16).fill(false) },
    { id: 7, name: 'SID Laser Zap', triggerNote: 49, voiceType: 'zap', decay: 35, pitch: 95, sweepRate: 110, filterCutoff: 1600, filterResonance: 12, accent: 95, steps: Array(16).fill(false) },
    { id: 8, name: 'SID Metallic Crash', triggerNote: 51, voiceType: 'metallic', decay: 80, pitch: 85, sweepRate: 20, filterCutoff: 1500, filterResonance: 10, accent: 100, steps: [true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false] }
  ],
  clockMultiplier: '1x'
};

export const DEFAULT_SID_PATCHES: [SidCorePatch, SidCorePatch, SidCorePatch, SidCorePatch] = [
  DEFAULT_BASSLINE_PATCH,
  DEFAULT_LEAD_PATCH,
  DEFAULT_MULTI_PATCH,
  DEFAULT_DRUM_PATCH
];
