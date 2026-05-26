export function deriveRealBitrixMutationExecuted(input: {
  bitrixMutationStarted: boolean;
  bitrixDealCreated: boolean;
  bitrixDealUpdated: boolean;
  bitrixStageChanged: boolean;
}): boolean {
  return (
    input.bitrixMutationStarted ||
    input.bitrixDealCreated ||
    input.bitrixDealUpdated ||
    input.bitrixStageChanged
  );
}
