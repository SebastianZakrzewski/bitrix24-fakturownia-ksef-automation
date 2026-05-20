export type CreateInvoiceFromBitrixDealCommand = {
  bitrixDealId: string;
  triggerSource: 'BITRIX24_STAGE_CHANGE';
  triggerStageId: string;
  triggeredAt: string;
};
