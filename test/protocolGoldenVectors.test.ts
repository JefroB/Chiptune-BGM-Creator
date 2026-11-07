import test from 'node:test';
import assert from 'node:assert/strict';
import {
  serializeSidPatchToSysEx,
  deserializeSysExToSidPatch,
  encodeNrpn,
  buildReadPatchSysEx,
  checkHardwareWritePermission,
  SID_SYSEX_HEADER,
  SID_SYSEX_EOX,
  SidSysExCommand
} from '../src/services/sidProtocolAdapter.ts';
import {
  DEFAULT_LEAD_PATCH,
  DEFAULT_BASSLINE_PATCH,
  DEFAULT_MULTI_PATCH,
  DEFAULT_DRUM_PATCH
} from '../src/data/defaultSidPatches.ts';

test('Protocol Golden Vector: Official MIDIbox SID V2 SysEx Header and Read Patch Frame', () => {
  // Official ucapps.de frame: F0 00 00 7E 46 <device_id> 01 <core> <bank> <patch> F7
  const deviceId = 0x02;
  const core = 0x03; // Core 4 (0-indexed 3)
  const bank = 0x01; // Bank B
  const patchNum = 0x2A; // Patch 42

  const sysex = buildReadPatchSysEx(deviceId, core, bank, patchNum);
  const expectedHeader = [0xf0, 0x00, 0x00, 0x7e, 0x46];

  for (let i = 0; i < expectedHeader.length; i++) {
    assert.equal(sysex[i], expectedHeader[i], `Byte ${i} matches standard header`);
  }

  assert.equal(sysex[5], deviceId);
  assert.equal(sysex[6], SidSysExCommand.READ_PATCH);
  assert.equal(sysex[7], core);
  assert.equal(sysex[8], bank);
  assert.equal(sysex[9], patchNum);
  assert.equal(sysex[10], SID_SYSEX_EOX);
});

test('Protocol Golden Vector: SysEx Write Patch frame length is exactly 523 bytes (10 header + 512 payload + 1 EOX)', () => {
  const sysex = serializeSidPatchToSysEx(DEFAULT_LEAD_PATCH, 0, 0, 0);
  assert.equal(sysex.length, 523);
  assert.equal(sysex[0], 0xf0);
  assert.equal(sysex[1], 0x00);
  assert.equal(sysex[2], 0x00);
  assert.equal(sysex[3], 0x7e);
  assert.equal(sysex[4], 0x46);
  assert.equal(sysex[6], SidSysExCommand.WRITE_PATCH);
  assert.equal(sysex[sysex.length - 1], 0xf7);

  // Magic bytes 'MBS2' at payload start (byte index 10..13)
  assert.equal(sysex[10], 0x4d); // 'M'
  assert.equal(sysex[11], 0x42); // 'B'
  assert.equal(sysex[12], 0x53); // 'S'
  assert.equal(sysex[13], 0x32); // '2'
});

test('Protocol Golden Vector: Lossless preservation of undocumented/opaque bytes', () => {
  // Simulate reading a physical patch dump that contains vendor-specific bytes in undocumented regions
  const baseDump = new Uint8Array(512);
  baseDump[0] = 0x4d; baseDump[1] = 0x42; baseDump[2] = 0x53; baseDump[3] = 0x32;
  // Inject canary bytes in high reserved space (e.g. 0x1E0..0x1EF)
  const canaryPattern = [0x55, 0xaa, 0x33, 0xcc, 0x12, 0x34, 0x56, 0x78];
  for (let i = 0; i < canaryPattern.length; i++) {
    baseDump[0x1e0 + i] = canaryPattern[i];
  }

  const patchWithOpaque = {
    ...DEFAULT_LEAD_PATCH,
    name: 'Canary Test',
    rawOpaqueBytes: Array.from(baseDump)
  };

  // Serialize and deserialize
  const serialized = serializeSidPatchToSysEx(patchWithOpaque, 0, 0, 0);
  const deserialized = deserializeSysExToSidPatch(serialized);

  // Canary bytes must be 100% retained
  assert.ok(deserialized.rawOpaqueBytes);
  for (let i = 0; i < canaryPattern.length; i++) {
    assert.equal(
      deserialized.rawOpaqueBytes![0x1e0 + i],
      canaryPattern[i],
      `Opaque canary byte at offset 0x${(0x1e0 + i).toString(16)} preserved`
    );
  }
});

test('Protocol Guard: Hardware SysEx writes are strictly locked until physical verification', () => {
  const unverified = checkHardwareWritePermission(DEFAULT_LEAD_PATCH, false);
  assert.equal(unverified.allowed, false);
  assert.match(unverified.reason, /DIRECT_WRITE_GUARD/);

  const verified = checkHardwareWritePermission(DEFAULT_LEAD_PATCH, true);
  assert.equal(verified.allowed, true);
  assert.equal(verified.reason, 'VERIFIED');
});

test('NRPN Protocol: 14-bit resolution ordering and boundary clamping', () => {
  // Test lower boundary
  const msgMin = encodeNrpn(0, 0x0000, -100);
  assert.equal(msgMin.valMsb, 0);
  assert.equal(msgMin.valLsb, 0);

  // Test upper boundary 14-bit (16383)
  const msgMax = encodeNrpn(15, 0x3fff, 20000);
  assert.equal(msgMax.valMsb, 127);
  assert.equal(msgMax.valLsb, 127);

  // Verify atomic 4-message sequencing: CC 99, 98, 6, 38 on channel 15 (0xBF)
  assert.deepEqual(msgMax.rawBytes, [
    0xbf, 0x63, 127,
    0xbf, 0x62, 127,
    0xbf, 0x06, 127,
    0xbf, 0x26, 127
  ]);
});
