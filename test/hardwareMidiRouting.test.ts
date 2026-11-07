import test from 'node:test';
import assert from 'node:assert/strict';
import { midiDeviceManager } from '../src/services/midiDeviceManager.ts';

test('Hardware MIDI Routing: resolveVoiceTarget strictly isolates MIDInes and SID Cores', () => {
  // Configure mock device ports
  const mockMidinesPortId = 'port-midines-hw-out';
  const mockSidPortId = 'port-sid-hw-out';

  midiDeviceManager.updateBinding({
    mode: 'hardware',
    midinesPortId: mockMidinesPortId,
    midinesChannel: 1,
    sidCorePorts: [mockSidPortId, mockSidPortId, mockSidPortId, mockSidPortId],
    sidCoreChannels: [6, 7, 8, 9]
  });

  // Verify MIDInes voice targets
  const nesPulse1Target = midiDeviceManager.resolveVoiceTarget('nes.pulse1');
  assert.equal(nesPulse1Target?.portId, mockMidinesPortId);
  assert.equal(nesPulse1Target?.channel, 1); // 1-indexed Ch 1

  const nesDpcmTarget = midiDeviceManager.resolveVoiceTarget('nes.dpcm');
  assert.equal(nesDpcmTarget?.portId, mockMidinesPortId);
  assert.equal(nesDpcmTarget?.channel, 5); // 1-indexed Ch 5

  // Verify SID Core voice targets
  const sidCore1Target = midiDeviceManager.resolveVoiceTarget('sid.core1');
  assert.equal(sidCore1Target?.portId, mockSidPortId);
  assert.equal(sidCore1Target?.channel, 6); // 1-indexed Ch 6

  const sidCore2Target = midiDeviceManager.resolveVoiceTarget('sid.core2');
  assert.equal(sidCore2Target?.portId, mockSidPortId);
  assert.equal(sidCore2Target?.channel, 7); // 1-indexed Ch 7

  const sidCore3Target = midiDeviceManager.resolveVoiceTarget('sid.core3');
  assert.equal(sidCore3Target?.portId, mockSidPortId);
  assert.equal(sidCore3Target?.channel, 8); // 1-indexed Ch 8

  const sidCore4Target = midiDeviceManager.resolveVoiceTarget('sid.core4');
  assert.equal(sidCore4Target?.portId, mockSidPortId);
  assert.equal(sidCore4Target?.channel, 9); // 1-indexed Ch 9
});

test('Hardware MIDI Routing: SID messages NEVER redirect or fall back to MIDInes port when SID port is unassigned', () => {
  // Simulate SID port unassigned
  midiDeviceManager.updateBinding({
    mode: 'hardware',
    midinesPortId: 'port-midines-hw-out',
    midinesChannel: 1,
    sidCorePorts: [null, null, null, null],
    sidCoreChannels: [6, 7, 8, 9]
  });

  const sidTarget = midiDeviceManager.resolveVoiceTarget('sid.core1');
  // Must return null, NEVER falling back to port-midines-hw-out
  assert.equal(sidTarget?.portId, null, 'Unassigned SID port must resolve to null, preventing silent misrouting to MIDInes');
});

test('Hardware MIDI Transmission: outputs well-formed status bytes and channel framing', () => {
  const sentMessages: { portId: string; bytes: number[] }[] = [];

  // Register mock MIDI output port on the manager
  const mockPortId = 'mock-test-port';
  const mockOutput = {
    id: mockPortId,
    name: 'Hardware Output 1',
    manufacturer: 'Test',
    state: 'connected',
    send: (bytes: number[] | Uint8Array) => {
      sentMessages.push({ portId: mockPortId, bytes: Array.from(bytes) });
    }
  };

  midiDeviceManager.updateBinding({ mode: 'hardware' });
  (midiDeviceManager as any).outputPorts.set(mockPortId, mockOutput);

  // Send Note On (channel 4 -> 1-indexed, becomes status 0x93)
  midiDeviceManager.sendNoteOn(mockPortId, 4, 60, 100);
  // Send Note Off
  midiDeviceManager.sendNoteOff(mockPortId, 4, 60);
  // Send CC (e.g. Bank Select CC 14 on channel 5 -> status 0xB4)
  midiDeviceManager.sendCC(mockPortId, 5, 14, 64);
  // Send Pitch Bend (center 8192 on channel 6 -> status 0xE5)
  midiDeviceManager.sendPitchBend(mockPortId, 6, 8192);
  // Send Program Change on channel 7 -> status 0xC6
  midiDeviceManager.sendProgramChange(mockPortId, 7, 42);

  // Verify transmissions were logged and queued
  assert.ok((midiDeviceManager as any).txLog.length >= 5);
  const logEntries = (midiDeviceManager as any).txLog;
  assert.equal(logEntries[4].type, 'NOTE');
  assert.deepEqual(logEntries[4].data, [0x93, 60, 100]);
  assert.equal(logEntries[3].type, 'NOTE');
  assert.deepEqual(logEntries[3].data, [0x83, 60, 0]);
  assert.equal(logEntries[2].type, 'CC');
  assert.deepEqual(logEntries[2].data, [0xb4, 14, 64]);
  assert.equal(logEntries[1].type, 'CC'); // pitch bend logged as CC/pitch
  assert.deepEqual(logEntries[1].data, [0xe5, 0x00, 0x40]);
  assert.equal(logEntries[0].type, 'CC'); // program change
  assert.deepEqual(logEntries[0].data, [0xc6, 42]);
});
