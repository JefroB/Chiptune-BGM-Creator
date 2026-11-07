import test from 'node:test';
import assert from 'node:assert/strict';
import { MidiParser } from '../src/services/midiParser.ts';
import { createChiptuneDemoSmf } from '../src/data/demoSongs.ts';
import { createRoutesForSong } from '../src/services/midiRouting.ts';

test('MIDI Parser: successfully parses synthetic 8-track + DPCM SMF Format 1', () => {
  const smfBytes = createChiptuneDemoSmf();
  const parser = new MidiParser(smfBytes);
  const song = parser.parse();

  assert.equal(song.format, 1);
  assert.equal(song.ppq, 480);
  assert.ok(song.durationSec > 0);
  assert.ok(song.totalTicks > 0);
  assert.equal(song.tracks.length, 10); // Conductor + 8 primary + 1 aux DPCM
});

test('MIDI Parser: extracts tempo and time signature from conductor track', () => {
  const smfBytes = createChiptuneDemoSmf();
  const parser = new MidiParser(smfBytes);
  const song = parser.parse();

  assert.ok(song.tempoMap.length > 0);
  assert.equal(song.tempoMap[0].bpm, 120);

  assert.ok(song.timeSignatures.length > 0);
  assert.equal(song.timeSignatures[0].numerator, 4);
  assert.equal(song.timeSignatures[0].denominator, 4);
});

test('MIDI Parser: DPCM aux track sends CC14 Bank Select before notes', () => {
  const smfBytes = createChiptuneDemoSmf();
  const parser = new MidiParser(smfBytes);
  const song = parser.parse();

  const dpcmTrack = song.tracks.find((t) => t.name.includes('DPCM'));
  assert.ok(dpcmTrack, 'DPCM track must exist');

  const cc14Event = dpcmTrack.events.find((e) => e.type === 'cc' && e.controller === 14);
  assert.ok(cc14Event, 'CC14 event must exist');
  assert.equal(cc14Event.value, 0); // Bank 1
});

test('MIDI Routing: conductor track at index 0 does not cause track index drift in routes', () => {
  const smfBytes = createChiptuneDemoSmf();
  const parser = new MidiParser(smfBytes);
  const song = parser.parse();

  // Track 0 is the conductor track (tempo / time signature)
  assert.equal(song.tracks[0].isConductor, true);
  assert.equal(song.tracks[0].noteCount, 0);

  // Content tracks must have noteCount > 0 and isConductor false
  for (let i = 1; i < song.tracks.length; i++) {
    assert.equal(song.tracks[i].isConductor, false);
    assert.ok(song.tracks[i].noteCount > 0);
  }

  const routes = createRoutesForSong(song);

  // Conductor track must NOT be assigned as an instrument voice route
  assert.equal(routes.some((r: any) => r.trackIndex === 0), false, 'Conductor track must be excluded from voice routes');

  // Content tracks must retain their exact original SMF track indices (1..9)
  assert.equal(routes.length, 9);
  assert.equal(routes[0].trackIndex, 1);
  assert.equal(routes[0].voiceId, 'nes.pulse1');
  assert.equal(routes[8].trackIndex, 9);
  assert.equal(routes[8].voiceId, 'nes.dpcm');
});

test('MIDI Parser: handles Format 0 by splitting channels into individual tracks', () => {
  // Construct a minimal SMF Format 0 file with 2 channels
  // Header: 'MThd' (4), length=6 (4), format=0 (2), ntrks=1 (2), division=480 (2)
  const header = [
    0x4d, 0x54, 0x68, 0x64, // MThd
    0x00, 0x00, 0x00, 0x06, // length
    0x00, 0x00,             // format 0
    0x00, 0x01,             // 1 track
    0x01, 0xe0              // division 480
  ];

  // Track 1: noteOn on ch 0, noteOn on ch 1, noteOffs, end of track
  const trackEvents = [
    // delta=0, noteOn ch 0, note 60, vel 100
    0x00, 0x90, 0x3c, 0x64,
    // delta=0, noteOn ch 1, note 64, vel 100
    0x00, 0x91, 0x40, 0x64,
    // delta=120, noteOff ch 0, note 60, vel 0
    0x78, 0x80, 0x3c, 0x00,
    // delta=0, noteOff ch 1, note 64, vel 0
    0x00, 0x81, 0x40, 0x00,
    // delta=0, end of track meta event FF 2F 00
    0x00, 0xff, 0x2f, 0x00
  ];

  const trackHeader = [
    0x4d, 0x54, 0x72, 0x6b, // MTrk
    (trackEvents.length >> 24) & 0xff,
    (trackEvents.length >> 16) & 0xff,
    (trackEvents.length >> 8) & 0xff,
    trackEvents.length & 0xff
  ];

  const smf = new Uint8Array([...header, ...trackHeader, ...trackEvents]);
  const parser = new MidiParser(smf);
  const song = parser.parse();

  assert.equal(song.format, 0);
  assert.equal(song.tracks.length, 2, 'Format 0 multi-channel events must be split into separate tracks');
  assert.equal(song.tracks[0].channelMask[0], 0);
  assert.equal(song.tracks[1].channelMask[0], 1);
  assert.equal(song.tracks[0].noteCount, 1);
  assert.equal(song.tracks[1].noteCount, 1);
});
