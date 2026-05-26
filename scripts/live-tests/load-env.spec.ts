import { readFileSync } from 'fs';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadLiveTestDotenv } from './load-env';

describe('loadLiveTestDotenv', () => {
  it('does not use dotenv override', () => {
    const source = readFileSync(join(__dirname, 'load-env.ts'), 'utf8');

    expect(source).toContain('override: false');
    expect(source).not.toMatch(/override:\s*true/);
  });

  it('keeps explicit process env flags over values from .env', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'live-test-dotenv-'));
    const envFile = join(tempDir, '.env');

    try {
      await writeFile(
        envFile,
        [
          'LIVE_TEST_MODE=false',
          'LIVE_TEST_CONFIRM=true',
          'ENABLE_EXTERNAL_SIDE_EFFECTS=true',
          'TEST_DEAL_PREFIX=PRODUCTION',
        ].join('\n'),
        'utf8',
      );

      process.env.LIVE_TEST_MODE = 'true';
      process.env.LIVE_TEST_CONFIRM = 'false';
      process.env.ENABLE_EXTERNAL_SIDE_EFFECTS = 'false';
      process.env.TEST_DEAL_PREFIX = '[TEST]';

      loadLiveTestDotenv(envFile);

      expect(process.env.LIVE_TEST_MODE).toBe('true');
      expect(process.env.LIVE_TEST_CONFIRM).toBe('false');
      expect(process.env.ENABLE_EXTERNAL_SIDE_EFFECTS).toBe('false');
      expect(process.env.TEST_DEAL_PREFIX).toBe('[TEST]');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
