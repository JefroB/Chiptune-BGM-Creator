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
  controllerOrAddress: number; // CC number or NRPN address
  nrpnMsb?: number;
  nrpnLsb?: number;
  paramSizeBits: number;
  engineApplicability: ('lead' | 'bassline' | 'multi' | 'drum' | 'all')[];
  validRange: { min: number; max: number };
  hardwareScaleDescription: string;
  wireTestVector?: number[];
  status: 'VERIFIED_PHYSICAL' | 'PROVISIONAL_DOCUMENTED' | 'INFERRED_UNVERIFIED';
  citationSource: string;
  notes: string;
}

export const PROTOCOL_CATALOG: ProtocolParameter[] = [
  // --- MIDInes Protocol (Wayfar 0xF00000 / MIDInes v1.1.0 manual) ---
  {
    id: 'midines.cc11.volume',
    hardware: 'MIDInes',
    channelTarget: 'Channels 1, 2, 4 (Pulse 1, Pulse 2, Noise)',
    paramName: 'Voice Volume / Envelope',
    encoding: 'cc',
    controllerOrAddress: 11,
    paramSizeBits: 4,
    engineApplicability: ['all'],
    validRange: { min: 0, max: 127 },
    hardwareScaleDescription: 'Maps to 4-bit NES volume 0-15 (Math.floor(val / 8))',
    wireTestVector: [0xb0, 11, 127],
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
    paramSizeBits: 7,
    engineApplicability: ['all'],
    validRange: { min: 0, max: 127 },
    hardwareScaleDescription: '0-127, center = 64 (no detune)',
    wireTestVector: [0xb0, 12, 64],
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
    paramSizeBits: 7,
    engineApplicability: ['all'],
    validRange: { min: 0, max: 127 },
    hardwareScaleDescription: 'Encodes sweep period, shift count, and direction',
    wireTestVector: [0xb0, 13, 32],
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
    paramSizeBits: 7,
    engineApplicability: ['all'],
    validRange: { min: 0, max: 127 },
    hardwareScaleDescription: '0 = Bank 1 (Samples 1-128); 64 = Bank 2 (Samples 129-256)',
    wireTestVector: [0xb4, 14, 0],
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
    paramSizeBits: 1,
    engineApplicability: ['all'],
    validRange: { min: 0, max: 127 },
    hardwareScaleDescription: '0-63 = 32767-step periodic; 64-127 = 93-step metallic loop',
    wireTestVector: [0xb3, 70, 0],
    status: 'PROVISIONAL_DOCUMENTED',
    citationSource: 'MIDInes 1.1 Audiofanzine & Chipmusic.org community analysis',
    notes: 'Toggles APU $400E bit 7 (LFSR loop length).'
  },
  {
    id: 'midines.cc71.duty_cycle',
    hardware: 'MIDInes',
    channelTarget: 'Channels 1, 2 (Pulse 1, Pulse 2)',
    paramName: 'Pulse Duty Cycle',
    encoding: 'cc',
    controllerOrAddress: 71,
    paramSizeBits: 2,
    engineApplicability: ['all'],
    validRange: { min: 0, max: 127 },
    hardwareScaleDescription: '0-31 = 12.5%, 32-63 = 25%, 64-95 = 50%, 96-127 = 75%',
    wireTestVector: [0xb0, 71, 64],
    status: 'PROVISIONAL_DOCUMENTED',
    citationSource: 'MIDInes manual section 3: Timbre / Duty Selection',
    notes: 'Controls duty cycle bits in $4000 and $4004.'
  },

  // --- MIDIbox SID V2 Protocol (ucapps.de/midibox_sid_manual.html) ---
  {
    id: 'sid.nrpn.osc1_waveform',
    hardware: 'MIDIbox SID',
    channelTarget: 'Cores 1-4',
    paramName: 'OSC 1 Waveform Bitmask',
    encoding: 'nrpn',
    controllerOrAddress: 0x0100,
    nrpnMsb: 0x02,
    nrpnLsb: 0x00,
    paramSizeBits: 4,
    engineApplicability: ['lead', 'multi'],
    validRange: { min: 0, max: 15 },
    hardwareScaleDescription: 'Bitmask: 1=Tri, 2=Saw, 4=Pulse, 8=Noise',
    wireTestVector: [0xb5, 0x63, 0x02, 0xb5, 0x62, 0x00, 0xb5, 0x06, 0x00, 0xb5, 0x26, 0x02],
    status: 'PROVISIONAL_DOCUMENTED',
    citationSource: 'ucapps.de MIDIbox SID V2 NRPN Parameter Table',
    notes: 'Selects or combines waveforms in the SID 6581/8580 voice 1 control register.'
  },
  {
    id: 'sid.nrpn.osc1_pulse_width',
    hardware: 'MIDIbox SID',
    channelTarget: 'Cores 1-4',
    paramName: 'OSC 1 Pulse Width (12-bit)',
    encoding: 'nrpn',
    controllerOrAddress: 0x0101,
    nrpnMsb: 0x02,
    nrpnLsb: 0x01,
    paramSizeBits: 12,
    engineApplicability: ['lead', 'bassline', 'multi'],
    validRange: { min: 0, max: 4095 },
    hardwareScaleDescription: '12-bit SID register (0-4095)',
    wireTestVector: [0xb5, 0x63, 0x02, 0xb5, 0x62, 0x01, 0xb5, 0x06, 0x10, 0xb5, 0x26, 0x00],
    status: 'PROVISIONAL_DOCUMENTED',
    citationSource: 'ucapps.de MIDIbox SID V2 manual: Pulse Width',
    notes: 'Produces classic C64 phasing pulse widths when modulated via LFO.'
  },
  {
    id: 'sid.nrpn.filter_cutoff',
    hardware: 'MIDIbox SID',
    channelTarget: 'Cores 1-4',
    paramName: 'Master Filter Cutoff (11-bit)',
    encoding: 'nrpn',
    controllerOrAddress: 0x0140,
    nrpnMsb: 0x02,
    nrpnLsb: 0x40,
    paramSizeBits: 11,
    engineApplicability: ['lead', 'bassline', 'multi', 'drum'],
    validRange: { min: 0, max: 2047 },
    hardwareScaleDescription: '11-bit SID filter cutoff register (0-2047)',
    wireTestVector: [0xb5, 0x63, 0x02, 0xb5, 0x62, 0x40, 0xb5, 0x06, 0x0a, 0xb5, 0x26, 0x78],
    status: 'PROVISIONAL_DOCUMENTED',
    citationSource: 'ucapps.de MIDIbox SID V2: Filter controls',
    notes: 'Analog filter curve varies significantly between 6581 (non-linear/dirty) and 8580 (clean/high resonance).'
  },
  {
    id: 'sid.nrpn.filter_resonance',
    hardware: 'MIDIbox SID',
    channelTarget: 'Cores 1-4',
    paramName: 'Filter Resonance (4-bit)',
    encoding: 'nrpn',
    controllerOrAddress: 0x0141,
    nrpnMsb: 0x02,
    nrpnLsb: 0x41,
    paramSizeBits: 4,
    engineApplicability: ['lead', 'bassline', 'multi', 'drum'],
    validRange: { min: 0, max: 15 },
    hardwareScaleDescription: '4-bit SID resonance register (0-15)',
    wireTestVector: [0xb5, 0x63, 0x02, 0xb5, 0x62, 0x41, 0xb5, 0x06, 0x00, 0xb5, 0x26, 0x09],
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
    nrpnMsb: 0x02,
    nrpnLsb: 0x42,
    paramSizeBits: 3,
    engineApplicability: ['lead', 'bassline', 'multi'],
    validRange: { min: 0, max: 7 },
    hardwareScaleDescription: 'Bitmask: Bit 0=LowPass, Bit 1=BandPass, Bit 2=HighPass',
    wireTestVector: [0xb5, 0x63, 0x02, 0xb5, 0x62, 0x42, 0xb5, 0x06, 0x00, 0xb5, 0x26, 0x01],
    status: 'PROVISIONAL_DOCUMENTED',
    citationSource: 'ucapps.de MIDIbox SID V2 filter architecture',
    notes: 'Can combine modes for notch or shelf responses.'
  },
  {
    id: 'sid.nrpn.bassline_accent',
    hardware: 'MIDIbox SID',
    channelTarget: 'Core 1 (Bassline Engine)',
    paramName: 'TB-303 Accent Amount',
    encoding: 'nrpn',
    controllerOrAddress: 0x0200,
    nrpnMsb: 0x04,
    nrpnLsb: 0x00,
    paramSizeBits: 7,
    engineApplicability: ['bassline'],
    validRange: { min: 0, max: 127 },
    hardwareScaleDescription: '0-127 linear accent dynamic scaling',
    wireTestVector: [0xb5, 0x63, 0x04, 0xb5, 0x62, 0x00, 0xb5, 0x06, 0x00, 0xb5, 0x26, 0x50],
    status: 'PROVISIONAL_DOCUMENTED',
    citationSource: 'ucapps.de/midibox_sid_manual_b.html',
    notes: 'Scales envelope modulation depth on accented 16-step sequencer pattern notes.'
  },
  {
    id: 'sid.sysex.patch_read',
    hardware: 'MIDIbox SID',
    channelTarget: 'Cores 1-4',
    paramName: 'SysEx Read Patch Request',
    encoding: 'sysex',
    controllerOrAddress: 0x01,
    paramSizeBits: 8,
    engineApplicability: ['all'],
    validRange: { min: 0, max: 255 },
    hardwareScaleDescription: 'F0 00 00 7E 46 <dev> 01 <core> <bank> <patch> F7',
    wireTestVector: [0xf0, 0x00, 0x00, 0x7e, 0x46, 0x00, 0x01, 0x00, 0x00, 0x00, 0xf7],
    status: 'PROVISIONAL_DOCUMENTED',
    citationSource: 'MIDIbox SID V2 SysEx Implementation Guide',
    notes: 'Requests a full 256-byte patch dump from the specified core and BankStick location.'
  },
  {
    id: 'sid.sysex.patch_write',
    hardware: 'MIDIbox SID',
    channelTarget: 'Cores 1-4',
    paramName: 'SysEx Patch Write Dump',
    encoding: 'sysex',
    controllerOrAddress: 0x02,
    paramSizeBits: 8,
    engineApplicability: ['all'],
    validRange: { min: 0, max: 255 },
    hardwareScaleDescription: 'F0 00 00 7E 46 <dev> 02 <core> <bank> <patch> ... F7',
    wireTestVector: [0xf0, 0x00, 0x00, 0x7e, 0x46, 0x00, 0x02, 0x00, 0x00, 0x00, 0x4d, 0x42, 0x53, 0x32, 0xf7],
    status: 'PROVISIONAL_DOCUMENTED',
    citationSource: 'MIDIbox SID V2 SysEx Implementation Guide',
    notes: 'Transmits complete 256-byte patch payload into core shadow buffer or BankStick.'
  }
];
