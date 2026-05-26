import { resolveScenarioFromCliArg } from './scenarios/resolve-scenario-from-cli';

/**
 * Uses the same scenario resolution path as run-live-test.ts CLI entry.
 * Avoids subprocess spawning so tests pass on Windows paths with spaces.
 */
describe('run-live-test scenario rejection', () => {
  it('rejects unknown scenario argument explicitly', () => {
    expect(() => resolveScenarioFromCliArg('not-a-real-scenario')).toThrow(
      'Unknown live-test scenario "not-a-real-scenario". Available: full, advance, final',
    );
  });

  it('does not default unknown scenario to FULL, ADVANCE, or FINAL', () => {
    for (const invalidId of ['', 'fullx', 'ADVANCE', 'FINAL ', 'all']) {
      expect(() => resolveScenarioFromCliArg(invalidId)).toThrow(
        /Unknown live-test scenario/,
      );
    }
  });
});
