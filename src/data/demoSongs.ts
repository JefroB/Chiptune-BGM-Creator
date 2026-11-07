/**
 * Authentic 8-Track + DPCM Chiptune Demo Arrangement
 * Builds a valid SMF Format 1 binary file in memory:
 * Track 1: NES Pulse 1 (Lead Arpeggio)
 * Track 2: NES Pulse 2 (Counter Melody & Chords)
 * Track 3: NES Triangle (Classic Walking Chiptune Bass)
 * Track 4: NES Noise (Hi-hats and snare accents)
 * Track 5: SID Core 1 (Heavy Resonant 6581 Bass/Lead)
 * Track 6: SID Core 2 (Stereo PWM Pad / Arp)
 * Track 7: SID Core 3 (Poly Synth Brass / Chord Stabs)
 * Track 8: SID Core 4 (Stereo Ambient Noise Sweeps)
 * Track 9: NES DPCM Aux (Nullsleep 256 Drum Kit: Kick, Snare, Breakbeat)
 */

export function createChiptuneDemoSmf(): Uint8Array {
  // Helper to encode variable-length integer
  function encodeVarInt(value: number): number[] {
    const bytes: number[] = [];
    let v = value;
    bytes.push(v & 0x7f);
    v >>= 7;
    while (v > 0) {
      bytes.unshift((v & 0x7f) | 0x80);
      v >>= 7;
    }
    return bytes;
  }

  // Helper to build a track chunk
  function buildTrack(name: string, events: Array<{ delta: number; data: number[] }>): number[] {
    const trackData: number[] = [];
    // Track name meta event (0xFF 0x03 len name)
    const nameBytes = Array.from(new TextEncoder().encode(name));
    trackData.push(0x00, 0xff, 0x03, ...encodeVarInt(nameBytes.length), ...nameBytes);

    for (const ev of events) {
      trackData.push(...encodeVarInt(ev.delta), ...ev.data);
    }
    // End of track meta event (0x00 0xFF 0x2F 0x00)
    trackData.push(0x00, 0xff, 0x2f, 0x00);

    const len = trackData.length;
    return [
      0x4d, 0x54, 0x72, 0x6b, // 'MTrk'
      (len >> 24) & 0xff,
      (len >> 16) & 0xff,
      (len >> 8) & 0xff,
      len & 0xff,
      ...trackData
    ];
  }

  const ppq = 480;
  const numTracks = 10; // Conductor + 8 primary + 1 DPCM aux

  // Conductor Track (Tempo & Time Signature)
  const conductorEvents = [
    { delta: 0, data: [0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08] }, // 4/4 time
    { delta: 0, data: [0xff, 0x51, 0x03, 0x07, 0xa1, 0x20] }, // 120 BPM (500,000 micros)
  ];
  const conductorChunk = buildTrack('Tempo Conductor', conductorEvents);

  // Track 1: NES Pulse 1 (Lead Arpeggio) - Ch 1 (0x00)
  const t1Events: Array<{ delta: number; data: number[] }> = [];
  const leadScale = [60, 63, 67, 72, 70, 67, 63, 67]; // C minor chiptune arpeggio
  for (let bar = 0; bar < 4; bar++) {
    for (const note of leadScale) {
      t1Events.push({ delta: 0, data: [0x90, note, 100] });
      t1Events.push({ delta: 120, data: [0x80, note, 0] });
    }
  }
  const t1Chunk = buildTrack('Track 1 - NES Pulse 1 (Lead)', t1Events);

  // Track 2: NES Pulse 2 (Counter Melody) - Ch 2 (0x01)
  const t2Events: Array<{ delta: number; data: number[] }> = [];
  const melodyNotes = [72, 75, 74, 70, 72, 67, 65, 67];
  for (let bar = 0; bar < 4; bar++) {
    for (const note of melodyNotes) {
      t2Events.push({ delta: 0, data: [0x91, note, 90] });
      t2Events.push({ delta: 240, data: [0x81, note, 0] });
    }
  }
  const t2Chunk = buildTrack('Track 2 - NES Pulse 2 (Counter)', t2Events);

  // Track 3: NES Triangle (Bass) - Ch 3 (0x02)
  const t3Events: Array<{ delta: number; data: number[] }> = [];
  const bassNotes = [36, 36, 41, 41, 43, 43, 39, 39]; // C1, F1, G1, D#1
  for (let bar = 0; bar < 4; bar++) {
    for (const note of bassNotes) {
      t3Events.push({ delta: 0, data: [0x92, note, 127] });
      t3Events.push({ delta: 240, data: [0x82, note, 0] });
    }
  }
  const t3Chunk = buildTrack('Track 3 - NES Triangle (Bass)', t3Events);

  // Track 4: NES Noise (Hats & Snares) - Ch 4 (0x03)
  const t4Events: Array<{ delta: number; data: number[] }> = [];
  for (let step = 0; step < 32; step++) {
    const isSnare = step % 4 === 2;
    const note = isSnare ? 60 : 72; // Pitch index in MIDInes
    t4Events.push({ delta: 0, data: [0x93, note, isSnare ? 110 : 70] });
    t4Events.push({ delta: 120, data: [0x83, note, 0] });
  }
  const t4Chunk = buildTrack('Track 4 - NES Noise (Percussion)', t4Events);

  // Track 5: SID Core 1 (Heavy 6581 Lead/Bass) - Ch 6 (0x05)
  const t5Events: Array<{ delta: number; data: number[] }> = [];
  for (let bar = 0; bar < 4; bar++) {
    t5Events.push({ delta: 0, data: [0x95, 48, 115] }); // C2
    t5Events.push({ delta: 480, data: [0x85, 48, 0] });
    t5Events.push({ delta: 0, data: [0x95, 51, 115] }); // D#2
    t5Events.push({ delta: 480, data: [0x85, 51, 0] });
  }
  const t5Chunk = buildTrack('Track 5 - SID Core 1 (Stereo Pair 1)', t5Events);

  // Track 6: SID Core 2 (Stereo PWM Arp) - Ch 7 (0x06)
  const t6Events: Array<{ delta: number; data: number[] }> = [];
  const sidArp = [60, 67, 72, 75];
  for (let bar = 0; bar < 4; bar++) {
    for (let rep = 0; rep < 4; rep++) {
      for (const note of sidArp) {
        t6Events.push({ delta: 0, data: [0x96, note, 95] });
        t6Events.push({ delta: 60, data: [0x86, note, 0] });
      }
    }
  }
  const t6Chunk = buildTrack('Track 6 - SID Core 2 (Stereo Pair 2)', t6Events);

  // Track 7: SID Core 3 (Chords / Brass) - Ch 8 (0x07)
  const t7Events: Array<{ delta: number; data: number[] }> = [];
  for (let bar = 0; bar < 4; bar++) {
    t7Events.push({ delta: 0, data: [0x97, 60, 90] });
    t7Events.push({ delta: 960, data: [0x87, 60, 0] });
    t7Events.push({ delta: 0, data: [0x97, 63, 90] });
    t7Events.push({ delta: 960, data: [0x87, 63, 0] });
  }
  const t7Chunk = buildTrack('Track 7 - SID Core 3 (Stereo Pair 3)', t7Events);

  // Track 8: SID Core 4 (Stereo Ambient Pad) - Ch 9 (0x08)
  const t8Events: Array<{ delta: number; data: number[] }> = [];
  for (let bar = 0; bar < 4; bar++) {
    t8Events.push({ delta: 0, data: [0x98, 72, 80] });
    t8Events.push({ delta: 1920, data: [0x88, 72, 0] });
  }
  const t8Chunk = buildTrack('Track 8 - SID Core 4 (Stereo Pair 4)', t8Events);

  // Track 9: NES DPCM Aux (Channel 5 = 0x04)
  // Sends CC14 = 0 (Bank 1) at tick 0, then plays BD (note 36 = C2) and SD (note 40 = E2)
  const t9Events: Array<{ delta: number; data: number[] }> = [
    { delta: 0, data: [0xb4, 14, 0] }, // CC14 = 0 (Bank 1)
  ];
  for (let bar = 0; bar < 4; bar++) {
    // Beat 1: Kick (Note 36)
    t9Events.push({ delta: 0, data: [0x94, 36, 120] });
    t9Events.push({ delta: 240, data: [0x84, 36, 0] });
    // Beat 2: Snare (Note 40)
    t9Events.push({ delta: 0, data: [0x94, 40, 115] });
    t9Events.push({ delta: 240, data: [0x84, 40, 0] });
    // Beat 3: Kick
    t9Events.push({ delta: 0, data: [0x94, 36, 120] });
    t9Events.push({ delta: 240, data: [0x84, 36, 0] });
    // Beat 4: Snare
    t9Events.push({ delta: 0, data: [0x94, 40, 115] });
    t9Events.push({ delta: 240, data: [0x84, 40, 0] });
  }
  const t9Chunk = buildTrack('Track 9 - NES DPCM Aux (Channel 5)', t9Events);

  // Header chunk: 'MThd', len 6, format 1, 10 tracks, 480 PPQ
  const header = [
    0x4d, 0x54, 0x68, 0x64, // 'MThd'
    0x00, 0x00, 0x00, 0x06, // length 6
    0x00, 0x01, // Format 1
    (numTracks >> 8) & 0xff, numTracks & 0xff, // 10 tracks
    (ppq >> 8) & 0xff, ppq & 0xff // 480 PPQ
  ];

  const fullBytes = [
    ...header,
    ...conductorChunk,
    ...t1Chunk,
    ...t2Chunk,
    ...t3Chunk,
    ...t4Chunk,
    ...t5Chunk,
    ...t6Chunk,
    ...t7Chunk,
    ...t8Chunk,
    ...t9Chunk
  ];

  return new Uint8Array(fullBytes);
}
