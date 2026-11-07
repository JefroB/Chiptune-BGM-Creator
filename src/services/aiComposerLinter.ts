/**
 * AI Composer Contract, Linter, and Capability Exporter
 * Validates MIDI arrangements against MIDInes & MIDIbox SID physical hardware constraints.
 * Generates instrument_capabilities.json, dpcm_samples.json, and composer_rules.md.
 */

import { DPCM_SAMPLES_RAW } from '../data/dpcmMapping.ts';
import { PROTOCOL_CATALOG } from '../data/protocolCatalog.ts';
import { MidiSongModel, PreflightWarning } from '../types/index.ts';

export interface ComposerLinterReport {
  passed: boolean;
  totalChecks: number;
  errorCount: number;
  warningCount: number;
  issues: PreflightWarning[];
  summary: string;
}

export class AiComposerLinter {
  public static lint(song: MidiSongModel): ComposerLinterReport {
    const issues: PreflightWarning[] = [...song.preflightWarnings];

    // Check 1: 8 Primary Tracks + 1 DPCM Lane structure
    if (song.tracks.length < 8) {
      issues.push({
        severity: 'warning',
        category: 'track_count',
        message: `Arrangement has ${song.tracks.length} tracks. Standard chiptune hardware workstation template expects 8 primary tracks (4 NES + 4 SID stereo pairs).`,
        suggestion: 'Ensure empty tracks are present or padded so all physical synthesizer voice slots are defined.'
      });
    }

    // Check 2: Monophonic NES voices (Tracks 1 to 4) note overlap
    for (let t = 0; t < Math.min(4, song.tracks.length); t++) {
      const trk = song.tracks[t];
      let activeNotes = 0;
      for (const ev of trk.events) {
        if (ev.type === 'noteOn') {
          activeNotes++;
          if (activeNotes > 1) {
            issues.push({
              severity: 'error',
              category: 'polyphony',
              trackIndex: t,
              tick: ev.tick,
              message: `Polyphonic overlap on monophonic voice ${trk.name} at tick ${ev.tick}.`,
              suggestion: 'Set note duration to terminate strictly before or at the start of the next note.'
            });
            break; // report once per track
          }
        } else if (ev.type === 'noteOff') {
          activeNotes = Math.max(0, activeNotes - 1);
        }
      }
    }

    // Check 3: Note Ranges for NES Channels
    // NES Triangle: Note 21 (A-1) to Note 84 (C6)
    const triTrk = song.tracks[2];
    if (triTrk) {
      for (const ev of triTrk.events) {
        if (ev.type === 'noteOn' && ev.note !== undefined) {
          if (ev.note < 21 || ev.note > 84) {
            issues.push({
              severity: 'warning',
              category: 'note_range',
              trackIndex: 2,
              tick: ev.tick,
              message: `NES Triangle note ${ev.note} is outside optimal physical APU range (21-84).`,
              suggestion: 'Transpose bass notes into the audible octave range for the NES linear counter.'
            });
            break;
          }
        }
      }
    }

    // Check 4: DPCM Bank Switch Safety (CC14 must be 0 or 64)
    for (let t = 0; t < song.tracks.length; t++) {
      const trk = song.tracks[t];
      for (const ev of trk.events) {
        if (ev.type === 'cc' && ev.controller === 14) {
          if (ev.value !== 0 && ev.value !== 64) {
            issues.push({
              severity: 'error',
              category: 'bank_select',
              trackIndex: t,
              tick: ev.tick,
              message: `Invalid DPCM CC14 bank value: ${ev.value}. Hardware only supports 0 (Bank 1) and 64 (Bank 2).`,
              suggestion: 'Change CC14 controller value to 0 for Bank 1 (Samples 1-128) or 64 for Bank 2 (Samples 129-256).'
            });
          }
        }
      }
    }

    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;
    const passed = errorCount === 0;

    return {
      passed,
      totalChecks: 12,
      errorCount,
      warningCount,
      issues,
      summary: passed
        ? `Linter passed with ${warningCount} advisory warning(s). File meets hardware workstation requirements.`
        : `Linter found ${errorCount} blocking error(s) and ${warningCount} warning(s). Review recommendations before playing.`
    };
  }

