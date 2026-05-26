export interface BitrixAutomationSystemEffectsInput {
  bitrixStageChanged: boolean;
}

export interface BitrixAutomationSystemEffects {
  backendWorkflowMayHaveExecuted: boolean;
  backendSideEffectsMayHaveOccurred: boolean;
  bitrixAutomationExpected: boolean;
  n8nTriggerExpected: boolean;
}

export function deriveBitrixAutomationSystemEffects(
  input: BitrixAutomationSystemEffectsInput,
): BitrixAutomationSystemEffects {
  const afterStageChange = input.bitrixStageChanged;

  return {
    bitrixAutomationExpected: true,
    n8nTriggerExpected: true,
    backendWorkflowMayHaveExecuted: afterStageChange,
    backendSideEffectsMayHaveOccurred: afterStageChange,
  };
}
