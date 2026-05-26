import { parseBitrixE2eSetupEnv } from '../bitrix-e2e-setup/bitrix-e2e-setup-env';
import { runBitrixE2eSetup } from '../bitrix-e2e-setup/run-bitrix-e2e-setup';
import type { BitrixE2eSetupExecutionResult } from '../bitrix-e2e-setup/bitrix-e2e-setup.types';
import type { BitrixTestSetupClient } from '../bitrix-e2e-setup/bitrix-test-setup-client.types';

export interface FullBitrixE2eSetupScenarioResult {
  execution: BitrixE2eSetupExecutionResult;
}

export interface FullBitrixE2eSetupScenarioOptions {
  rawConfig?: Record<string, string | undefined>;
  client?: BitrixTestSetupClient;
}

export const fullBitrixE2eSetupSafetyContext = {
  requiresExternalSideEffects: true,
  requiresTestDealCreation: true,
  scenarioCount: 1,
  requestsDeleteOrCancel: false,
} as const;

export async function runFullBitrixE2eSetupScenario(
  options: FullBitrixE2eSetupScenarioOptions = {},
): Promise<FullBitrixE2eSetupScenarioResult> {
  const rawConfig = options.rawConfig ?? process.env;
  const env = parseBitrixE2eSetupEnv(rawConfig);
  const execution = await runBitrixE2eSetup({
    env,
    scenarioType: 'FULL',
    rawConfig,
    client: options.client,
  });

  return { execution };
}
