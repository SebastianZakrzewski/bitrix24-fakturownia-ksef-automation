import type {
  BitrixRestCallFn,
  BitrixTestCompanyInput,
  BitrixTestCompanyResult,
  BitrixTestDealInput,
  BitrixTestDealResult,
  BitrixTestSetupClient,
} from './bitrix-test-setup-client.types';

const BITRIX_COMPANY_ENTITY_TYPE_ID = 4;

type BitrixApiResponse<T> = {
  result?: T;
  error?: string;
  error_description?: string;
};

export class BitrixTestSetupClientError extends Error {
  readonly method: string;

  constructor(method: string, message: string) {
    super(message);
    this.name = 'BitrixTestSetupClientError';
    this.method = method;
  }
}

export function createBitrixRestCallFn(webhookUrl: string): BitrixRestCallFn {
  const base = webhookUrl.replace(/\/$/, '');

  return async (method: string, params?: Record<string, unknown>) => {
    const url = `${base}/${method}.json`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params ?? {}),
    });

    const body = (await response.json()) as BitrixApiResponse<unknown>;

    if (!response.ok) {
      throw new BitrixTestSetupClientError(
        method,
        `Bitrix24 HTTP ${response.status}`,
      );
    }

    if (body.error) {
      throw new BitrixTestSetupClientError(
        method,
        body.error_description ?? body.error,
      );
    }

    return body.result;
  };
}

export function createBitrixTestSetupClient(
  call: BitrixRestCallFn,
): BitrixTestSetupClient {
  return {
    async createTestCompany(input: BitrixTestCompanyInput): Promise<BitrixTestCompanyResult> {
      const companyId = await call('crm.company.add', {
        fields: { TITLE: input.title },
      });

      const companyIdStr = String(companyId);

      await call('crm.requisite.add', {
        fields: {
          ENTITY_TYPE_ID: BITRIX_COMPANY_ENTITY_TYPE_ID,
          ENTITY_ID: companyIdStr,
          RQ_INN: input.nip,
          RQ_ADDR: input.street,
          RQ_ZIP: input.postalCode,
          RQ_CITY: input.city,
          RQ_COUNTRY: input.country,
        },
      });

      await call('crm.address.add', {
        fields: {
          TYPE_ID: 1,
          ENTITY_TYPE_ID: BITRIX_COMPANY_ENTITY_TYPE_ID,
          ENTITY_ID: companyIdStr,
          ADDRESS_1: input.street,
          CITY: input.city,
          POSTAL_CODE: input.postalCode,
          COUNTRY: input.country,
        },
      });

      return { companyId: companyIdStr };
    },

    async createTestDeal(input: BitrixTestDealInput): Promise<BitrixTestDealResult> {
      const dealId = await call('crm.deal.add', {
        fields: {
          TITLE: input.title,
          COMPANY_ID: input.companyId,
          STAGE_ID: input.stageId,
          OPPORTUNITY: input.opportunity,
          ...input.customFields,
        },
      });

      const dealIdStr = String(dealId);

      if (input.productRows.length > 0) {
        await call('crm.deal.productrows.set', {
          id: dealIdStr,
          rows: input.productRows.map((row) => ({
            PRODUCT_NAME: row.productName,
            QUANTITY: row.quantity,
            PRICE: row.price,
          })),
        });
      }

      return { dealId: dealIdStr };
    },

    async updateTestDeal(
      dealId: string,
      fields: Record<string, string | number>,
    ): Promise<void> {
      await call('crm.deal.update', { id: dealId, fields });
    },

    async setDealStage(dealId: string, stageId: string): Promise<void> {
      await call('crm.deal.update', {
        id: dealId,
        fields: { STAGE_ID: stageId },
      });
    },
  };
}
