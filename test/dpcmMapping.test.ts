import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DPCM_SAMPLES_RAW,
  getSamplesForBank,
  getSampleByBankAndNote,
  filterSamples,
  categorizeSample
} from '../src/data/dpcmMapping.ts';

test('DPCM Mapping: loads exactly 256 samples', () => {
  assert.equal(DPCM_SAMPLES_RAW.length, 256);
});

test('DPCM Mapping: Bank 1 has 128 samples with CC14 = 0', () => {
  const bank1 = getSamplesForBank(1);
  assert.equal(bank1.length, 128);
  for (let i = 0; i < 128; i++) {
    assert.equal(bank1[i].bank, 1);
    assert.equal(bank1[i].midi_note, i);
    assert.equal(bank1[i].cc14_value, 0);
    assert.equal(bank1[i].midi_channel, 5);
  }
});

test('DPCM Mapping: Bank 2 has 128 samples with CC14 = 64', () => {
  const bank2 = getSamplesForBank(2);
  assert.equal(bank2.length, 128);
  for (let i = 0; i < 128; i++) {
    assert.equal(bank2[i].bank, 2);
    assert.equal(bank2[i].midi_note, i);
    assert.equal(bank2[i].cc14_value, 64);
    assert.equal(bank2[i].midi_channel, 5);
  }
});

test('DPCM Mapping: sample provenance status is preserved as inferred', () => {
  const sample0 = getSampleByBankAndNote(1, 0);
  assert.ok(sample0);
  assert.equal(sample0.mapping_status, 'inferred_from_sequential_archive_order');
  assert.equal(sample0.sample_label, 'BD');
  assert.equal(sample0.archive_track_number, 6);
});

test('DPCM Mapping: categorization and search filter work correctly', () => {
  assert.equal(categorizeSample('BRK-BD'), 'BREAKS');
  assert.equal(categorizeSample('VOX-LOL'), 'VOX');
  assert.equal(categorizeSample('PITCHED-NOISE'), 'PITCHED_NOISE');
  assert.equal(categorizeSample('BD'), 'BD');

  const kicks = filterSamples(1, 'BD', '');
  assert.ok(kicks.length > 0);

  const breaks = filterSamples(1, 'BREAKS', 'GHOST');
  assert.ok(breaks.length > 0);
  assert.ok(breaks[0].sample_label.includes('GHOST'));
});
