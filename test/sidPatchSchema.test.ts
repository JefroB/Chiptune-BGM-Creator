import test from 'node:test';
import assert from 'node:assert/strict';
import {
  serializeSidPatchToSysEx,
  deserializeSysExToSidPatch,
  encodeNrpn,
  buildReadPatchSysEx,
  SID_SYSEX_HEADER
} from '../src/services/sidProtocolAdapter.ts';
import {
  DEFAULT_LEAD_PATCH,
  DEFAULT_BASSLINE_PATCH,
  DEFAULT_MULTI_PATCH,
  DEFAULT_DRUM_PATCH
} from '../src/data/defaultSidPatches.ts';

test('SID NRPN Encoder: generates atomic 4-message MIDI CC sequence (0x63, 0x62, 0x06, 0x26)', () => {
  const channel = 5; // Channel 6 (0-indexed 5)
  const nrpnAddress = 0x0140; // Filter Cutoff
  const value = 1400;

  const msg = encodeNrpn(channel, nrpnAddress, value);
  assert.equal(msg.channel, 5);
  assert.equal(msg.msb, (nrpnAddress >> 7) & 0x7f);
  assert.equal(msg.lsb, nrpnAddress & 0x7f);
  assert.equal(msg.valMsb, (value >> 7) & 0x7f);
  assert.equal(msg.valLsb, value & 0x7f);

  // Check 12-byte raw MIDI wire stream
  assert.equal(msg.rawBytes.length, 12);
  assert.equal(msg.rawBytes[0], 0xb5); // CC on Ch 6
  assert.equal(msg.rawBytes[1], 0x63); // NRPN MSB
  assert.equal(msg.rawBytes[3], 0xb5);
  assert.equal(msg.rawBytes[4], 0x62); // NRPN LSB
  assert.equal(msg.rawBytes[6], 0xb5);
  assert.equal(msg.rawBytes[7], 0x06); // Data Entry MSB
  assert.equal(msg.rawBytes[9], 0xb5);
  assert.equal(msg.rawBytes[10], 0x26); // Data Entry LSB
});

test('SID SysEx Read Request: formats compliant ucapps.de header', () => {
  const req = buildReadPatchSysEx(0, 1, 0, 4);
  assert.equal(req[0], 0xf0);
  assert.equal(req[1], 0x00);
  assert.equal(req[2], 0x00);
  assert.equal(req[3], 0x7e);
  assert.equal(req[4], 0x46);
  assert.equal(req[5], 0x00); // device 0
  assert.equal(req[6], 0x01); // cmd: read
  assert.equal(req[7], 0x01); // core 1
  assert.equal(req[8], 0x00); // bank 0
  assert.equal(req[9], 0x04); // patch 4
  assert.equal(req[10], 0xf7); // EOX
});

test('Lead Engine: SysEx serialization roundtrips losslessly and preserves parameters', () => {
  const original = { ...DEFAULT_LEAD_PATCH, name: 'Lead Test Patch' };
  const sysex = serializeSidPatchToSysEx(original, 0, 0, 0);

  // Check header
  assert.equal(sysex[0], 0xf0);
  assert.equal(sysex[sysex.length - 1], 0xf7);

  const restored = deserializeSysExToSidPatch(sysex);
  assert.equal(restored.engine, 'lead');
  assert.equal(restored.coreId, original.coreId);
  assert.equal(restored.name.trim(), 'Lead Test Patch');
  assert.equal(restored.socketLeftModel, original.socketLeftModel);
  assert.equal(restored.socketRightModel, original.socketRightModel);

  // Re-serialize and check byte-for-byte identity
  const roundtripBytes = serializeSidPatchToSysEx(restored, 0, 0, 0);
  assert.deepEqual(sysex, roundtripBytes);
});

test('Bassline Engine (TB-303): preserves 303 parameters, accents, and 16-step sequencer', () => {
  const original = { ...DEFAULT_BASSLINE_PATCH, name: 'TB-303 Acid Lead' };
  const sysex = serializeSidPatchToSysEx(original, 0, 0, 1);
  const restored = deserializeSysExToSidPatch(sysex);

  assert.equal(restored.engine, 'bassline');
  assert.equal(restored.name.trim(), 'TB-303 Acid Lead');
  if (restored.engine === 'bassline') {
    assert.equal(restored.inst1.waveform, original.inst1.waveform);
    assert.equal(restored.inst1.resonance, original.inst1.resonance);
    assert.equal(restored.inst1.steps.length, 16);
    assert.equal(restored.inst1.steps[0].accent, true);
  }
});

test('Multi Engine: preserves multi-instrument count and configuration', () => {
  const original = { ...DEFAULT_MULTI_PATCH, name: 'Multi Rig Test' };
  const sysex = serializeSidPatchToSysEx(original, 0, 0, 2);
  const restored = deserializeSysExToSidPatch(sysex);

  assert.equal(restored.engine, 'multi');
  if (restored.engine === 'multi') {
    assert.equal(restored.instruments.length, original.instruments.length);
    assert.equal(restored.instruments[0].name, original.instruments[0].name);
  }
});

test('Drum Engine: preserves drum kit instruments and trigger notes', () => {
  const original = { ...DEFAULT_DRUM_PATCH, name: 'Drum Kit 808' };
  const sysex = serializeSidPatchToSysEx(original, 0, 0, 3);
  const restored = deserializeSysExToSidPatch(sysex);

  assert.equal(restored.engine, 'drum');
  if (restored.engine === 'drum') {
    assert.ok(restored.drums.length >= 8);
    assert.equal(restored.drums[0].triggerNote, 36);
  }
});
