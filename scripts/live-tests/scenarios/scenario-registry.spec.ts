import { resolveLiveTestScenario } from './scenario-registry';

describe('resolveLiveTestScenario', () => {
  it('rejects unknown scenario ids explicitly', () => {
    expect(() => resolveLiveTestScenario('unknown-scenario')).toThrow(
      'Unknown live-test scenario "unknown-scenario". Available: full, advance, final',
    );
  });

  it('does not default unknown ids to FULL, ADVANCE, or FINAL', () => {
    for (const invalidId of ['', 'fullx', 'ADVANCE', 'FINAL ', 'all']) {
      expect(() => resolveLiveTestScenario(invalidId)).toThrow(/Unknown live-test scenario/);
    }
  });
});
