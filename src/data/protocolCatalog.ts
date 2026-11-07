/**
 * Synthesizer Hardware Protocol Catalog
 * Authoritative record of MIDInes MIDI CC messages and MIDIbox SID V2 NRPN parameters.
 * Distinguishes VERIFIED, PROVISIONAL, and UNVERIFIED protocols.
 */

export interface ProtocolParameter {
  id: string;
  hardware: 'MIDInes' | 'MIDIbox SID';
  channelTarget: string; // e.g., "Ch 1 (Pulse 1)", "All Cores"
  paramName: string;
  encoding: 'cc' | 'nrpn' | 'sysex' | 'pitch_bend';
  controllerOrAddress: number; // CC number or NRPN MSB/LSB
  validRange: { min: number; max: number };
  hardwareScaleDescription: string;
  status: 'VERIFIED_PHYSICAL' | 'PROVISIONAL_DOCUMENTED' | 'INFERRED_UNVERIFIED';
  citationSource: string;
  notes: string;
}

export const PROTOCOL_CATALOG: ProtocolParameter[] = [
  // MIDInes Protocol (Wayfar 0xF00000 / MIDInes v1.1.0 manual)
  {
    id: 'midines.cc11.volume',
    hardware: 'MIDInes',
    channelTarget: 'Channels 1, 2, 4 (Pulse 1, Pulse 2, Noise)',
    paramName: 'Voice Volume / Envelope',
    encoding: 'cc',
    controllerOrAddress: 11,
    validRange: { min: 0, max: 127 },
    hardwareScaleDescription: 'Maps to 4-bit NES volume 0-15 (Math.floor(val / 8))',
    status: 'PROVISIONAL_DOCUMENTED',
    citationSource: 'MIDInes 2004/2008 manual: CC11 Expression / Volume',
    notes: 'Controls physical NES register 4-bit volume. Triangle uses linear counter on/off.'
  },
  {
    id: 'midines.cc12.fine_pitch',
    hardware: 'MIDInes',
    channelTarget: 'Channels 1, 2, 3 (Pulse 1, 2, Triangle)',
    paramName: 'Fine Pitch Detune',
    encoding: 'cc',
    controllerOrAddress: 12,
    validRange: { min: 0, max: 127 },
    hardwareScaleDescription: '0-127, center = 64 (no detune)',
    status: 'PROVISIONAL_DOCUMENTED',
    citationSource: 'MIDInes Manual 1.1 transcription on chipmusic.org',
    notes: 'Alters timer frequency register for chorusing/detuning.'
  },
  {
    id: 'midines.cc13.sweep',
    hardware: 'MIDInes',
    channelTarget: 'Channels 1, 2 (Pulse 1, Pulse 2)',
    paramName: 'Hardware Pitch Sweep Rate',
    encoding: 'cc',
    controllerOrAddress: 13,
    validRange: { min: 0, max: 127 },
    hardwareScaleDescription: 'Encodes sweep period, shift count, and direction',
    status: 'PROVISIONAL_DOCUMENTED',
    citationSource: 'MIDInes manual: CC13 Hardware Sweep Control',
    notes: 'Triggers genuine NES APU sweep unit hardware register writes ($4001, $4005).'
  },
  {
    id: 'midines.cc14.dpcm_bank',
    hardware: 'MIDInes',
    channelTarget: 'Channel 5 (DPCM)',
    paramName: 'DPCM Sample Bank Select',
    encoding: 'cc',
    controllerOrAddress: 14,
    validRange: { min: 0, max: 127 },
    hardwareScaleDescription: '0 = Bank 1 (Samples 1-128); 64 = Bank 2 (Samples 129-256)',
    status: 'PROVISIONAL_DOCUMENTED',
    citationSource: 'MIDInes manual: CC14 Bank Select for DPCM Drum Kit',
    notes: 'MUST be sent prior to note triggers to avoid playing from the previous bank.'
  },
  {
    id: 'midines.cc70.noise_mode',
    hardware: 'MIDInes',
    channelTarget: 'Channel 4 (Noise)',
    paramName: 'Noise LFSR Mode (Long vs Metallic)',
    encoding: 'cc',
    controllerOrAddress: 70,
    validRange: { min: 0, max: 127 },
    hardwareScaleDescription: '0-63 = 32767-step periodic; 64-127 = 93-step metallic loop',
    status: 'PROVISIONAL_DOCUMENTED',
    citationSource: 'MIDInes 1.1 Audiofanzine & Chipmusic.org community analysis',
    notes: 'Toggles APU $400E bit 7 (LFSR loop length).'
  },
  {
    id: 'midines.cc71.pulse_duty',
    hardware: 'MIDInes',
    channelTarget: 'Channels 1, 2 (Pulse 1, Pulse 2)',
    paramName: 'Pulse Duty Cycle',
    encoding: 'cc',
    controllerOrAddress: 71,
    validRange: { min: 0, max: 127 },
    hardwareScaleDescription: '0-31 = 12.5%, 32-63 = 25%, 64-95 = 50%, 96-127 = 75%',
    status: 'PROVISIONAL_DOCUMENTED',
    citationSource: 'MIDInes manual section 3: Timbre / Duty Selection',
    notes: 'Controls duty cycle bits in $4000 and $4004.'
  },

  // MIDIbox SID V2 Protocol (ucapps.de/midibox_sid.html)
  {
    id: 'sid.nrpn.osc1_waveform',
    hardware: 'MIDIbox SID',
    channelTarget: 'Cores 1-4 (User-configured channels)',
    paramName: 'OSC 1 Waveform',
    encoding: 'nrpn',
    controllerOrAddress: 0x0100,
    validRange: { min: 0, max: 15 },
    hardwareScaleDescription: 'Bitmask: 1=Tri, 2=Saw, 4=Pulse, 8=Noise',
    status: 'PROVISIONAL_DOCUMENTED',
    citationSource: 'ucapps.de MIDIbox SID V2 NRPN Parameter Table',
    notes: 'Selects or combines waveforms in the SID 6581/8580 voice 1 control register.'
  },
  {
    id: 'sid.nrpn.osc1_pulse_width',
    hardware: 'MIDIbox SID',
    channelTarget: 'Cores 1-4',
    paramName: 'OSC 1 Pulse Width',
    encoding: 'nrpn',
    controllerOrAddress: 0x0101,
    validRange: { min: 0, max: 4095 },
    hardwareScaleDescription: '12-bit SID register (0-4095)',
    status: 'PROVISIONAL_DOCUMENTED',
    citationSource: 'ucapps.de MIDIbox SID V2 manual: Pulse Width',
    notes: 'Produces classic C64 phasing pulse widths when modulated via LFO.'
  },
  {
    id: 'sid.nrpn.filter_cutoff',
    hardware: 'MIDIbox SID',
    channelTarget: 'Cores 1-4',
    paramName: 'Master Filter Cutoff',
    encoding: 'nrpn',
    controllerOrAddress: 0x0140,
    validRange: { min: 0, max: 2047 },
    hardwareScaleDescription: '11-bit SID filter cutoff register (0-2047)',
    status: 'PROVISIONAL_DOCUMENTED',
    citationSource: 'ucapps.de MIDIbox SID V2: Filter controls',
    notes: 'Analog filter curve varies significantly between 6581 (non-linear/dirty) and 8580 (clean/high resonance).'
  },
  {
    id: 'sid.nrpn.filter_resonance',
    hardware: 'MIDIbox SID',
    channelTarget: 'Cores 1-4',
    paramName: 'Filter Resonance',
    encoding: 'nrpn',
    controllerOrAddress: 0x0141,
    validRange: { min: 0, max: 15 },
    hardwareScaleDescription: '4-bit SID resonance register (0-15)',
    status: 'PROVISIONAL_DOCUMENTED',
    citationSource: 'ucapps.de MIDIbox SID V2 Filter table',
    notes: '8580 self-oscillates at high resonance; 6581 exhibits warm saturation.'
  },
  {
    id: 'sid.nrpn.filter_mode',
    hardware: 'MIDIbox SID',
    channelTarget: 'Cores 1-4',
    paramName: 'Filter Mode (LP, BP, HP)',
    encoding: 'nrpn',
    controllerOrAddress: 0x0142,
    validRange: { min: 0, max: 7 },
    hardwareScaleDescription: 'Bitmask: Bit 0=LowPass, Bit 1=BandPass, Bit 2=HighPass',
    status: 'PROVISIONAL_DOCUMENTED',
    citationSource: 'ucapps.de MIDIbox SID V2 filter architecture',
    notes: 'Can combine modes for notch or shelf responses.'
  },
  {
    id: 'sid.sysex.patch_dump',
    hardware: 'MIDIbox SID',
    channelTarget: 'Cores 1-4',
    paramName: 'SysEx Patch Dump / Recall',
    encoding: 'sysex',
    controllerOrAddress: 0x00,
    validRange: { min: 0, max: 255 },
    hardwareScaleDescription: 'F0 00 00 7E 46 ... F7',
    status: 'PROVISIONAL_DOCUMENTED',
    citationSource: 'MIDIbox SID V2 SysEx Implementation Guide',
    notes: 'BULK WRITE IS RESTRICTED by policy: only read/backup is allowed until physical round-trip verification.'
  }
];
