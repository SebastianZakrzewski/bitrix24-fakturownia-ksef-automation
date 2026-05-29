export const KSEF_GOV_STATUS_PENDING = new Set(['processing', 'demo_processing']);

export const DEFAULT_FAKTUROWNIA_KSEF_STATUS_POLL_TIMEOUT_MS = 60_000;
export const DEFAULT_FAKTUROWNIA_KSEF_STATUS_POLL_INTERVAL_MS = 5_000;

export function isKsefGovStatusPending(
  govStatus: string | null | undefined,
): boolean {
  if (govStatus === undefined) {
    return false;
  }

  if (govStatus === null) {
    return true;
  }

  return KSEF_GOV_STATUS_PENDING.has(govStatus);
}

export type PollKsefGovStatusDeps = {
  getGovStatus: () => Promise<string | null | undefined>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};

export async function pollKsefGovStatusUntilTerminal(
  initialGovStatus: string | null | undefined,
  options: {
    pollTimeoutMs: number;
    pollIntervalMs: number;
  },
  deps: PollKsefGovStatusDeps,
): Promise<string | null | undefined> {
  if (!isKsefGovStatusPending(initialGovStatus)) {
    return initialGovStatus;
  }

  let currentStatus = initialGovStatus;
  const deadline = deps.now() + options.pollTimeoutMs;

  while (deps.now() < deadline) {
    try {
      currentStatus = await deps.getGovStatus();

      if (!isKsefGovStatusPending(currentStatus)) {
        return currentStatus;
      }
    } catch {
      // Keep polling until the budget expires.
    }

    const remainingMs = deadline - deps.now();
    if (remainingMs <= 0) {
      break;
    }

    await deps.sleep(Math.min(options.pollIntervalMs, remainingMs));
  }

  return currentStatus;
}
