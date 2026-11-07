/**
 * Standard MIDI File (SMF) Parser, Normalizer, and Preflight Analyzer
 * Supports SMF Format 0 and Format 1, variable-length quantities,
 * running status, tempo maps, and preflight validation for 8-track + DPCM hardware.
 */

import { MidiParsedEvent, MidiParsedTrack, MidiSongModel, PreflightWarning } from '../types/index.ts';

export class MidiParser {
  private buffer: Uint8Array;
  private offset = 0;

  constructor(arrayBuffer: ArrayBuffer | Uint8Array) {
    this.buffer = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
  }

  public parse(): MidiSongModel {
    this.offset = 0;
    // 1. Read MThd header
    const headerId = this.readAscii(4);
    if (headerId !== 'MThd') {
      throw new Error(`Invalid MIDI file header: expected 'MThd', found '${headerId}'`);
    }

    const headerLength = this.readUint32();
    if (headerLength < 6) {
      throw new Error(`Invalid MThd length: expected >= 6, got ${headerLength}`);
    }

    const format = this.readUint16() as 0 | 1 | 2;
    if (format !== 0 && format !== 1) {
      throw new Error(`SMF Format ${format} is not supported. Use Format 0 or 1.`);
    }

    const numTracks = this.readUint16();
    const division = this.readUint16();

    // Check if division is PPQ (positive) or SMPTE (negative bit 15)
    let ppq = 480;
    if ((division & 0x8000) === 0) {
      ppq = division;
    } else {
      // SMPTE division - fallback to standard 480 PPQ equivalent
      ppq = 480;
    }

    // Skip any extra header bytes if length > 6
    if (headerLength > 6) {
      this.offset += headerLength - 6;
    }

    const rawTracks: Array<{ name: string; events: MidiParsedEvent[] }> = [];

    // 2. Read each MTrk chunk
    for (let t = 0; t < numTracks; t++) {
      if (this.offset >= this.buffer.length) break;

      const trackId = this.readAscii(4);
      if (trackId !== 'MTrk') {
        // Skip unknown chunks safely
        if (this.offset + 4 <= this.buffer.length) {
          const chunkLen = this.readUint32();
          this.offset += chunkLen;
          continue;
        } else {
          break;
        }
      }

      const trackLength = this.readUint32();
      const trackEnd = this.offset + trackLength;
      const trackEvents: MidiParsedEvent[] = [];
      let currentTick = 0;
      let runningStatus: number | null = null;
      let trackName = `Track ${t + 1}`;

      while (this.offset < trackEnd && this.offset < this.buffer.length) {
        const delta = this.readVarInt();
        currentTick += delta;

        let statusByte = this.buffer[this.offset];

        if (statusByte >= 0x80) {
          this.offset++;
          // Sysex and Meta events cancel running status
          if (statusByte === 0xf0 || statusByte === 0xf7 || statusByte === 0xff) {
            runningStatus = null;
          } else {
            runningStatus = statusByte;
          }
        } else {
          if (runningStatus === null) {
            throw new Error(`MIDI running status error at offset ${this.offset}: unexpected data byte 0x${statusByte.toString(16)}`);
          }
          statusByte = runningStatus;
        }

        const eventType = statusByte & 0xf0;
        const channel = statusByte & 0x0f;

        if (statusByte === 0xff) {
          // Meta Event
          const metaType = this.readUint8();
          const metaLen = this.readVarInt();
          const metaData = this.readBytes(metaLen);

          if (metaType === 0x03) {
            // Track Name
            trackName = new TextDecoder().decode(metaData).trim();
          } else if (metaType === 0x51 && metaLen === 3) {
            // Set Tempo (microseconds per quarter note)
            const mpqn = (metaData[0] << 16) | (metaData[1] << 8) | metaData[2];
            const bpm = Math.round((60000000 / mpqn) * 100) / 100;
            trackEvents.push({
              tick: currentTick,
              timeSec: 0,
              trackIndex: t,
              type: 'tempo',
              channel: 0,
              bpm
            });
          } else if (metaType === 0x58 && metaLen >= 2) {
            // Time Signature
            const numerator = metaData[0];
            const denominator = Math.pow(2, metaData[1]);
            trackEvents.push({
              tick: currentTick,
              timeSec: 0,
              trackIndex: t,
              type: 'timeSignature',
              channel: 0,
              numerator,
              denominator
            });
          }
        } else if (statusByte === 0xf0 || statusByte === 0xf7) {
          // SysEx Event
          const sysexLen = this.readVarInt();
          const sysexData = this.readBytes(sysexLen);
          trackEvents.push({
            tick: currentTick,
            timeSec: 0,
            trackIndex: t,
            type: 'sysEx',
            channel: 0,
            data: sysexData
          });
        } else if (eventType === 0x80) {
          // Note Off
          const note = this.readUint8();
          const velocity = this.readUint8();
          trackEvents.push({
            tick: currentTick,
            timeSec: 0,
            trackIndex: t,
            type: 'noteOff',
            channel,
            note,
            velocity
          });
        } else if (eventType === 0x90) {
          // Note On (velocity 0 is Note Off)
          const note = this.readUint8();
          const velocity = this.readUint8();
          trackEvents.push({
            tick: currentTick,
            timeSec: 0,
            trackIndex: t,
            type: velocity === 0 ? 'noteOff' : 'noteOn',
            channel,
            note,
            velocity
          });
        } else if (eventType === 0xb0) {
          // Control Change
          const controller = this.readUint8();
          const value = this.readUint8();
          trackEvents.push({
            tick: currentTick,
            timeSec: 0,
            trackIndex: t,
            type: 'cc',
            channel,
            controller,
            value
          });
        } else if (eventType === 0xc0) {
          // Program Change
          const program = this.readUint8();
          trackEvents.push({
            tick: currentTick,
            timeSec: 0,
            trackIndex: t,
            type: 'programChange',
            channel,
            value: program
          });
        } else if (eventType === 0xe0) {
          // Pitch Bend
          const lsb = this.readUint8();
          const msb = this.readUint8();
          const bend = (msb << 7) | lsb; // 0 to 16383, 8192 is center
          trackEvents.push({
            tick: currentTick,
            timeSec: 0,
            trackIndex: t,
            type: 'pitchBend',
            channel,
            value: bend
          });
        } else if (eventType === 0xa0 || eventType === 0xd0) {
          // Poly pressure or channel pressure - 1 or 2 bytes
          if (eventType === 0xa0) {
            this.readUint8(); // note
            this.readUint8(); // pressure
          } else {
            this.readUint8(); // pressure
          }
        } else {
          // Unknown status byte - skip safely
          this.offset++;
        }
      }

      rawTracks.push({ name: trackName, events: trackEvents });
    }

    // 3. Build tempo map and compute absolute seconds
    const allTempoEvents: Array<{ tick: number; bpm: number }> = [];
    const allTimeSigEvents: Array<{ tick: number; numerator: number; denominator: number }> = [];

    for (const trk of rawTracks) {
      for (const ev of trk.events) {
        if (ev.type === 'tempo' && ev.bpm) {
          allTempoEvents.push({ tick: ev.tick, bpm: ev.bpm });
        }
        if (ev.type === 'timeSignature' && ev.numerator && ev.denominator) {
          allTimeSigEvents.push({ tick: ev.tick, numerator: ev.numerator, denominator: ev.denominator });
        }
      }
    }

    // Default 120 BPM if no tempo event found
    if (allTempoEvents.length === 0 || allTempoEvents[0].tick !== 0) {
      allTempoEvents.unshift({ tick: 0, bpm: 120 });
    }
    allTempoEvents.sort((a, b) => a.tick - b.tick);

    if (allTimeSigEvents.length === 0 || allTimeSigEvents[0].tick !== 0) {
      allTimeSigEvents.unshift({ tick: 0, numerator: 4, denominator: 4 });
    }
    allTimeSigEvents.sort((a, b) => a.tick - b.tick);

    // Build timeline map
    const tempoMap: Array<{ tick: number; timeSec: number; bpm: number }> = [];
    let accumulatedTime = 0;
    let lastTick = 0;
    let currentBpm = allTempoEvents[0].bpm;

    for (const tEvent of allTempoEvents) {
      const deltaTicks = tEvent.tick - lastTick;
      const secondsPerTick = 60 / (currentBpm * ppq);
      accumulatedTime += deltaTicks * secondsPerTick;
      tempoMap.push({
        tick: tEvent.tick,
        timeSec: accumulatedTime,
        bpm: tEvent.bpm
      });
      lastTick = tEvent.tick;
      currentBpm = tEvent.bpm;
    }

    // Function to calculate seconds from ticks
    const tickToSeconds = (tick: number): number => {
      let t = 0;
      let prevTick = 0;
      let bpm = 120;
      for (const segment of tempoMap) {
        if (tick < segment.tick) {
          const delta = tick - prevTick;
          return t + (delta * 60) / (bpm * ppq);
        }
        const delta = segment.tick - prevTick;
        t += (delta * 60) / (bpm * ppq);
        prevTick = segment.tick;
        bpm = segment.bpm;
      }
      const delta = tick - prevTick;
      return t + (delta * 60) / (bpm * ppq);
    };

    // Calculate timeSec for all track events
    let maxTick = 0;
    const tracks: MidiParsedTrack[] = [];

    // If Format 0 (single track containing multiple channels), split into channels
    if (format === 0 && rawTracks.length > 0) {
      const singleTrk = rawTracks[0];
      const channelGroups = new Map<number, MidiParsedEvent[]>();

      for (const ev of singleTrk.events) {
        ev.timeSec = tickToSeconds(ev.tick);
        if (ev.tick > maxTick) maxTick = ev.tick;
        const ch = ev.channel;
        if (!channelGroups.has(ch)) channelGroups.set(ch, []);
        channelGroups.get(ch)!.push(ev);
      }

      let chIdx = 0;
      channelGroups.forEach((evList, ch) => {
        let minNote = 127;
        let maxNote = 0;
        for (const e of evList) {
          if (e.note !== undefined) {
            if (e.note < minNote) minNote = e.note;
            if (e.note > maxNote) maxNote = e.note;
          }
        }
        tracks.push({
          index: chIdx,
          name: `Channel ${ch + 1}`,
          eventCount: evList.length,
          channelMask: [ch],
          noteRange: { min: minNote === 127 ? 0 : minNote, max: maxNote },
          events: evList.sort((a, b) => a.tick - b.tick)
        });
        chIdx++;
      });
    } else {
      // Format 1
      rawTracks.forEach((trk, idx) => {
        const channelSet = new Set<number>();
        let minNote = 127;
        let maxNote = 0;

        for (const ev of trk.events) {
          ev.timeSec = tickToSeconds(ev.tick);
          if (ev.tick > maxTick) maxTick = ev.tick;
          if (ev.type === 'noteOn' || ev.type === 'noteOff' || ev.type === 'cc') {
            channelSet.add(ev.channel);
          }
          if (ev.note !== undefined) {
            if (ev.note < minNote) minNote = ev.note;
            if (ev.note > maxNote) maxNote = ev.note;
          }
        }

        tracks.push({
          index: idx,
          name: trk.name || `Track ${idx + 1}`,
          eventCount: trk.events.length,
          channelMask: Array.from(channelSet),
          noteRange: { min: minNote === 127 ? 0 : minNote, max: maxNote },
          events: trk.events.sort((a, b) => a.tick - b.tick)
        });
      });
    }

    const durationSec = tickToSeconds(maxTick);

    // 4. Generate Preflight Report
    const preflightWarnings = this.runPreflightCheck(tracks);

    return {
      format,
      ppq,
      durationSec,
      totalTicks: maxTick,
      tracks,
      tempoMap,
      timeSignatures: allTimeSigEvents,
      preflightWarnings
    };
  }

