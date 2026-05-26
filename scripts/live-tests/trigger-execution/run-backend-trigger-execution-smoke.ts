import type { LiveTestScenarioContext } from '../fixtures/scenario-context.types';
import type { LiveTestEnv } from '../live-test-env';
import { buildBitrixTriggerPreflightPayload } from '../trigger-preflight/build-bitrix-trigger-preflight-payload';
import type { BackendDryRunContract } from '../contracts/backend-dry-run-contract.types';
import { resolveLiveSmokeTarget } from '../live-smoke-target/resolve-live-smoke-target';
import { parseLiveSmokeTargetConfig } from '../live-smoke-target/parse-live-smoke-target-config';
import { deriveBackendTriggerSystemEffects } from '../side-effects/derive-backend-trigger-system-effects';
import { RUNNER_DIRECT_SIDE_EFFECTS } from '../side-effects/live-test-side-effects.types';
import {
  parseBackendTriggerExecutionConfig,
  type BackendTriggerExecutionConfig,
} from './backend-trigger-execution-config';
import { evaluateBackendTriggerExecutionGate } from './evaluate-backend-trigger-execution-gate';
import {
  BackendTriggerFetchTimeoutError,
  fetchBackendBitrixTrigger,
  type BackendTriggerFetchImpl,
} from './fetch-backend-bitrix-trigger';
import {
  backendTriggerExecutionResultSchema,
  type BackendTriggerExecutionResult,
  type BitrixTriggerExecutionPayload,
} from './backend-trigger-execution.types';

let triggerExecutionRequestConsumed = false;

/** Test-only reset for single-execution guard. */
export function resetBackendTriggerExecutionGuardForTests(): void {
  triggerExecutionRequestConsumed = false;
}

function buildBlockedExecution(
  context: LiveTestScenarioContext,
  gate: ReturnType<typeof evaluateBackendTriggerExecutionGate>,
  payload: BitrixTriggerExecutionPayload,
  config: BackendTriggerExecutionConfig,
): BackendTriggerExecutionResult {
  const systemEffects = deriveBackendTriggerSystemEffects({
    requestSent: false,
    endpointCalled: false,
    workflowAccepted: false,
  });

  return backendTriggerExecutionResultSchema.parse({
    mode: 'CONTROLLED_LIVE_TRIGGER_EXECUTION',
    executionKind: 'BACKEND_TRIGGER_EXECUTION',
    scenarioType: context.scenarioType,
    gate: {
      executionAllowed: gate.executionAllowed,
      triggerExecutionAllowed: false,
      blockers: gate.blockers,
      warnings: gate.warnings,
    },
    target: {
      method: 'POST',
      path: '/invoice-processes/bitrix-trigger',
      baseUrlConfigured: Boolean(config.baseUrl),
      authHeaderNameConfigured: Boolean(config.authHeaderName),
      authSecretConfigured: Boolean(config.authSecret),
      secretDisplayed: false,
    },
    request: {
      payload,
      timeoutMs: config.timeoutMs,
    },
    runnerDirect: RUNNER_DIRECT_SIDE_EFFECTS,
    systemEffects,
    resultStatus: 'BACKEND_TRIGGER_EXECUTION_BLOCKED',
    warnings: [
      ...gate.warnings,
      'POST /invoice-processes/bitrix-trigger was not sent.',
    ],
    errors: [],
  });
}

function parseTriggerResponseBody(bodyText: string): {
  processId?: string;
  triggerStatus?: string;
  message?: string;
} {
  try {
    const parsed = JSON.parse(bodyText) as Record<string, unknown>;
    return {
      processId:
        typeof parsed.process_id === 'string' ? parsed.process_id : undefined,
      triggerStatus: typeof parsed.status === 'string' ? parsed.status : undefined,
      message: typeof parsed.message === 'string' ? parsed.message : undefined,
    };
  } catch {
    return {
      message: bodyText.slice(0, 200),
    };
  }
}

export interface RunBackendTriggerExecutionSmokeInput {
  env: LiveTestEnv;
  context: LiveTestScenarioContext;
  contract: BackendDryRunContract;
  rawConfig?: Record<string, string | undefined>;
  fetchImpl?: BackendTriggerFetchImpl;
}

