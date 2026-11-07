/**
 * MIDIbox SID V2 Protocol Adapter
 * Authoritative wire-level framing for MIDIbox SID V2 parameter NRPN and SysEx commands.
 * Based on official ucapps.de parameter charts and SysEx implementation.
 *
 * Implements 512-byte patch serialization/deserialization with lossless unknown-byte preservation,
 * strict hardware write-guard locking until physical verification,
 * and atomic 4-message NRPN framing.
 */

import {
  SidCorePatch,
  LeadPatch,
  BasslinePatch,
  MultiPatch,
  DrumPatch,
  SidChipModel,
  MultiInstrument,
  DrumInstrument
} from '../types/index.ts';

// Official MIDIbox SID V2 SysEx Header: F0 00 00 7E 46 <device_id> <command>
export const SID_SYSEX_HEADER = [0xf0, 0x00, 0x00, 0x7e, 0x46] as const;
export const SID_SYSEX_EOX = 0xf7;

export enum SidSysExCommand {
  READ_PATCH = 0x01,
  WRITE_PATCH = 0x02,
  READ_ENSEMBLE = 0x03,
  WRITE_ENSEMBLE = 0x04,
  PAR_READ_WRITE = 0x05,
  ACK = 0x0e,
  ERROR = 0x0d,
  PING = 0x0f
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
 * Frame order strictly enforced:
 *   1. CC 99 (0x63): NRPN MSB
 *   2. CC 98 (0x62): NRPN LSB
 *   3. CC 06 (0x06): Data Entry MSB (bits 13..7)
 *   4. CC 38 (0x26): Data Entry LSB (bits 6..0)
 */
export function encodeNrpn(channel: number, nrpnAddress: number, value: number): NrpnMessage {
  const ch = Math.max(0, Math.min(15, channel));
  const msb = (nrpnAddress >> 7) & 0x7f;
  const lsb = nrpnAddress & 0x7f;
  const clampedVal = Math.max(0, Math.min(16383, Math.round(value)));
  const valMsb = (clampedVal >> 7) & 0x7f;
  const valLsb = clampedVal & 0x7f;

  const rawBytes = [
    0xb0 | ch, 0x63, msb,     // 1. NRPN MSB
    0xb0 | ch, 0x62, lsb,     // 2. NRPN LSB
    0xb0 | ch, 0x06, valMsb,  // 3. Data Entry MSB
    0xb0 | ch, 0x26, valLsb   // 4. Data Entry LSB
  ];

  return { channel: ch, msb, lsb, valMsb, valLsb, rawBytes };
}

/**
 * Creates SysEx Read Patch request for a specific core and bank/patch
 * Format: F0 00 00 7E 46 <device_id> 01 <core> <bank> <patch> F7
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
 * Hardware write safety check: prevents unverified binary overwrites to physical BankSticks.
 */
export function checkHardwareWritePermission(patch: SidCorePatch, isPhysicalConnectionVerified: boolean): { allowed: boolean; reason: string } {
  if (!isPhysicalConnectionVerified) {
    return {
      allowed: false,
      reason: 'DIRECT_WRITE_GUARD: Hardware SysEx writes to physical BankStick are locked. Connection to physical MIDIbox SID V2 (MBSID V2.044+) must be verified first.'
    };
  }
  return { allowed: true, reason: 'VERIFIED' };
}

/**
 * Serializes any SidCorePatch (Lead, Bassline, Multi, Drum) to a 512-byte MIDIbox SID V2 patch binary
 * Losslessly preserves all unknown / firmware-specific bytes from existing dumps while applying user edits.
 */
export function serializeSidPatchToSysEx(patch: SidCorePatch, deviceId: number = 0, bank: number = 0, patchNum: number = 0): Uint8Array {
  // Start with existing opaque firmware bytes if available (preserving undocumented flags, wavetables, or custom extensions)
  const payload = new Uint8Array(512);
  if (patch.rawOpaqueBytes && patch.rawOpaqueBytes.length > 0) {
    for (let i = 0; i < Math.min(payload.length, patch.rawOpaqueBytes.length); i++) {
      payload[i] = patch.rawOpaqueBytes[i];
    }
  }

  // 1. Magic tag 'MBS2' at 0x000..0x003
  payload[0] = 0x4d; // 'M'
  payload[1] = 0x42; // 'B'
  payload[2] = 0x53; // 'S'
  payload[3] = 0x32; // '2'

  // 2. Patch Name at 0x004..0x013 (16 ASCII chars)
  const nameBytes = new TextEncoder().encode(patch.name.padEnd(16, ' ').slice(0, 16));
  for (let i = 0; i < 16; i++) {
    payload[4 + i] = nameBytes[i] || 0x20;
  }

  // 3. Engine byte at 0x014: 0=Lead, 1=Bassline, 2=Multi, 3=Drum
  const engineCode = patch.engine === 'lead' ? 0 : patch.engine === 'bassline' ? 1 : patch.engine === 'multi' ? 2 : 3;
  payload[20] = engineCode;

  // 4. Socket Models at 0x015: left (bits 0-3), right (bits 4-7)
  const leftCode = patch.socketLeftModel === '6581' ? 0 : patch.socketLeftModel === '8580' ? 1 : 2;
  const rightCode = patch.socketRightModel === '6581' ? 0 : patch.socketRightModel === '8580' ? 1 : 2;
  payload[21] = (rightCode << 4) | (leftCode & 0x0f);

  // 5. Stereo spread at 0x016
  payload[22] = Math.max(0, Math.min(100, Math.floor(patch.stereoSpread)));

  // 6. Engine Specific Parameter Offsets
  if (patch.engine === 'lead') {
    // Oscillators 1-6 (Left 1-3, Right 4-6) at 0x020..0x03F
    const oscs = [patch.osc1, patch.osc2, patch.osc3, patch.osc4, patch.osc5, patch.osc6];
    oscs.forEach((osc, i) => {
      const base = 32 + i * 5;
      payload[base] = osc.waveform === 'saw' ? 2 : osc.waveform === 'pulse' ? 4 : osc.waveform === 'triangle' ? 1 : 8;
      payload[base + 1] = (osc.pulseWidth >> 5) & 0x7f; // 12-bit PW MSB
      payload[base + 2] = osc.pulseWidth & 0x1f;        // 12-bit PW LSB
      payload[base + 3] = ((osc.octave + 2) << 4) | (osc.semitone & 0x0f);
      payload[base + 4] = ((osc.finetune + 64) & 0x7f) | (osc.sync ? 0x80 : 0);
    });

    // Filter at 0x040..0x047
    payload[64] = (patch.filter.cutoff >> 4) & 0x7f;
    payload[65] = patch.filter.cutoff & 0x0f;
    payload[66] = patch.filter.resonance & 0x0f;
    payload[67] = (patch.filter.lowPass ? 1 : 0) | (patch.filter.bandPass ? 2 : 0) | (patch.filter.highPass ? 4 : 0);

    // Envelopes at 0x060..0x067
    payload[96] = (patch.ampEnv.attack << 4) | (patch.ampEnv.decay & 0x0f);
    payload[97] = (patch.ampEnv.sustain << 4) | (patch.ampEnv.release & 0x0f);
    payload[98] = (patch.filterEnv.attack << 4) | (patch.filterEnv.decay & 0x0f);
    payload[99] = (patch.filterEnv.sustain << 4) | (patch.filterEnv.release & 0x0f);

    // 6 LFOs at 0x080..0x0BF (6 x 6 bytes)
    patch.lfos.forEach((lfo, i) => {
      const base = 128 + i * 6;
      payload[base] = lfo.rate & 0x7f;
      payload[base + 1] = lfo.depth & 0x7f;
      payload[base + 2] = lfo.waveform === 'sine' ? 0 : lfo.waveform === 'tri' ? 1 : lfo.waveform === 'saw' ? 2 : lfo.waveform === 'pulse' ? 3 : 4;
      payload[base + 3] = lfo.sync ? 1 : 0;
      payload[base + 4] = (lfo.phase >> 2) & 0x7f;
    });

    // 8 Modulation Matrix Rows at 0x0C0..0x13F (8 x 8 bytes)
    patch.modMatrix.slice(0, 8).forEach((row, i) => {
      const base = 192 + i * 8;
      payload[base] = (row.depth + 128) & 0xff;
      payload[base + 1] = (row.invertLeft ? 1 : 0) | (row.invertRight ? 2 : 0);
      const src1Code =
        row.source1 === 'LFO1' ? 1 :
        row.source1 === 'LFO2' ? 2 :
        row.source1 === 'LFO3' ? 3 :
        row.source1 === 'LFO4' ? 4 :
        row.source1 === 'LFO5' ? 5 :
        row.source1 === 'LFO6' ? 6 :
        row.source1 === 'ENV1' ? 7 :
        row.source1 === 'ENV2' ? 8 :
        row.source1 === 'WT1' ? 9 :
        row.source1 === 'WT2' ? 10 :
        row.source1 === 'VEL' ? 11 :
        row.source1 === 'MOD' ? 12 :
        row.source1 === 'PB' ? 13 : 0;
      payload[base + 2] = src1Code;
      const opCode = row.operator === 'NOP' ? 0 : row.operator === 'ADD' ? 1 : row.operator === 'SUB' ? 2 : 3;
      payload[base + 3] = opCode;
      const tgtCode =
        row.targetLeft === 'PITCH_ALL' ? 1 :
        row.targetLeft === 'CUTOFF' ? 2 :
        row.targetLeft === 'PW_ALL' ? 3 :
        row.targetLeft === 'RESONANCE' ? 4 :
        row.targetLeft === 'PAN' ? 5 :
        row.targetLeft === 'VOLUME' ? 6 :
        row.targetLeft === 'PITCH_OSC1' ? 7 : 0;
      payload[base + 4] = tgtCode;
      const tgtRightCode =
        row.targetRight === 'PITCH_ALL' ? 1 :
        row.targetRight === 'CUTOFF' ? 2 :
        row.targetRight === 'PW_ALL' ? 3 :
        row.targetRight === 'RESONANCE' ? 4 :
        row.targetRight === 'PAN' ? 5 :
        row.targetRight === 'VOLUME' ? 6 :
        row.targetRight === 'PITCH_OSC1' ? 7 : 0;
      payload[base + 5] = tgtRightCode;
    });

    // 4 Wavetables at 0x140..0x1BF (4 x 32 bytes)
    patch.wavetables.forEach((wt, i) => {
      const base = 320 + i * 32;
      payload[base] = wt.stepCount & 0x1f;
      payload[base + 1] = wt.speed & 0x7f;
      payload[base + 2] = wt.loopMode === 'forward' ? 1 : wt.loopMode === 'pingpong' ? 2 : 0;
      for (let s = 0; s < 16; s++) {
        payload[base + 4 + s] = (wt.steps[s] || 0) & 0x7f;
      }
    });

  } else if (patch.engine === 'bassline') {
    // Bassline 1 at 0x020..0x03F
    payload[32] = (patch.inst1.cutoff >> 4) & 0x7f;
    payload[33] = patch.inst1.resonance & 0x0f;
    payload[34] = patch.inst1.accentDepth & 0x7f;
    payload[35] = patch.inst1.decay & 0x7f;
    payload[36] = patch.inst1.envModDepth & 0x7f;
    payload[37] = patch.inst1.glideRate & 0x7f;
    payload[38] = patch.inst1.waveform === 'saw' ? 2 : 4;
    payload[39] = (patch.inst1.octave + 2) & 0x07;

    // Bassline 2 at 0x040..0x05F
    payload[64] = (patch.inst2.cutoff >> 4) & 0x7f;
    payload[65] = patch.inst2.resonance & 0x0f;
    payload[66] = patch.inst2.accentDepth & 0x7f;
    payload[67] = patch.inst2.decay & 0x7f;
    payload[68] = patch.inst2.envModDepth & 0x7f;
    payload[69] = patch.inst2.glideRate & 0x7f;
    payload[70] = patch.inst2.waveform === 'saw' ? 2 : 4;
    payload[71] = (patch.inst2.octave + 2) & 0x07;

    // Global Sequencer Config at 0x060..0x06F
    payload[96] = patch.sequencerMode === 'internal_sequencer' ? 1 : 0;
    payload[97] = patch.clockSync === 'midi_clock' ? 1 : 0;
    payload[98] = patch.swing & 0x7f;

    // 16-Step Pattern Sequencer 1 at 0x080..0x0BF
    patch.inst1.steps.slice(0, 16).forEach((st, s) => {
      const base = 128 + s * 4;
      payload[base] = st.note & 0x0f;
      payload[base + 1] = (st.octave + 2) & 0x07;
      payload[base + 2] = (st.gate ? 1 : 0) | (st.slide ? 2 : 0) | (st.accent ? 4 : 0);
    });

    // 16-Step Pattern Sequencer 2 at 0x0C0..0x0FF
    patch.inst2.steps.slice(0, 16).forEach((st, s) => {
      const base = 192 + s * 4;
      payload[base] = st.note & 0x0f;
      payload[base + 1] = (st.octave + 2) & 0x07;
      payload[base + 2] = (st.gate ? 1 : 0) | (st.slide ? 2 : 0) | (st.accent ? 4 : 0);
    });

  } else if (patch.engine === 'multi') {
    // 6 Multi Instruments at 0x020..0x0DF (6 x 32 bytes)
    payload[31] = patch.instruments.length & 0x07;
    patch.instruments.slice(0, 6).forEach((inst, i) => {
      const base = 32 + i * 32;
      payload[base] = inst.midiChannel & 0x0f;
      payload[base + 1] = inst.keyRangeLow & 0x7f;
      payload[base + 2] = inst.keyRangeHigh & 0x7f;
      payload[base + 3] = inst.polyphony === 'poly' ? 1 : 0;
      payload[base + 4] = inst.voiceAllocation & 0x07;
      payload[base + 5] = inst.waveform === 'saw' ? 2 : inst.waveform === 'pulse' ? 4 : inst.waveform === 'triangle' ? 1 : 8;
      payload[base + 6] = (inst.octave + 2) & 0x07;
      payload[base + 7] = (inst.pulseWidth >> 5) & 0x7f;
      payload[base + 8] = inst.filterRouting ? 1 : 0;
      payload[base + 9] = inst.lfoRate & 0x7f;
      payload[base + 10] = inst.lfoDepth & 0x7f;
      // Store instrument name at base + 11..base + 26 (16 bytes ASCII)
      const instNameBytes = new TextEncoder().encode(inst.name.padEnd(16, ' ').slice(0, 16));
      for (let n = 0; n < 16; n++) {
        payload[base + 11 + n] = instNameBytes[n] || 0x20;
      }
    });

    // Multi Filter at 0x0E0..0x0E7
    payload[224] = (patch.filter.cutoff >> 4) & 0x7f;
    payload[225] = patch.filter.resonance & 0x0f;
    payload[226] = (patch.filter.lowPass ? 1 : 0) | (patch.filter.bandPass ? 2 : 0) | (patch.filter.highPass ? 4 : 0);

  } else if (patch.engine === 'drum') {
    // 16 Drum Voices at 0x020..0x1BF (16 x 24 bytes)
    payload[31] = patch.drums.length & 0x1f;
    payload[30] = patch.clockMultiplier === '2x' ? 2 : patch.clockMultiplier === '0.5x' ? 0 : 1;
    patch.drums.slice(0, 16).forEach((drum, i) => {
      const base = 32 + i * 24;
      payload[base] = drum.triggerNote & 0x7f;
      payload[base + 1] = drum.pitch & 0x7f;
      payload[base + 2] = drum.decay & 0x7f;
      payload[base + 3] = drum.sweepRate & 0x7f;
      payload[base + 4] = (drum.filterCutoff >> 4) & 0x7f;
      payload[base + 5] = drum.filterResonance & 0x0f;
      payload[base + 6] = drum.accent & 0x7f;
      const voiceTypeCode = drum.voiceType === 'analog_kick' ? 0 : drum.voiceType === 'analog_snare' ? 1 : drum.voiceType === 'noise_hat' ? 2 : drum.voiceType === 'tom' ? 3 : drum.voiceType === 'zap' ? 4 : 5;
      payload[base + 7] = voiceTypeCode;
      // 16-step sequence bitmask (2 bytes: bits 0-7, bits 8-15)
      let stepMask = 0;
      drum.steps.slice(0, 16).forEach((step, s) => {
        if (step) stepMask |= (1 << s);
      });
      payload[base + 8] = stepMask & 0xff;
      payload[base + 9] = (stepMask >> 8) & 0xff;
    });
  }

  // Wrap payload in official SysEx frame: F0 00 00 7E 46 <dev> 02 <core> <bank> <patch> [512 bytes] F7
  const coreByte = patch.coreId === 'sid.core1' ? 0 : patch.coreId === 'sid.core2' ? 1 : patch.coreId === 'sid.core3' ? 2 : 3;
  const sysex = new Uint8Array(SID_SYSEX_HEADER.length + 5 + payload.length + 1);
  sysex.set(SID_SYSEX_HEADER, 0);
  sysex[5] = deviceId & 0x7f;
  sysex[6] = SidSysExCommand.WRITE_PATCH;
  sysex[7] = coreByte;
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

  if (bytes.length < 32 || bytes[0] !== 0xf0 || bytes[bytes.length - 1] !== 0xf7) {
    throw new Error('Invalid SysEx framing: expected 0xF0 start and 0xF7 termination');
  }

  const coreByte = bytes[7] & 0x03;
  const coreId: 'sid.core1' | 'sid.core2' | 'sid.core3' | 'sid.core4' =
    coreByte === 0 ? 'sid.core1' : coreByte === 1 ? 'sid.core2' : coreByte === 2 ? 'sid.core3' : 'sid.core4';

  const payload = bytes.slice(10, bytes.length - 1);
  const engineCode = payload[20] ?? 0;
  const socketByte = payload[21] ?? 0;

  const leftCode = socketByte & 0x0f;
  const rightCode = (socketByte >> 4) & 0x0f;
  const socketLeftModel: SidChipModel = leftCode === 0 ? '6581' : leftCode === 1 ? '8580' : '6582';
  const socketRightModel: SidChipModel = rightCode === 0 ? '6581' : rightCode === 1 ? '8580' : '6582';

  // Read name (16 chars from offset 4)
  let name = 'Imported SID Patch';
  try {
    const nameStr = new TextDecoder().decode(payload.slice(4, 20)).trim();
    if (nameStr.length > 0) name = nameStr;
  } catch {
    // fallback
  }

  const stereoSpread = payload[22] ?? 50;
  const rawSysExDump = Array.from(bytes);
  const rawOpaqueBytes = Array.from(payload);

  if (engineCode === 1) {
    // Bassline Patch
    const cutoff1 = ((payload[32] ?? 80) << 4) & 0x7ff;
    const res1 = payload[33] ?? 8;
    const acc1 = payload[34] ?? 64;
    const dec1 = payload[35] ?? 64;
    const envMod1 = payload[36] ?? 64;
    const glide1 = payload[37] ?? 25;
    const wf1 = payload[38] === 2 ? 'saw' : 'pulse';
    const oct1 = (payload[39] ?? 2) - 2;

    const cutoff2 = ((payload[64] ?? 70) << 4) & 0x7ff;
    const res2 = payload[65] ?? 6;
    const acc2 = payload[66] ?? 64;
    const dec2 = payload[67] ?? 64;
    const envMod2 = payload[68] ?? 64;
    const glide2 = payload[69] ?? 20;
    const wf2 = payload[70] === 2 ? 'saw' : 'pulse';
    const oct2 = (payload[71] ?? 2) - 2;

    // Reconstruct steps
    const steps1 = Array.from({ length: 16 }, (_, s) => {
      const base = 128 + s * 4;
      const flags = payload[base + 2] ?? 0;
      return {
        note: payload[base] ?? 0,
        octave: (payload[base + 1] ?? 2) - 2,
        gate: (flags & 1) !== 0,
        slide: (flags & 2) !== 0,
        accent: (flags & 4) !== 0
      };
    });

    const steps2 = Array.from({ length: 16 }, (_, s) => {
      const base = 192 + s * 4;
      const flags = payload[base + 2] ?? 0;
      return {
        note: payload[base] ?? 0,
        octave: (payload[base + 1] ?? 2) - 2,
        gate: (flags & 1) !== 0,
        slide: (flags & 2) !== 0,
        accent: (flags & 4) !== 0
      };
    });

    const patch: BasslinePatch = {
      coreId,
      name,
      engine: 'bassline',
      socketLeftModel,
      socketRightModel,
      stereoSpread,
      syncStatus: 'synced',
      inst1: {
        waveform: wf1,
        pulseWidth: 2048,
        cutoff: cutoff1,
        resonance: res1,
        envModDepth: envMod1,
        decay: dec1,
        accentDepth: acc1,
        glideRate: glide1,
        octave: oct1,
        steps: steps1
      },
      inst2: {
        waveform: wf2,
        pulseWidth: 2048,
        cutoff: cutoff2,
        resonance: res2,
        envModDepth: envMod2,
        decay: dec2,
        accentDepth: acc2,
        glideRate: glide2,
        octave: oct2,
        steps: steps2
      },
      sequencerMode: payload[96] === 1 ? 'internal_sequencer' : 'external_midi',
      clockSync: payload[97] === 1 ? 'midi_clock' : 'internal',
      swing: payload[98] ?? 0,
      rawSysExDump,
      rawOpaqueBytes
    };
    return patch;

  } else if (engineCode === 2) {
    // Multi Engine Patch
    const instCount = Math.max(1, Math.min(6, payload[31] || 4));
    const instruments: MultiInstrument[] = [];
    for (let i = 0; i < instCount; i++) {
      const base = 32 + i * 32;
      const wfCode = payload[base + 5] ?? 2;
      const wf: 'saw' | 'pulse' | 'triangle' | 'noise' = wfCode === 2 ? 'saw' : wfCode === 4 ? 'pulse' : wfCode === 1 ? 'triangle' : 'noise';
      
      let instName = `Multi Inst ${i + 1}`;
      try {
        const decoded = new TextDecoder().decode(payload.slice(base + 11, base + 27)).trim();
        if (decoded.length > 0) instName = decoded;
      } catch {
        // fallback
      }

      instruments.push({
        id: i + 1,
        name: instName,
        midiChannel: payload[base] || (i + 1),
        keyRangeLow: payload[base + 1] ?? 24,
        keyRangeHigh: payload[base + 2] ?? 108,
        polyphony: payload[base + 3] === 1 ? 'poly' : 'mono',
        voiceAllocation: payload[base + 4] || 1,
        waveform: wf,
        octave: (payload[base + 6] ?? 2) - 2,
        pulseWidth: (payload[base + 7] ?? 64) << 5,
        env: { attack: 2, decay: 6, sustain: 10, release: 5 },
        lfoRate: payload[base + 9] ?? 30,
        lfoDepth: payload[base + 10] ?? 20,
        filterRouting: payload[base + 8] === 1
      });
    }

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
        cutoff: ((payload[224] ?? 100) << 4) & 0x7ff,
        resonance: payload[225] ?? 6,
        lowPass: ((payload[226] ?? 1) & 1) !== 0,
        bandPass: ((payload[226] ?? 1) & 2) !== 0,
        highPass: ((payload[226] ?? 1) & 4) !== 0,
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
    // Drum Engine Patch
    const drumCount = Math.max(8, Math.min(16, payload[31] || 16));
    const drums: DrumInstrument[] = [];
    for (let i = 0; i < drumCount; i++) {
      const base = 32 + i * 24;
      const typeCode = payload[base + 7] ?? 0;
      const voiceType: DrumInstrument['voiceType'] =
        typeCode === 0 ? 'analog_kick' :
        typeCode === 1 ? 'analog_snare' :
        typeCode === 2 ? 'noise_hat' :
        typeCode === 3 ? 'tom' :
        typeCode === 4 ? 'zap' : 'metallic';

      const stepMask = (payload[base + 8] ?? 0) | ((payload[base + 9] ?? 0) << 8);
      const steps = Array.from({ length: 16 }, (_, s) => ((stepMask >> s) & 1) !== 0);

      drums.push({
        id: i + 1,
        name: `Drum Voice ${i + 1}`,
        triggerNote: payload[base] || (36 + i),
        voiceType,
        decay: payload[base + 2] ?? 60,
        pitch: payload[base + 1] ?? 60,
        sweepRate: payload[base + 3] ?? 20,
        filterCutoff: ((payload[base + 4] ?? 80) << 4) & 0x7ff,
        filterResonance: payload[base + 5] ?? 4,
        accent: payload[base + 6] ?? 64,
        steps
      });
    }

    const patch: DrumPatch = {
      coreId,
      name,
      engine: 'drum',
      socketLeftModel,
      socketRightModel,
      stereoSpread,
      syncStatus: 'synced',
      drums,
      clockMultiplier: payload[30] === 2 ? '2x' : payload[30] === 0 ? '0.5x' : '1x',
      rawSysExDump,
      rawOpaqueBytes
    };
    return patch;

  } else {
    // Lead Engine Patch (default)
    const cutoff = ((payload[64] ?? 85) << 4) | (payload[65] ?? 0);
    const resonance = payload[66] ?? 8;
    const filterModes = payload[67] ?? 1;

    const readOsc = (idx: number) => {
      const base = 32 + idx * 5;
      const wfCode = payload[base] ?? 2;
      const wf: 'saw' | 'pulse' | 'triangle' | 'noise' = wfCode === 2 ? 'saw' : wfCode === 4 ? 'pulse' : wfCode === 1 ? 'triangle' : 'noise';
      const pw = ((payload[base + 1] ?? 64) << 5) | (payload[base + 2] ?? 0);
      const oct = ((payload[base + 3] ?? 0x20) >> 4) - 2;
      const semi = (payload[base + 3] ?? 0) & 0x0f;
      const fine = ((payload[base + 4] ?? 64) & 0x7f) - 64;
      const sync = ((payload[base + 4] ?? 0) & 0x80) !== 0;
      return { waveform: wf, pulseWidth: pw, octave: oct, semitone: semi, finetune: fine, sync, ringMod: false, portamentoRate: 0 };
    };

    const lfos: LeadPatch['lfos'] = [0, 1, 2, 3, 4, 5].map((i) => {
      const base = 128 + i * 6;
      const wfCode = payload[base + 2] ?? 0;
      const wf: 'sine' | 'tri' | 'saw' | 'pulse' | 'rand' = wfCode === 0 ? 'sine' : wfCode === 1 ? 'tri' : wfCode === 2 ? 'saw' : wfCode === 3 ? 'pulse' : 'rand';
      return {
        waveform: wf,
        rate: payload[base] ?? 40,
        depth: payload[base + 1] ?? 50,
        sync: (payload[base + 3] ?? 0) === 1,
        phase: (payload[base + 4] ?? 0) << 2
      };
    }) as LeadPatch['lfos'];

    const modMatrix = Array.from({ length: 8 }, (_, i) => {
      const base = 192 + i * 8;
      const depth = (payload[base] ?? 128) - 128;
      const invFlags = payload[base + 1] ?? 0;
      const src1Code = payload[base + 2] ?? 0;
      const opCode = payload[base + 3] ?? 0;
      const tgtCode = payload[base + 4] ?? 0;
      const tgtRightCode = payload[base + 5] ?? 0;

      const source1: LeadPatch['modMatrix'][0]['source1'] =
        src1Code === 1 ? 'LFO1' :
        src1Code === 2 ? 'LFO2' :
        src1Code === 3 ? 'LFO3' :
        src1Code === 4 ? 'LFO4' :
        src1Code === 5 ? 'LFO5' :
        src1Code === 6 ? 'LFO6' :
        src1Code === 7 ? 'ENV1' :
        src1Code === 8 ? 'ENV2' :
        src1Code === 9 ? 'WT1' :
        src1Code === 10 ? 'WT2' :
        src1Code === 11 ? 'VEL' :
        src1Code === 12 ? 'MOD' :
        src1Code === 13 ? 'PB' : 'NONE';

      const operator: LeadPatch['modMatrix'][0]['operator'] =
        opCode === 1 ? 'ADD' :
        opCode === 2 ? 'SUB' :
        opCode === 3 ? 'MUL' : 'NOP';

      const targetLeft: LeadPatch['modMatrix'][0]['targetLeft'] =
        tgtCode === 1 ? 'PITCH_ALL' :
        tgtCode === 2 ? 'CUTOFF' :
        tgtCode === 3 ? 'PW_ALL' :
        tgtCode === 4 ? 'RESONANCE' :
        tgtCode === 5 ? 'PAN' :
        tgtCode === 6 ? 'VOLUME' :
        tgtCode === 7 ? 'PITCH_OSC1' : 'NONE';

      const targetRight: LeadPatch['modMatrix'][0]['targetRight'] =
        tgtRightCode === 1 ? 'PITCH_ALL' :
        tgtRightCode === 2 ? 'CUTOFF' :
        tgtRightCode === 3 ? 'PW_ALL' :
        tgtRightCode === 4 ? 'RESONANCE' :
        tgtRightCode === 5 ? 'PAN' :
        tgtRightCode === 6 ? 'VOLUME' :
        tgtRightCode === 7 ? 'PITCH_OSC1' : 'NONE';

      return {
        id: i + 1,
        source1,
        source2: 'NONE' as const,
        operator,
        depth,
        invertLeft: (invFlags & 1) !== 0,
        invertRight: (invFlags & 2) !== 0,
        targetLeft,
        targetRight
      };
    });

    const wavetables = [0, 1, 2, 3].map((i) => {
      const base = 320 + i * 32;
      const stepCount = payload[base] || 16;
      const speed = payload[base + 1] ?? 64;
      const modeCode = payload[base + 2] ?? 0;
      const loopMode: 'off' | 'forward' | 'pingpong' = modeCode === 1 ? 'forward' : modeCode === 2 ? 'pingpong' : 'off';
      const steps = Array.from({ length: 16 }, (_, s) => payload[base + 4 + s] ?? 0);
      return { id: i + 1, stepCount, speed, loopMode, steps };
    }) as LeadPatch['wavetables'];

    const patch: LeadPatch = {
      coreId,
      name,
      engine: 'lead',
      socketLeftModel,
      socketRightModel,
      stereoSpread,
      syncStatus: 'synced',
      osc1: readOsc(0),
      osc2: readOsc(1),
      osc3: readOsc(2),
      osc4: readOsc(3),
      osc5: readOsc(4),
      osc6: readOsc(5),
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
      ampEnv: {
        attack: (payload[96] ?? 0x15) >> 4,
        decay: (payload[96] ?? 0x15) & 0x0f,
        sustain: (payload[97] ?? 0xc5) >> 4,
        release: (payload[97] ?? 0xc5) & 0x0f
      },
      filterEnv: {
        attack: (payload[98] ?? 0x28) >> 4,
        decay: (payload[98] ?? 0x28) & 0x0f,
        sustain: (payload[99] ?? 0x65) >> 4,
        release: (payload[99] ?? 0x65) & 0x0f
      },
      lfos,
      envs: [
        { attack: 2, decay: 6, sustain: 8, release: 4 },
        { attack: 0, decay: 4, sustain: 0, release: 2 }
      ],
      modMatrix,
      wavetables,
      arpEnabled: false,
      arpRate: '1/16',
      arpRange: 2,
      rawSysExDump,
      rawOpaqueBytes
    };
    return patch;
  }
}
