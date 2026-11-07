import test from 'node:test';
import assert from 'node:assert/strict';
import { MidiParser } from '../src/services/midiParser.ts';
import { createChiptuneDemoSmf } from '../src/data/demoSongs.ts';

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
