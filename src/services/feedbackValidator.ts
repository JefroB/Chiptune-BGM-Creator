/**
 * Routing Feedback Interlock Validator
 * Detects circular audio loops between Master Return, Master Send, and External FX loops.
 */

import { RoutingConfig } from '../types/index.ts';

export function validateRoutingForFeedbackLoops(routing: RoutingConfig): {
  hasFeedback: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check 1: Master Return connected to Master Send
  if (
    routing.masterReturn.leftId === routing.masterSend.leftId ||
    routing.masterReturn.rightId === routing.masterSend.rightId
  ) {
    warnings.push('CRITICAL: Master Return is routed back to Master Send output! Potential acoustic/digital screech feedback loop.');
  }

  // Check 2: Master Return used as FX Return
  if (
    routing.masterReturn.leftId === routing.effectA.returnInput.leftId ||
    routing.masterReturn.leftId === routing.effectB.returnInput.leftId
  ) {
    warnings.push('Master Return channel shares an input with an External FX Return. Dedicated mastering return must remain isolated.');
  }

  // Check 3: FX Send output overlaps Master Send output
  if (
    routing.effectA.sendOutput.leftId === routing.masterSend.leftId ||
    routing.effectB.sendOutput.leftId === routing.masterSend.leftId
  ) {
    warnings.push('External FX Send shares output channels with the Master Send output pair.');
  }

  return {
    hasFeedback: warnings.length > 0,
    warnings
  };
}