  private runPreflightCheck(tracks: MidiParsedTrack[]): PreflightWarning[] {
    const warnings: PreflightWarning[] = [];

    // Track count check (Recommended: 8 primary tracks + 1 optional DPCM aux lane)
    if (tracks.length > 9) {
      warnings.push({
        severity: 'warning',
        category: 'track_count',
        message: `File contains ${tracks.length} tracks. Hardware setup expects 8 primary tracks + 1 DPCM auxiliary lane.`,
        suggestion: 'Map surplus tracks to inactive slots or consolidate into the 8 instrument voices.'
      });
    }

    // Check monophonic voice polyphony on tracks 1-4 (NES Pulse 1, 2, Triangle, Noise)
    tracks.forEach((track, trkIdx) => {
      if (trkIdx < 4) {
        // Assume default assignment to NES monophonic voices
        const activeNotes = new Set<number>();
        let polyphonyViolations = 0;

        for (const ev of track.events) {
          if (ev.type === 'noteOn') {
            if (activeNotes.size > 0 && ev.note !== undefined) {
              polyphonyViolations++;
            }
            if (ev.note !== undefined) activeNotes.add(ev.note);
          } else if (ev.type === 'noteOff') {
            if (ev.note !== undefined) activeNotes.delete(ev.note);
          }
        }

        if (polyphonyViolations > 0) {
          warnings.push({
            severity: 'warning',
            category: 'polyphony',
            trackIndex: trkIdx,
            message: `Track ${trkIdx + 1} ("${track.name}") has ${polyphonyViolations} overlapping note events. NES APU channels are monophonic.`,
            suggestion: 'Quantize note ends to avoid unexpected hardware voice-stealing or glitches on MIDInes.'
          });
        }
      }

      // Check DPCM Bank Select CC14 on DPCM tracks (Track 9 or channel 4/5)
      const isDpcmTrack = track.name.toLowerCase().includes('dpcm') || track.name.toLowerCase().includes('drum') || trkIdx === 8;
      if (isDpcmTrack) {
        let hasCc14 = false;
        let firstNoteTick = Infinity;
        let cc14Tick = Infinity;

        for (const ev of track.events) {
          if (ev.type === 'cc' && ev.controller === 14) {
            hasCc14 = true;
            if (ev.tick < cc14Tick) cc14Tick = ev.tick;
          }
          if (ev.type === 'noteOn' && ev.tick < firstNoteTick) {
            firstNoteTick = ev.tick;
          }
        }

        if (!hasCc14 && firstNoteTick !== Infinity) {
          warnings.push({
            severity: 'info',
            category: 'bank_select',
            trackIndex: trkIdx,
            message: `DPCM Lane has notes but no CC14 Bank Select controller was detected.`,
            suggestion: 'Hardware will default to Bank 1 (CC14 = 0). Add CC14 = 0 or CC14 = 64 at tick 0.'
          });
        } else if (cc14Tick > firstNoteTick) {
          warnings.push({
            severity: 'warning',
            category: 'bank_select',
            trackIndex: trkIdx,
            message: `CC14 Bank Select occurs after first note trigger.`,
            suggestion: 'Place CC14 before tick 0 note triggers to avoid sample playback mismatch.'
          });
        }
      }

      // Check for SysEx in tracks
      const sysExCount = track.events.filter((e) => e.type === 'sysEx').length;
      if (sysExCount > 0) {
        warnings.push({
          severity: 'warning',
          category: 'sysex',
          trackIndex: trkIdx,
          message: `Track contains ${sysExCount} SysEx message(s). Unknown SysEx is quarantined by default.`,
          suggestion: 'Ensure SysEx does not overwrite hardware patches unpredictably.'
        });
      }
    });

    return warnings;
  }

  // --- Low-level byte helpers ---
  private readUint8(): number {
    return this.buffer[this.offset++];
  }

  private readUint16(): number {
    const val = (this.buffer[this.offset] << 8) | this.buffer[this.offset + 1];
    this.offset += 2;
    return val;
  }

  private readUint32(): number {
    const val =
      ((this.buffer[this.offset] << 24) >>> 0) |
      (this.buffer[this.offset + 1] << 16) |
      (this.buffer[this.offset + 2] << 8) |
      this.buffer[this.offset + 3];
    this.offset += 4;
    return val;
  }

  private readAscii(len: number): string {
    let s = '';
    for (let i = 0; i < len; i++) {
      s += String.fromCharCode(this.buffer[this.offset++]);
    }
    return s;
  }

  private readBytes(len: number): Uint8Array {
    const slice = this.buffer.slice(this.offset, this.offset + len);
    this.offset += len;
    return slice;
  }

  private readVarInt(): number {
    let result = 0;
    let byte = 0;
    do {
      byte = this.readUint8();
      result = (result << 7) | (byte & 0x7f);
    } while (byte & 0x80);
    return result;
  }
}
