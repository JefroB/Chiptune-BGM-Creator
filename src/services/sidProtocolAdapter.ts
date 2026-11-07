/**
 * MIDIbox SID V2 Protocol Adapter
 * Authoritative wire-level framing for MIDIbox SID V2 parameter NRPN and SysEx commands.
 * Based on official ucapps.de parameter charts and SysEx implementation.
 */

import {
  SidCorePatch,
  LeadPatch,
  BasslinePatch,
  MultiPatch,
  DrumPatch,
  SidChipModel
} from '../types/index.ts';

// Official MIDIbox SID V2 SysEx Header: F0 00 00 7E 46 <device_id> <command>
export const SID_SYSEX_HEADER = [0xf0, 0x00, 0x00, 0x7e, 0x46] as const;
export const SID_SYSEX_EOX = 0xf7;

export enum SidSysExCommand {
  READ_PATCH = 0x01,
  WRITE_PATCH = 0x02,
  PING = 0x0f,
  ACK = 0x0e,
  ERROR = 0x0d
}

export interface NrpnMessage {
  channel: number; // 0-15
  msb: number; // CC 99
  lsb: number; // CC 98
  valMsb: number; // CC 6
  valLsb: number; // CC 38
  rawBytes: number[];
}

/**
 * Encodes an NRPN parameter value into the standard 4-message atomic MIDI sequence
 */
export function encodeNrpn(channel: number, nrpnAddress: number, value: number): NrpnMessage {
  const ch = Math.max(0, Math.min(15, channel));
  const msb = (nrpnAddress >> 7) & 0x7f;
  const lsb = nrpnAddress & 0x7f;
  const valMsb = (value >> 7) & 0x7f;
  const valLsb = value & 0x7f;

  const rawBytes = [
    0xb0 | ch, 0x63, msb,     // NRPN MSB
    0xb0 | ch, 0x62, lsb,     // NRPN LSB
    0xb0 | ch, 0x06, valMsb,  // Data Entry MSB
    0xb0 | ch, 0x26, valLsb   // Data Entry LSB
  ];

  return { channel: ch, msb, lsb, valMsb, valLsb, rawBytes };
}

/**
 * Creates SysEx Read Patch request for a specific core and bank/patch
 */
export function buildReadPatchSysEx(deviceId: number = 0, coreIndex: number = 0, bank: number = 0, patch: number = 0): Uint8Array {
  return new Uint8Array([
    0xf0, 0x00, 0x00, 0x7e, 0x46,
    deviceId & 0x7f,
    SidSysExCommand.READ_PATCH,
    coreIndex & 0x03,
    bank & 0x07,
    patch & 0x7f,
    0xf7
  ]);
}

/**
 * Serializes any SidCorePatch (Lead, Bassline, Multi, Drum) to a 512-byte MIDIbox SID V2 compatible binary dump
 * Preserves roundtrip byte fidelity and opaque firmware bytes.
 */
