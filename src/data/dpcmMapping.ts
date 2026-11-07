/**
 * MIDInes DPCM 256-Sample Mapping Database
 * Source: Nullsleep - EXTFIELD 001 DPCM Drums.zip
 *
 * PROVENANCE NOTE (from midines_dpcm_mapping_notes.md):
 * Track numbers 06-133 are Bank 1 (128 samples, CC14 = 0).
 * Track numbers 134-261 are Bank 2 (128 samples, CC14 = 64).
 * IMPORTANT: This mapping is INFERRED from sequential archive ordering,
 * NOT hardware-verified against physical MIDInes cartridge test notes yet.
 */

import { DpcmSampleEntry } from '../types/index.ts';

// Categories for UI filtering
export type DpcmCategory =
  | 'ALL'
  | 'BD'
  | 'SD'
  | 'CH'
  | 'OH'
  | 'CLAP'
  | 'TOM'
  | 'CRASH'
  | 'RS'
  | 'CB'
  | 'BREAKS'
  | 'VOX'
  | 'SFX'
  | 'PITCHED_NOISE';

// Raw mapping table for the 256 samples
export const DPCM_SAMPLES_RAW: DpcmSampleEntry[] = [];

// Helper to derive note name
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function getMidiNoteName(midiNote: number): string {
  const octave = Math.floor(midiNote / 12) - 1;
  const name = NOTE_NAMES[midiNote % 12];
  return `${name}${octave}`;
}

// Generate Bank 1 (128 samples: tracks 6 to 133)
// Labels from the user provided CSV & JSON
const BANK_1_LABELS: string[] = [
  'BD','BD','BD','BD','BD','BD','SD','SD','SD','SD','SD','SD','OH','OH','CH','CH',
  'CLAP','TOM','BD','BD','OH','CH','BD','SD','CLAP','CLAP','OH','CRASH','SD','SD','TOM','TOM',
  'SD','SD','SD','SD','BD','BD','CB','CH','CLAP','CLAVES','CRASH','TOM','SHAKER','TOM','TOM','TOM',
  'TOM','TOM','RS','SD','RS','CB','CRASH','CH','OH','BD','CRASH','RS','SD','SD','OH','CH',
  'TOM','TOM','BD','BD','BD','TOM','SD','TOM','TOM','CH','OH','CLAP','CLAVES','CRASH','TOM','TOM',
  'TOM','CRASH','CRASH','CH','CH','SFX','BRK-BD','BRK-OH','BRK-SD','BRK-CH','BRK-GHOST-SD','BRK-BD','BRK-GHOST-BD','BRK-SD','BRK-CH','BRK-GHOST-SD',
  'BRK-CH','BRK-GHOST-SD','BRK-CRASH','BRK-SD','BRK-BD+CRASH','BRK-OH','BRK-BD+CRASH','BRK-OH','BRK-OH','BRK-VOX','BRK-BD','BRK-BD','BRK-SD','BRK-SD','BRK-TOM','BRK-TOM',
  'BRK-BD+CRASH','BRK-OH','BRK-OH','BRK-BD','BRK-OH','BRK-SD','BRK-CH','BRK-BD','BRK-SD+CH','BRK-SD','BRK-GHOST-SD','BRK-CH','BRK-GHOST-SD','BRK-BD','BRK-GHOST-SD','BRK-GHOST-SD'
];