export async function runBackendTriggerExecutionSmoke(
  input: RunBackendTriggerExecutionSmokeInput,
): Promise<BackendTriggerExecutionResult> {
  const rawConfig = input.rawConfig ?? process.env;
  const config = parseBackendTriggerExecutionConfig(rawConfig);
  const gate = evaluateBackendTriggerExecutionGate(
    input.env,
    input.context,
    rawConfig,
  );
  const liveSmokeTarget = resolveLiveSmokeTarget(
    input.context,
    parseLiveSmokeTargetConfig(rawConfig),
  );
  const basePayload = buildBitrixTriggerPreflightPayload(input.contract, liveSmokeTarget);

  if (!gate.executionAllowed) {
    return buildBlockedExecution(input.context, gate, basePayload, config);
  }

  if (triggerExecutionRequestConsumed) {
    return buildBlockedExecution(input.context, {
      ...gate,
      executionAllowed: false,
      triggerExecutionAllowed: false,
      blockers: [
        ...gate.blockers,
        'Only one backend trigger POST is allowed per runner process',
      ],
    }, basePayload, config);
  }

  triggerExecutionRequestConsumed = true;
  const payload: BitrixTriggerExecutionPayload = {
    ...basePayload,
    triggered_at: new Date().toISOString(),
  };

  try {
    const response = await fetchBackendBitrixTrigger({
      config,
      payload,
      fetchImpl: input.fetchImpl,
    });
    const parsedBody = parseTriggerResponseBody(response.bodyText);
    const workflowAccepted = response.statusCode === 202 && response.ok;
    const systemEffects = deriveBackendTriggerSystemEffects({
      requestSent: true,
      endpointCalled: true,
      workflowAccepted,
    });

    return backendTriggerExecutionResultSchema.parse({
      mode: 'CONTROLLED_LIVE_TRIGGER_EXECUTION',
      executionKind: 'BACKEND_TRIGGER_EXECUTION',
      scenarioType: input.context.scenarioType,
      gate: {
        executionAllowed: true,
        triggerExecutionAllowed: true,
        blockers: [],
        warnings: gate.warnings,
      },
      target: {
        method: 'POST',
        path: '/invoice-processes/bitrix-trigger',
        baseUrlConfigured: true,
        authHeaderNameConfigured: true,
        authSecretConfigured: true,
        secretDisplayed: false,
      },
      request: {
        payload,
        timeoutMs: config.timeoutMs,
      },
      response: {
        statusCode: response.statusCode,
        ok: response.ok,
        processId: parsedBody.processId,
        triggerStatus: parsedBody.triggerStatus,
        message: parsedBody.message,
      },
      runnerDirect: RUNNER_DIRECT_SIDE_EFFECTS,
      systemEffects,
      resultStatus: workflowAccepted
        ? 'BACKEND_TRIGGER_EXECUTION_SENT'
        : 'BACKEND_TRIGGER_EXECUTION_FAILED',
      warnings: [
        ...gate.warnings,
        systemEffects.backendSideEffectsMayHaveOccurred
          ? 'Backend workflow and backend side effects may have occurred; manual verification is required.'
          : 'Backend trigger POST was sent; manual verification may be required.',
      ],
      errors: workflowAccepted
        ? []
        : [`Unexpected HTTP status ${response.statusCode}`],
    });
  } catch (error: unknown) {
    const isTimeout = error instanceof BackendTriggerFetchTimeoutError;
    const message = error instanceof Error ? error.message : String(error);
    const systemEffects = deriveBackendTriggerSystemEffects({
      requestSent: true,
      endpointCalled: false,
      workflowAccepted: false,
    });

    return backendTriggerExecutionResultSchema.parse({
      mode: 'CONTROLLED_LIVE_TRIGGER_EXECUTION',
      executionKind: 'BACKEND_TRIGGER_EXECUTION',
      scenarioType: input.context.scenarioType,
      gate: {
        executionAllowed: true,
        triggerExecutionAllowed: true,
        blockers: [],
        warnings: gate.warnings,
      },
      target: {
        method: 'POST',
        path: '/invoice-processes/bitrix-trigger',
        baseUrlConfigured: true,
        authHeaderNameConfigured: true,
        authSecretConfigured: true,
        secretDisplayed: false,
      },
      request: {
        payload,
        timeoutMs: config.timeoutMs,
      },
      runnerDirect: RUNNER_DIRECT_SIDE_EFFECTS,
      systemEffects,
      resultStatus: isTimeout
        ? 'BACKEND_TRIGGER_EXECUTION_TIMEOUT'
        : 'BACKEND_TRIGGER_EXECUTION_FAILED',
      warnings: [
        ...gate.warnings,
        'Backend trigger POST was sent but response outcome is uncertain; manual verification is required.',
      ],
      errors: [message],
    });
  }
}