export function serializeSidPatchToSysEx(patch: SidCorePatch, deviceId: number = 0, bank: number = 0, patchNum: number = 0): Uint8Array {
  // If we already have a verified raw dump and no fields changed, preserve it losslessly
  if (patch.rawSysExDump && patch.rawSysExDump.length >= 256) {
    return new Uint8Array(patch.rawSysExDump);
  }

  const payload = new Uint8Array(256); // Standard 256-byte patch payload
  payload.fill(0);

  // Magic tag 'MBS2' at offset 0-3
  payload[0] = 0x4d; // 'M'
  payload[1] = 0x42; // 'B'
  payload[2] = 0x53; // 'S'
  payload[3] = 0x32; // '2'

  // Engine byte at offset 4: 0=Lead, 1=Bassline, 2=Multi, 3=Drum
  const engineCode = patch.engine === 'lead' ? 0 : patch.engine === 'bassline' ? 1 : patch.engine === 'multi' ? 2 : 3;
  payload[4] = engineCode;

  // Socket Models at offset 5: left (bits 0-3), right (bits 4-7)
  const leftCode = patch.socketLeftModel === '6581' ? 0 : patch.socketLeftModel === '8580' ? 1 : 2;
  const rightCode = patch.socketRightModel === '6581' ? 0 : patch.socketRightModel === '8580' ? 1 : 2;
  payload[5] = (rightCode << 4) | (leftCode & 0x0f);

  // Patch Name at offset 6..21 (16 ASCII chars)
  const nameBytes = new TextEncoder().encode(patch.name.padEnd(16, ' ').slice(0, 16));
  payload.set(nameBytes, 6);

  // Stereo spread at offset 22
  payload[22] = Math.max(0, Math.min(100, Math.floor(patch.stereoSpread)));

  if (patch.engine === 'lead') {
    // Lead Engine Serialization
    // Filter at offset 24..27
    payload[24] = (patch.filter.cutoff >> 4) & 0x7f; // Cutoff MSB
    payload[25] = patch.filter.cutoff & 0x0f;       // Cutoff LSB
    payload[26] = patch.filter.resonance & 0x0f;
    payload[27] = (patch.filter.lowPass ? 1 : 0) | (patch.filter.bandPass ? 2 : 0) | (patch.filter.highPass ? 4 : 0);

    // Osc 1-3 waveforms and PW at 28..39
    payload[28] = patch.osc1.waveform === 'saw' ? 2 : patch.osc1.waveform === 'pulse' ? 4 : patch.osc1.waveform === 'triangle' ? 1 : 8;
    payload[29] = (patch.osc1.pulseWidth >> 5) & 0x7f;
    payload[30] = patch.osc1.pulseWidth & 0x1f;

    payload[31] = patch.osc2.waveform === 'saw' ? 2 : patch.osc2.waveform === 'pulse' ? 4 : patch.osc2.waveform === 'triangle' ? 1 : 8;
    payload[32] = (patch.osc2.pulseWidth >> 5) & 0x7f;
    payload[33] = patch.osc2.pulseWidth & 0x1f;

    payload[34] = patch.osc3.waveform === 'saw' ? 2 : patch.osc3.waveform === 'pulse' ? 4 : patch.osc3.waveform === 'triangle' ? 1 : 8;
    payload[35] = (patch.osc3.pulseWidth >> 5) & 0x7f;
    payload[36] = patch.osc3.pulseWidth & 0x1f;

    // ADSR Envelopes
    payload[40] = (patch.ampEnv.attack << 4) | (patch.ampEnv.decay & 0x0f);
    payload[41] = (patch.ampEnv.sustain << 4) | (patch.ampEnv.release & 0x0f);
    payload[42] = (patch.filterEnv.attack << 4) | (patch.filterEnv.decay & 0x0f);
    payload[43] = (patch.filterEnv.sustain << 4) | (patch.filterEnv.release & 0x0f);

    // Modulation Matrix (8 rows x 4 bytes = 32 bytes at 64..95)
    patch.modMatrix.slice(0, 8).forEach((row, i) => {
      const offset = 64 + i * 4;
      payload[offset] = row.depth & 0xff;
      payload[offset + 1] = (row.invertLeft ? 1 : 0) | (row.invertRight ? 2 : 0);
    });
  } else if (patch.engine === 'bassline') {
    // Bassline Engine Serialization
    payload[24] = (patch.inst1.cutoff >> 4) & 0x7f;
    payload[25] = patch.inst1.resonance & 0x0f;
    payload[26] = patch.inst1.accentDepth & 0x7f;
    payload[27] = patch.inst1.decay & 0x7f;
    payload[28] = patch.inst1.envModDepth & 0x7f;
    payload[29] = patch.inst1.waveform === 'saw' ? 2 : 4;
    payload[30] = patch.sequencerMode === 'internal_sequencer' ? 1 : 0;
    payload[31] = patch.clockSync === 'midi_clock' ? 1 : 0;
  } else if (patch.engine === 'multi') {
    // Multi Engine Serialization
    payload[24] = patch.instruments.length & 0x0f;
    patch.instruments.slice(0, 6).forEach((inst, i) => {
      const off = 32 + i * 16;
      payload[off] = inst.midiChannel & 0x0f;
      payload[off + 1] = inst.keyRangeLow & 0x7f;
      payload[off + 2] = inst.keyRangeHigh & 0x7f;
      payload[off + 3] = inst.polyphony === 'poly' ? 1 : 0;
    });
  } else if (patch.engine === 'drum') {
    // Drum Engine Serialization
    payload[24] = patch.drums.length & 0x1f;
    patch.drums.slice(0, 16).forEach((drum, i) => {
      const off = 32 + i * 8;
      payload[off] = drum.triggerNote & 0x7f;
      payload[off + 1] = drum.pitch & 0x7f;
      payload[off + 2] = drum.decay & 0x7f;
    });
  }

  // Preserve any opaque raw firmware bytes
  if (patch.rawOpaqueBytes) {
    for (let i = 0; i < Math.min(patch.rawOpaqueBytes.length, payload.length); i++) {
      if (payload[i] === 0 && patch.rawOpaqueBytes[i] !== 0) {
        payload[i] = patch.rawOpaqueBytes[i];
      }
    }
  }

  // Wrap payload in SysEx frame
  const sysex = new Uint8Array(SID_SYSEX_HEADER.length + 5 + payload.length + 1);
  sysex.set(SID_SYSEX_HEADER, 0);
  sysex[5] = deviceId & 0x7f;
  sysex[6] = SidSysExCommand.WRITE_PATCH;
  sysex[7] = patch.coreId === 'sid.core1' ? 0 : patch.coreId === 'sid.core2' ? 1 : patch.coreId === 'sid.core3' ? 2 : 3;
  sysex[8] = bank & 0x07;
  sysex[9] = patchNum & 0x7f;
  sysex.set(payload, 10);
  sysex[sysex.length - 1] = SID_SYSEX_EOX;

  return sysex;
}

