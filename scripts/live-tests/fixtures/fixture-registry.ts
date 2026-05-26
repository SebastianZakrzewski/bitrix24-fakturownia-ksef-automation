import { advanceInvoiceDryRunContext } from './advance-invoice.context';
import { finalInvoiceDryRunContext } from './final-invoice.context';
import { fullInvoiceDryRunContext } from './full-invoice.context';
import type { LiveTestScenarioContext } from './scenario-context.types';

export const liveTestFixtureByScenarioId = {
  full: fullInvoiceDryRunContext,
  advance: advanceInvoiceDryRunContext,
  final: finalInvoiceDryRunContext,
} as const satisfies Record<string, LiveTestScenarioContext>;

export type LiveTestFixtureScenarioId = keyof typeof liveTestFixtureByScenarioId;
