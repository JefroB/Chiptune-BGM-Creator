# MIDInes DPCM 256-sample archive map

Source: user-supplied Nullsleep - EXTFIELD 001 DPCM Drums.zip.

## Finding

The archive has 262 entries: three demos, two bank-wide slice recordings, 256 individually labeled samples, and cover art. Track numbers 06–133 are Bank 1 (128 samples); 134–261 are Bank 2 (128 samples). The apparent 129-per-bank count includes each bank’s SLICE128 recording.

## Mapping hypothesis

Assuming the 128 individual sample files in each bank were exported in ascending MIDI note order, Bank 1 note = archive track number - 6; Bank 2 note = archive track number - 134. MIDI channel 5 and CC14 values 0 / 64 are based on the previously identified manual information, not independently validated from the audio archive.

## Verification required

The ZIP itself does not explicitly state MIDI note numbers. Therefore this mapping is **inferred, not hardware-verified**. Audition notes 0, 1, 36, 60, 127 in each bank and compare with corresponding individual recordings. If any offset or order difference appears, update the map before using it for automated composition.

## Files

- `midines_dpcm_256_mapping.csv`: one row per sample, useful for browsing and importing.
- `midines_dpcm_256_mapping.json`: machine-readable mapping for the AI composer and recording workstation.

## Labels

Labels reproduce the source archive filenames. For example BD = bass drum, SD = snare drum, CH = closed hat, OH = open hat. Labels are not expanded to unsupported specific hardware model names.
