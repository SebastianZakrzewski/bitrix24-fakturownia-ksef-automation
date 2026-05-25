import { advanceInvoiceScenario } from './advance-invoice.scenario';
import { finalInvoiceScenario } from './final-invoice.scenario';
import { fullInvoiceScenario } from './full-invoice.scenario';
import type { LiveTestScenario } from './scenario.types';

const scenarios: LiveTestScenario[] = [
  fullInvoiceScenario,
  advanceInvoiceScenario,
  finalInvoiceScenario,
];

const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));

export function listLiveTestScenarioIds(): string[] {
  return scenarios.map((scenario) => scenario.id);
}

export function resolveLiveTestScenario(scenarioId: string): LiveTestScenario {
  const scenario = scenarioById.get(scenarioId);

  if (!scenario) {
    throw new Error(
      `Unknown live-test scenario "${scenarioId}". Available: ${listLiveTestScenarioIds().join(', ')}`,
    );
  }

  return scenario;
}