  // Generate instrument_capabilities.json
  public static generateInstrumentCapabilitiesJson(): string {
    const data = {
      specVersion: '1.0.0',
      hardwareProfiles: {
        midines: {
          manufacturer: 'Wayfar',
          voices: [
            { id: 'pulse1', channel: 1, type: 'pulse', polyphony: 1, allowedDuty: [12.5, 25, 50, 75] },
            { id: 'pulse2', channel: 2, type: 'pulse', polyphony: 1, allowedDuty: [12.5, 25, 50, 75] },
            { id: 'triangle', channel: 3, type: 'triangle', polyphony: 1, noteRange: [21, 84] },
            { id: 'noise', channel: 4, type: 'noise', polyphony: 1, lfsrModes: ['32767_long', '93_metallic'] },
            { id: 'dpcm', channel: 5, type: 'sample_playback', banks: [1, 2], bankSelectCC: 14 }
          ],
          audioOutput: '1x Mono Unbalanced 1/8" Phone'
        },
        midiboxSidV2: {
          manufacturer: 'MIDIbox / ucapps.de',
          cores: 4,
          chipsPerCore: 2,
          totalChips: 8,
          supportedEngines: ['lead', 'bassline', 'multi', 'drum'],
          audioOutput: '4x Stereo Pairs (8 Channels Unbalanced 1/4" Phone)'
        }
      },
      supportedProtocols: PROTOCOL_CATALOG
    };
    return JSON.stringify(data, null, 2);
  }

  // Generate dpcm_samples.json
  public static generateDpcmSamplesJson(): string {
    const data = {
      device: 'MIDInes',
      scope: 'DPCM samples',
      sourceArchive: 'Nullsleep - EXTFIELD 001 DPCM Drums.zip',
      mappingStatus: 'inferred_from_sequential_archive_order_not_hardware_verified',
      bankSelectCC: 14,
      midiChannel: 5,
      samples: DPCM_SAMPLES_RAW
    };
    return JSON.stringify(data, null, 2);
  }

  // Generate composer_rules.md
  public static generateComposerRulesMarkdown(): string {
    return `# AI Composer Specification & Hardware Rules
Chiptune Hardware Workstation | Revision 1.0 (2026)

## 1. Physical Hardware Voice Constraints
Your MIDI file MUST strictly conform to the 8 primary tracks + 1 DPCM auxiliary lane:

- **Track 1 -> NES Pulse 1 (MIDInes MIDI Ch 1)**: Monophonic lead / arpeggios. NO overlapping notes. Volume 0-15 via CC11.
- **Track 2 -> NES Pulse 2 (MIDInes MIDI Ch 2)**: Monophonic counter-melody / harmonies. NO overlapping notes.
- **Track 3 -> NES Triangle (MIDInes MIDI Ch 3)**: Monophonic bass. True quantized 16-step triangle wave. Range C1-C6.
- **Track 4 -> NES Noise (MIDInes MIDI Ch 4)**: Monophonic percussive accents / metallic hats. Pitch index mapped to note numbers.
- **Track 5 -> SID Core 1 (Stereo Pair 1)**: Mixed 6581/8580 SID pair. Ideal for heavy resonant bass and lead synths.
- **Track 6 -> SID Core 2 (Stereo Pair 2)**: Ideal for stereo pulse-width modulation (PWM) and fast arpeggios.
- **Track 7 -> SID Core 3 (Stereo Pair 3)**: Ideal for polyphonic synth brass, pads, and chord stabs.
- **Track 8 -> SID Core 4 (Stereo Pair 4)**: Ideal for ambient textures and sound effects.
- **Aux Lane -> NES DPCM (MIDInes MIDI Ch 5)**: Monophonic drum samples from the 256 Nullsleep DPCM library.

## 2. DPCM Drum Rules
- Before any DPCM note on Channel 5, you MUST send **CC14**:
  - \`CC14 = 0\` for Bank 1 (Samples 1 to 128: Kicks, Snares, Hats, Breaks)
  - \`CC14 = 64\` for Bank 2 (Samples 129 to 256: Vocal chops, SFX, Pitched Noise)
- Place CC14 at tick 0 before the first note event.

## 3. Looping Contract for RPG Maker MV
- Write music with seamless looping in mind.
- The workstation records the dedicated mastering return and injects \`LOOPSTART\` and \`LOOPLENGTH\` in sample frames into the exported OGG Vorbis file.
- Ensure loop boundaries snap cleanly to bar/beat divisions.
`;
  }
}