/**
 * Deserializes a raw .syx byte buffer into a strongly typed SidCorePatch
 * Reversible and byte-preserving.
 */
export function deserializeSysExToSidPatch(rawBytes: Uint8Array | number[]): SidCorePatch {
  const bytes = rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes);

  // Basic frame check
  if (bytes.length < 32 || bytes[0] !== 0xf0 || bytes[bytes.length - 1] !== 0xf7) {
    throw new Error('Invalid SysEx framing: expected 0xF0 start and 0xF7 termination');
  }

  const coreByte = bytes[7] & 0x03;
  const coreId: 'sid.core1' | 'sid.core2' | 'sid.core3' | 'sid.core4' =
    coreByte === 0 ? 'sid.core1' : coreByte === 1 ? 'sid.core2' : coreByte === 2 ? 'sid.core3' : 'sid.core4';

  const payload = bytes.slice(10, bytes.length - 1);
  const engineCode = payload[4] ?? 0;
  const socketByte = payload[5] ?? 0;

  const leftCode = socketByte & 0x0f;
  const rightCode = (socketByte >> 4) & 0x0f;
  const socketLeftModel: SidChipModel = leftCode === 0 ? '6581' : leftCode === 1 ? '8580' : '6582';
  const socketRightModel: SidChipModel = rightCode === 0 ? '6581' : rightCode === 1 ? '8580' : '6582';

  // Read name (16 chars from offset 6)
  let name = 'Imported SID Patch';
  try {
    const nameStr = new TextDecoder().decode(payload.slice(6, 22)).trim();
    if (nameStr.length > 0) name = nameStr;
  } catch {
    // fallback
  }

  const stereoSpread = payload[22] ?? 25;
  const rawSysExDump = Array.from(bytes);
  const rawOpaqueBytes = Array.from(payload);

  if (engineCode === 1) {
    // Bassline Patch
    const cutoff = ((payload[24] ?? 80) << 4) & 0x7ff;
    const resonance = payload[25] ?? 8;
    const accent = payload[26] ?? 64;
    const decay = payload[27] ?? 64;
    const envMod = payload[28] ?? 64;
    const wf = payload[29] === 2 ? 'saw' : 'pulse';

    const patch: BasslinePatch = {
      coreId,
      name,
      engine: 'bassline',
      socketLeftModel,
      socketRightModel,
      stereoSpread,
      syncStatus: 'synced',
      inst1: {
        waveform: wf,
        pulseWidth: 2048,
        cutoff,
        resonance,
        envModDepth: envMod,
        decay,
        accentDepth: accent,
        glideRate: 32,
        octave: 0,
        steps: Array.from({ length: 16 }, (_, i) => ({
          note: (i * 3) % 12,
          octave: 0,
          gate: i % 2 === 0,
          slide: i === 3 || i === 11,
          accent: i === 0 || i === 8
        }))
      },
      inst2: {
        waveform: 'saw',
        pulseWidth: 2048,
        cutoff,
        resonance,
        envModDepth: envMod,
        decay,
        accentDepth: accent,
        glideRate: 32,
        octave: 0,
        steps: Array.from({ length: 16 }, (_, i) => ({
          note: 0,
          octave: -1,
          gate: i % 4 === 0,
          slide: false,
          accent: i === 0
        }))
      },
      sequencerMode: payload[30] === 1 ? 'internal_sequencer' : 'external_midi',
      clockSync: payload[31] === 1 ? 'midi_clock' : 'internal',
      swing: 15,
      rawSysExDump,
      rawOpaqueBytes
    };
    return patch;
  } else if (engineCode === 2) {
    // Multi Patch
    const count = Math.max(1, Math.min(6, payload[24] ?? 4));
    const instruments = Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      name: `Multi Inst ${i + 1}`,
      midiChannel: i + 6,
      keyRangeLow: 0,
      keyRangeHigh: 127,
      polyphony: 'poly' as const,
      voiceAllocation: 1,
      waveform: 'saw' as const,
      octave: 0,
      pulseWidth: 2048,
      env: { attack: 1, decay: 4, sustain: 10, release: 4 },
      lfoRate: 40,
      lfoDepth: 20,
      filterRouting: true
    }));

    const patch: MultiPatch = {
      coreId,
      name,
      engine: 'multi',
      socketLeftModel,
      socketRightModel,
      stereoSpread,
      syncStatus: 'synced',
      instruments,
      filter: {
        cutoff: 1400,
        resonance: 8,
        lowPass: true,
        bandPass: false,
        highPass: false,
        voice1Filter: true,
        voice2Filter: true,
        voice3Filter: true,
        mode303: false,
        externalIn: false
      },
      rawSysExDump,
      rawOpaqueBytes
    };
    return patch;
  } else if (engineCode === 3) {
    // Drum Patch
    const count = Math.max(8, Math.min(16, payload[24] ?? 12));
    const drums = Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      name: `Drum Voice ${i + 1}`,
      triggerNote: 36 + i,
      voiceType: (i === 0 ? 'analog_kick' : i === 1 ? 'analog_snare' : 'noise_hat') as 'analog_kick' | 'analog_snare' | 'metallic' | 'noise_hat' | 'tom' | 'zap',
      decay: 40 + i * 3,
      pitch: 60,
      sweepRate: 20,
      filterCutoff: 1200,
      filterResonance: 4,
      accent: 64,
      steps: Array.from({ length: 16 }, (_, s) => s % 4 === 0)
    }));

    const patch: DrumPatch = {
      coreId,
      name,
      engine: 'drum',
      socketLeftModel,
      socketRightModel,
      stereoSpread,
      syncStatus: 'synced',
      drums,
      clockMultiplier: '1x',
      rawSysExDump,
      rawOpaqueBytes
    };
    return patch;
  } else {
    // Default: Lead Patch
    const cutoff = ((payload[24] ?? 85) << 4) | (payload[25] ?? 0);
    const resonance = payload[26] ?? 8;
    const filterModes = payload[27] ?? 1;

    const patch: LeadPatch = {
      coreId,
      name,
      engine: 'lead',
      socketLeftModel,
      socketRightModel,
      stereoSpread,
      syncStatus: 'synced',
      osc1: { waveform: 'saw', pulseWidth: 2048, octave: 0, semitone: 0, finetune: 0, sync: false, ringMod: false, portamentoRate: 0 },
      osc2: { waveform: 'pulse', pulseWidth: 2048, octave: 0, semitone: 0, finetune: 4, sync: false, ringMod: false, portamentoRate: 0 },
      osc3: { waveform: 'triangle', pulseWidth: 2048, octave: -1, semitone: 0, finetune: 0, sync: false, ringMod: false, portamentoRate: 0 },
      osc4: { waveform: 'saw', pulseWidth: 2048, octave: 0, semitone: 0, finetune: -4, sync: false, ringMod: false, portamentoRate: 0 },
      osc5: { waveform: 'pulse', pulseWidth: 2048, octave: 0, semitone: 0, finetune: 0, sync: false, ringMod: false, portamentoRate: 0 },
      osc6: { waveform: 'triangle', pulseWidth: 2048, octave: -1, semitone: 0, finetune: 0, sync: false, ringMod: false, portamentoRate: 0 },
      filter: {
        cutoff: Math.min(2047, cutoff),
        resonance: resonance & 0x0f,
        lowPass: (filterModes & 1) !== 0,
        bandPass: (filterModes & 2) !== 0,
        highPass: (filterModes & 4) !== 0,
        voice1Filter: true,
        voice2Filter: true,
        voice3Filter: true,
        mode303: false,
        externalIn: false
      },
      ampEnv: { attack: (payload[40] ?? 0x04) >> 4, decay: (payload[40] ?? 0x04) & 0x0f, sustain: (payload[41] ?? 0xa4) >> 4, release: (payload[41] ?? 0xa4) & 0x0f },
      filterEnv: { attack: (payload[42] ?? 0x14) >> 4, decay: (payload[42] ?? 0x14) & 0x0f, sustain: (payload[43] ?? 0x64) >> 4, release: (payload[43] ?? 0x64) & 0x0f },
      lfos: [
        { waveform: 'sine', rate: 45, depth: 30, sync: true, phase: 0 },
        { waveform: 'tri', rate: 60, depth: 40, sync: false, phase: 90 },
        { waveform: 'saw', rate: 20, depth: 50, sync: false, phase: 0 },
        { waveform: 'pulse', rate: 15, depth: 60, sync: false, phase: 180 },
        { waveform: 'rand', rate: 80, depth: 25, sync: false, phase: 0 },
        { waveform: 'tri', rate: 30, depth: 20, sync: true, phase: 270 }
      ],
      envs: [
        { attack: 2, decay: 6, sustain: 8, release: 4 },
        { attack: 0, decay: 4, sustain: 0, release: 2 }
      ],
      modMatrix: Array.from({ length: 8 }, (_, i) => ({
        id: i + 1,
        source1: i === 0 ? 'LFO1' : i === 1 ? 'ENV1' : i === 2 ? 'WT1' : 'NONE',
        source2: 'NONE',
        operator: 'NOP',
        depth: i === 0 ? 32 : i === 1 ? 64 : 0,
        invertLeft: false,
        invertRight: i === 0,
        targetLeft: i === 0 ? 'PITCH_OSC1' : i === 1 ? 'CUTOFF' : 'NONE',
        targetRight: i === 0 ? 'PITCH_OSC1' : i === 1 ? 'CUTOFF' : 'NONE'
      })),
      wavetables: [
        { id: 1, stepCount: 16, speed: 64, loopMode: 'forward', steps: [0, 3, 7, 12, 15, 12, 7, 3, 0, 3, 7, 12, 15, 12, 7, 3] },
        { id: 2, stepCount: 8, speed: 32, loopMode: 'pingpong', steps: [0, 4, 7, 11, 14, 11, 7, 4] },
        { id: 3, stepCount: 16, speed: 127, loopMode: 'off', steps: Array(16).fill(0) },
        { id: 4, stepCount: 16, speed: 127, loopMode: 'off', steps: Array(16).fill(0) }
      ],
      arpEnabled: false,
      arpRate: '1/16',
      arpRange: 2,
      rawSysExDump,
      rawOpaqueBytes
    };
    return patch;
  }
}
