import { deriveRealBitrixMutationExecuted } from './derive-real-bitrix-mutation-executed';

describe('deriveRealBitrixMutationExecuted', () => {
  it('returns false when no Bitrix mutation occurred', () => {
    expect(
      deriveRealBitrixMutationExecuted({
        bitrixMutationStarted: false,
        bitrixDealCreated: false,
        bitrixDealUpdated: false,
        bitrixStageChanged: false,
      }),
    ).toBe(false);
  });

  it('returns true when mutation started even if deal flags are false', () => {
    expect(
      deriveRealBitrixMutationExecuted({
        bitrixMutationStarted: true,
        bitrixDealCreated: false,
        bitrixDealUpdated: false,
        bitrixStageChanged: false,
      }),
    ).toBe(true);
  });
});