// Generate Bank 2 (128 samples: tracks 134 to 261)
const BANK_2_LABELS: string[] = [
  'SD','SD','BD+CRASH','BD+CRASH','SD','BD+HAT','BD+HAT','BD+HAT','BD','SD','BD','BD','BD','SD','BD','BD',
  'BD','SD','CLAP','OH','SFX','SD','VOX','SD','VOX','VOX-UHHUH','VOX','VOX-LOL','VOX','VOX','VOX-SISTER','VOX-MASTERY',
  'VOX-TIME','VOX-RIGHT','VOX-LAUGH','VOX-LAUGH','SFX','VOX-FILM','VOX-CAMERA','VOX','VOX','SFX','SFX','SFX','SFX','SFX','SFX','SFX',
  'SFX','SFX','VOX','VOX','VOX','VOX','VOX','SFX','SFX','SFX','SFX','SFX','SFX','SFX','CH','SFX',
  'SFX','SFX','SFX','SFX','SFX','SFX','SFX','SFX','SFX','SFX','SFX','SFX','SFX','SFX','SFX','SFX',
  'SFX','VOX-YES','VOX-CHECKMATE','VOX-LAUGH','VOX','VOX-EARTH','VOX-CAPTAIN','SFX','SFX','VOX-WHAT','VOX-EXHIBITION','VOX-NEED','VOX-EMOTIONAL','VOX-CONTENT','VOX-FEEL','PITCHED-NOISE',
  'PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE',
  'PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE','PITCHED-NOISE'
];

for (let i = 0; i < 128; i++) {
  const trackNum = i + 6;
  const trackStr = trackNum < 10 ? `0${trackNum}` : `${trackNum}`;
  const label = BANK_1_LABELS[i] || 'SAMPLE';
  DPCM_SAMPLES_RAW.push({
    bank: 1,
    midi_channel: 5,
    midi_note: i,
    note_name: getMidiNoteName(i),
    cc14_value: 0,
    sample_label: label,
    archive_track_number: trackNum,
    archive_filename: `Nullsleep - EXTFIELD 001 DPCM Drums - ${trackStr} BANK1-${label}.ogg`,
    mapping_status: 'inferred_from_sequential_archive_order'
  });
}

for (let i = 0; i < 128; i++) {
  const trackNum = i + 134;
  const label = BANK_2_LABELS[i] || 'SAMPLE';
  DPCM_SAMPLES_RAW.push({
    bank: 2,
    midi_channel: 5,
    midi_note: i,
    note_name: getMidiNoteName(i),
    cc14_value: 64,
    sample_label: label,
    archive_track_number: trackNum,
    archive_filename: `Nullsleep - EXTFIELD 001 DPCM Drums - ${trackNum} BANK2-${label}.ogg`,
    mapping_status: 'inferred_from_sequential_archive_order'
  });
}

export function getSamplesForBank(bank: 1 | 2): DpcmSampleEntry[] {
  return DPCM_SAMPLES_RAW.filter((s) => s.bank === bank);
}

export function getSampleByBankAndNote(bank: 1 | 2, note: number): DpcmSampleEntry | undefined {
  return DPCM_SAMPLES_RAW.find((s) => s.bank === bank && s.midi_note === note);
}

export function categorizeSample(label: string): DpcmCategory {
  if (label.startsWith('BRK-')) return 'BREAKS';
  if (label.startsWith('VOX')) return 'VOX';
  if (label.startsWith('PITCHED-NOISE')) return 'PITCHED_NOISE';
  if (label.includes('BD')) return 'BD';
  if (label.includes('SD')) return 'SD';
  if (label.includes('CH')) return 'CH';
  if (label.includes('OH')) return 'OH';
  if (label.includes('CLAP')) return 'CLAP';
  if (label.includes('TOM')) return 'TOM';
  if (label.includes('CRASH')) return 'CRASH';
  if (label.includes('RS')) return 'RS';
  if (label.includes('CB')) return 'CB';
  if (label.includes('SFX')) return 'SFX';
  return 'ALL';
}

export function filterSamples(
  bank: 1 | 2 | 'BOTH',
  category: DpcmCategory,
  query: string
): DpcmSampleEntry[] {
  let list = DPCM_SAMPLES_RAW;
  if (bank !== 'BOTH') {
    list = list.filter((s) => s.bank === bank);
  }
  if (category !== 'ALL') {
    list = list.filter((s) => categorizeSample(s.sample_label) === category);
  }
  if (query.trim()) {
    const q = query.toLowerCase();
    list = list.filter(
      (s) =>
        s.sample_label.toLowerCase().includes(q) ||
        s.note_name.toLowerCase().includes(q) ||
        s.midi_note.toString() === q ||
        s.archive_filename.toLowerCase().includes(q)
    );
  }
  return list;
}
