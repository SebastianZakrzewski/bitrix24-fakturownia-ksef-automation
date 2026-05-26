import { spawnSync } from 'child_process';
import { join } from 'path';

describe('run-live-test CLI', () => {
  const runnerPath = join(process.cwd(), 'scripts/live-tests/run-live-test.ts');

  it('exits with error for unknown scenario argument', () => {
    const result = spawnSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['ts-node', runnerPath, 'not-a-real-scenario'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          LIVE_TEST_MODE: 'true',
          TEST_DEAL_PREFIX: '[TEST]',
        },
        encoding: 'utf8',
        shell: true,
      },
    );

    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

    expect(result.status).not.toBe(0);
    expect(output).toMatch(/Unknown live-test scenario/);
    expect(output).not.toMatch(/DRY_RUN_COMPLETED/);
  });
});
