import {
  pollKsefGovStatusUntilTerminal,
  isKsefGovStatusPending,
} from './fakturownia-ksef-status.util';

describe('isKsefGovStatusPending', () => {
  it.each(['processing', 'demo_processing', null])(
    'returns true for %s',
    (status) => {
      expect(isKsefGovStatusPending(status)).toBe(true);
    },
  );

  it.each(['ok', 'send_error', undefined])(
    'returns false for %s',
    (status) => {
      expect(isKsefGovStatusPending(status)).toBe(false);
    },
  );
});

describe('pollKsefGovStatusUntilTerminal', () => {
  const pollOptions = {
    pollTimeoutMs: 60_000,
    pollIntervalMs: 5_000,
  };

  it('returns initial status when not pending', async () => {
    const getGovStatus = jest.fn();

    const result = await pollKsefGovStatusUntilTerminal(
      'ok',
      pollOptions,
      {
        getGovStatus,
        sleep: jest.fn(),
        now: () => 0,
      },
    );

    expect(result).toBe('ok');
    expect(getGovStatus).not.toHaveBeenCalled();
  });

  it('polls until status becomes terminal', async () => {
    let now = 0;
    const getGovStatus = jest
      .fn()
      .mockResolvedValueOnce('processing')
      .mockResolvedValueOnce('ok');
    const sleep = jest.fn(async (ms: number) => {
      now += ms;
    });

    const result = await pollKsefGovStatusUntilTerminal(
      'processing',
      pollOptions,
      { getGovStatus, sleep, now: () => now },
    );

    expect(result).toBe('ok');
    expect(getGovStatus).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(5_000);
  });

  it('returns last pending status after timeout budget', async () => {
    let now = 0;
    const getGovStatus = jest.fn().mockResolvedValue('processing');
    const sleep = jest.fn(async (ms: number) => {
      now += ms;
    });

    const result = await pollKsefGovStatusUntilTerminal(
      'processing',
      { pollTimeoutMs: 12_000, pollIntervalMs: 5_000 },
      { getGovStatus, sleep, now: () => now },
    );

    expect(result).toBe('processing');
    expect(getGovStatus).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(3);
  });

  it('polls when initial status is null and resolves to ok', async () => {
    let now = 0;
    const getGovStatus = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('ok');
    const sleep = jest.fn(async (ms: number) => {
      now += ms;
    });

    const result = await pollKsefGovStatusUntilTerminal(
      null,
      pollOptions,
      { getGovStatus, sleep, now: () => now },
    );

    expect(result).toBe('ok');
    expect(getGovStatus).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('continues polling when GET fails', async () => {
    let now = 0;
    const getGovStatus = jest
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce('ok');
    const sleep = jest.fn(async (ms: number) => {
      now += ms;
    });

    const result = await pollKsefGovStatusUntilTerminal(
      'processing',
      pollOptions,
      { getGovStatus, sleep, now: () => now },
    );

    expect(result).toBe('ok');
    expect(getGovStatus).toHaveBeenCalledTimes(2);
  });
});
