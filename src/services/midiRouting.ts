/**
 * MIDI Track to Hardware Synthesizer Voice Route Mapper
 * Maps SMF tracks to MIDInes NES APU channels and MIDIbox SID V2 cores,
 * excluding non-content conductor tracks without track index drift.
 */

import { MidiRoute, MidiSongModel, VoiceId } from '../types/index.ts';

export const DEFAULT_VOICE_TARGETS: Array<{ id: VoiceId; defaultName: string; channel: number; port: string }> = [
  { id: 'nes.pulse1', defaultName: 'NES Pulse 1 (Lead Arp)', channel: 1, port: 'port_a' },
  { id: 'nes.pulse2', defaultName: 'NES Pulse 2 (Counter Melody)', channel: 2, port: 'port_a' },
  { id: 'nes.triangle', defaultName: 'NES Triangle (Walking Bass)', channel: 3, port: 'port_a' },
  { id: 'nes.noise', defaultName: 'NES Noise (Percussion / Hats)', channel: 4, port: 'port_a' },
  { id: 'sid.core1', defaultName: 'SID Core 1 (Heavy 6581 Bass)', channel: 6, port: 'port_b' },
  { id: 'sid.core2', defaultName: 'SID Core 2 (Stereo PWM Arp)', channel: 7, port: 'port_b' },
  { id: 'sid.core3', defaultName: 'SID Core 3 (Poly Brass)', channel: 8, port: 'port_b' },
  { id: 'sid.core4', defaultName: 'SID Core 4 (Ambient Pad)', channel: 9, port: 'port_b' },
  { id: 'nes.dpcm', defaultName: 'NES DPCM Aux (256 Drum Kit)', channel: 5, port: 'port_a' }
];

export function createRoutesForSong(song: MidiSongModel): MidiRoute[] {
  // Exclude conductor / tempo tracks with no playable note events
  const contentTracks = song.tracks.filter(t => !t.isConductor && t.noteCount > 0);

  if (contentTracks.length === 0) {
    return song.tracks.map((t, i) => ({
      trackIndex: t.index,
      trackName: t.name,
      voiceId: DEFAULT_VOICE_TARGETS[i % DEFAULT_VOICE_TARGETS.length].id,
      outputPortId: DEFAULT_VOICE_TARGETS[i % DEFAULT_VOICE_TARGETS.length].port,
      midiChannel: DEFAULT_VOICE_TARGETS[i % DEFAULT_VOICE_TARGETS.length].channel,
      muted: false,
      soloed: false
    }));
  }

  return contentTracks.map((trk, i) => {
    const lowerName = trk.name.toLowerCase();
    let assigned = DEFAULT_VOICE_TARGETS[Math.min(i, DEFAULT_VOICE_TARGETS.length - 1)];

    if (lowerName.includes('dpcm') || lowerName.includes('drum')) {
      assigned = DEFAULT_VOICE_TARGETS[8];
    } else if (lowerName.includes('pulse 1') || lowerName.includes('lead')) {
      assigned = DEFAULT_VOICE_TARGETS[0];
    } else if (lowerName.includes('pulse 2')) {
      assigned = DEFAULT_VOICE_TARGETS[1];
    } else if (lowerName.includes('tri') || lowerName.includes('walking bass')) {
      assigned = DEFAULT_VOICE_TARGETS[2];
    } else if (lowerName.includes('noise') || lowerName.includes('hat')) {
      assigned = DEFAULT_VOICE_TARGETS[3];
    } else if (lowerName.includes('sid 1') || lowerName.includes('core 1') || lowerName.includes('heavy bass')) {
      assigned = DEFAULT_VOICE_TARGETS[4];
    } else if (lowerName.includes('sid 2') || lowerName.includes('core 2')) {
      assigned = DEFAULT_VOICE_TARGETS[5];
    } else if (lowerName.includes('sid 3') || lowerName.includes('core 3') || lowerName.includes('brass')) {
      assigned = DEFAULT_VOICE_TARGETS[6];
    } else if (lowerName.includes('sid 4') || lowerName.includes('core 4') || lowerName.includes('ambient')) {
      assigned = DEFAULT_VOICE_TARGETS[7];
    }

    return {
      trackIndex: trk.index,
      trackName: trk.name,
      voiceId: assigned.id,
      outputPortId: assigned.port,
      midiChannel: assigned.channel,
      muted: false,
      soloed: false
    };
  });
}
