import { resolveLiveTestScenario } from './scenario-registry';
import type { LiveTestScenario } from './scenario.types';

/**
 * Resolves the scenario strictly from the CLI/npm script argument.
 * Invoice type is defined by the registered scenario, not by fixture or CRM-like fields.
 */
export function resolveScenarioFromCliArg(scenarioId: string): LiveTestScenario {
  return resolveLiveTestScenario(scenarioId);
}
