import test from 'node:test';
import assert from 'node:assert/strict';
import { RoutingConfig } from '../src/types/index.ts';
import { validateRoutingForFeedbackLoops } from '../src/services/feedbackValidator.ts';

test('Mixer Routing: default configuration has no feedback loops', () => {
  const safeRouting: RoutingConfig = {
    nesInput: { kind: 'mono', channelId: 'in_1' },
    sidInputs: [
      { kind: 'stereo', leftId: 'in_2', rightId: 'in_3' },
      { kind: 'stereo', leftId: 'in_4', rightId: 'in_5' },
      { kind: 'stereo', leftId: 'in_6', rightId: 'in_7' },
      { kind: 'stereo', leftId: 'in_8', rightId: 'in_9' }
    ],
    effectA: {
      sendOutput: { leftId: 'out_3', rightId: 'out_4' },
      returnInput: { kind: 'stereo', leftId: 'in_10', rightId: 'in_11' }
    },
    effectB: {
      sendOutput: { leftId: 'out_5', rightId: 'out_6' },
      returnInput: { kind: 'stereo', leftId: 'in_12', rightId: 'in_13' }
    },
    masterSend: { leftId: 'out_1', rightId: 'out_2' },
    masterReturn: { kind: 'stereo', leftId: 'in_14', rightId: 'in_15' }
  };

  const result = validateRoutingForFeedbackLoops(safeRouting);
  assert.equal(result.hasFeedback, false);
  assert.equal(result.warnings.length, 0);
});

test('Mixer Routing: detects dangerous feedback loop when master return is looped into master send', () => {
  const unsafeRouting: RoutingConfig = {
    nesInput: { kind: 'mono', channelId: 'in_1' },
    sidInputs: [
      { kind: 'stereo', leftId: 'in_2', rightId: 'in_3' },
      { kind: 'stereo', leftId: 'in_4', rightId: 'in_5' },
      { kind: 'stereo', leftId: 'in_6', rightId: 'in_7' },
      { kind: 'stereo', leftId: 'in_8', rightId: 'in_9' }
    ],
    effectA: {
      sendOutput: { leftId: 'out_3', rightId: 'out_4' },
      returnInput: { kind: 'stereo', leftId: 'in_10', rightId: 'in_11' }
    },
    effectB: {
      sendOutput: { leftId: 'out_5', rightId: 'out_6' },
      returnInput: { kind: 'stereo', leftId: 'in_12', rightId: 'in_13' }
    },
    masterSend: { leftId: 'out_1', rightId: 'out_2' },
    masterReturn: { kind: 'stereo', leftId: 'out_1', rightId: 'out_2' } // DANGEROUS!
  };

  const result = validateRoutingForFeedbackLoops(unsafeRouting);
  assert.equal(result.hasFeedback, true);
  assert.ok(result.warnings[0].includes('CRITICAL'));
});
