import type {
  AdvanceLiveTestScenarioContext,
  LiveTestProductLineFixture,
  LiveTestScenarioContext,
} from '../../fixtures/scenario-context.types';
import { assertDealTitleHasTestPrefix } from '../../bitrix-e2e-setup/build-full-bitrix-deal-fields';
import { EVAPREMIUM_BITRIX_FIELD_MAPPING } from '../../bitrix-e2e-setup/evapremium-bitrix-field-mapping';
import type { BitrixTestDealInput } from '../../bitrix-e2e-setup/bitrix-test-setup-client.types';
import type { LiveTestInvoiceType } from '../../types/live-test-report.types';

const M = EVAPREMIUM_BITRIX_FIELD_MAPPING;
const SHIPPING_PRODUCT_NAME = 'Wysyłka';

export interface MatrixBitrixDealPayload {
  scenarioType: LiveTestInvoiceType;
  dealTitle: string;
  deal: Omit<BitrixTestDealInput, 'companyId'>;
}

function parsePln(value: string): number {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid PLN amount: ${value}`);
  }

  return parsed;
}

function splitProducts(products: LiveTestProductLineFixture[]): {
  productRows: BitrixTestDealInput['productRows'];
  shippingCost: number;
  opportunity: number;
} {
  const productRows: BitrixTestDealInput['productRows'] = [];
  let shippingCost = 0;
  let opportunity = 0;

  for (const product of products) {
    const lineTotal = parsePln(product.unitPricePln) * product.quantity;
    opportunity += lineTotal;

    if (product.name === SHIPPING_PRODUCT_NAME) {
      shippingCost += lineTotal;
      continue;
    }

    productRows.push({
      productName: product.name,
      quantity: product.quantity,
      price: parsePln(product.unitPricePln),
    });
  }

  return { productRows, shippingCost, opportunity };
}

function baseCustomFields(): Record<string, string | number> {
  return {
    [M.documentTypeField]: M.documentTypeInvoiceValueId,
  };
}

export function buildMatrixBitrixDealPayload(
  context: LiveTestScenarioContext,
  initialStageId: string,
): MatrixBitrixDealPayload {
  if (!assertDealTitleHasTestPrefix(context.testDealTitle)) {
    throw new Error(`Matrix live deal title must start with [TEST]: ${context.testDealTitle}`);
  }

  const { productRows, shippingCost, opportunity } = splitProducts(context.products);
  const customFields = baseCustomFields();

  if (shippingCost > 0) {
    customFields[M.shippingCostField] = shippingCost;
  }

  switch (context.scenarioType) {
    case 'FULL':
      customFields[M.paymentFormField] = M.paymentFormFullValueId;
      break;
    case 'ADVANCE': {
      const advanceContext = context as AdvanceLiveTestScenarioContext;
      customFields[M.paymentFormField] = M.paymentFormAdvanceValueId;
      customFields[M.advanceAmountField] = parsePln(advanceContext.advanceAmountPln);
      break;
    }
    case 'FINAL':
      customFields[M.paymentFormField] = M.paymentFormFullValueId;
      customFields[M.invoiceDocumentTypeField] = M.invoiceDocumentTypeFinalValueId;
      break;
    default: {
      const exhaustive: never = context.scenarioType;
      throw new Error(`Unsupported matrix live scenario type: ${exhaustive}`);
    }
  }

  return {
    scenarioType: context.scenarioType,
    dealTitle: context.testDealTitle,
    deal: {
      title: context.testDealTitle,
      stageId: initialStageId,
      opportunity: Math.round(opportunity * 100) / 100,
      customFields,
      productRows,
    },
  };
}

export function resolveMatrixLiveRunSuffix(
  rawConfig: Record<string, string | undefined> = process.env,
  startedAt: Date = new Date(),
): string {
  const configured = rawConfig.LIVE_TEST_MATRIX_RUN_ID?.trim();
  if (configured) {
    return configured;
  }

  return startedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export function resolveMatrixLiveDealTitle(
  matrixCaseId: string,
  context: LiveTestScenarioContext,
  runSuffix?: string,
): string {
  const base = assertDealTitleHasTestPrefix(context.testDealTitle)
    ? `${context.testDealTitle} [${matrixCaseId}]`
    : `[TEST] Matrix ${matrixCaseId}`;

  const suffix = runSuffix?.trim();
  if (!suffix) {
    return base;
  }

  return `${base} [${suffix}]`;
}
