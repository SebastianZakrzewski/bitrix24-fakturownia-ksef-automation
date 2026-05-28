import type {
  BitrixRestCallFn,
  BitrixTestCompanyAddressEnsureResult,
  BitrixTestCompanyAddressInput,
  BitrixTestCompanyInput,
  BitrixTestCompanyRequisiteEnsureResult,
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

function hasCompleteCrmAddress(addresses: unknown): boolean {
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return false;
  }

  const address = addresses[0] as Record<string, unknown>;
  const streetParts = [address.ADDRESS_1, address.ADDRESS_2]
    .map((part) => (part === undefined || part === null || part === '' ? undefined : String(part)))
    .filter((part): part is string => Boolean(part));

  return (
    streetParts.length > 0 &&
    Boolean(address.POSTAL_CODE) &&
    Boolean(address.CITY) &&
    Boolean(address.COUNTRY)
  );
}

export function createBitrixTestSetupClient(
  call: BitrixRestCallFn,
): BitrixTestSetupClient {
  return {
    async useExistingTestCompany(companyId: string): Promise<BitrixTestCompanyResult> {
      const result = await call('crm.company.get', { id: companyId });

      if (result === undefined || result === null) {
        throw new BitrixTestSetupClientError(
          'crm.company.get',
          `Existing test company ${companyId} was not found`,
        );
      }

      return { companyId };
    },

    async ensureExistingTestCompanyAddress(
      companyId: string,
      address: BitrixTestCompanyAddressInput,
    ): Promise<BitrixTestCompanyAddressEnsureResult> {
      await call('crm.company.get', { id: companyId });

      const addresses = await call('crm.address.list', {
        filter: {
          ENTITY_TYPE_ID: BITRIX_COMPANY_ENTITY_TYPE_ID,
          ENTITY_ID: companyId,
        },
      });

      if (hasCompleteCrmAddress(addresses)) {
        return {
          companyId,
          addressAlreadyPresent: true,
          addressAdded: false,
        };
      }

      await call('crm.address.add', {
        fields: {
          TYPE_ID: 1,
          ENTITY_TYPE_ID: BITRIX_COMPANY_ENTITY_TYPE_ID,
          ENTITY_ID: companyId,
          ADDRESS_1: address.street,
          CITY: address.city,
          POSTAL_CODE: address.postalCode,
          COUNTRY: address.country,
        },
      });

      return {
        companyId,
        addressAlreadyPresent: false,
        addressAdded: true,
      };
    },

    async ensureExistingTestCompanyRequisite(
      companyId: string,
      nip: string,
    ): Promise<BitrixTestCompanyRequisiteEnsureResult> {
      const requisites = (await call('crm.requisite.list', {
        filter: {
          ENTITY_TYPE_ID: BITRIX_COMPANY_ENTITY_TYPE_ID,
          ENTITY_ID: companyId,
        },
      })) as Array<Record<string, unknown>> | undefined;

      const requisite = Array.isArray(requisites) ? requisites[0] : undefined;
      if (!requisite?.ID) {
        throw new BitrixTestSetupClientError(
          'crm.requisite.list',
          `Existing test company ${companyId} has no requisite for NIP ensure`,
        );
      }

      const requisiteId = String(requisite.ID);
      const currentNip =
        requisite.RQ_INN === undefined || requisite.RQ_INN === null
          ? ''
          : String(requisite.RQ_INN).trim();

      if (currentNip === nip.trim()) {
        return {
          companyId,
          requisiteId,
          nipAlreadyValid: true,
          nipUpdated: false,
        };
      }

      await call('crm.requisite.update', {
        id: requisiteId,
        fields: {
          RQ_INN: nip,
        },
      });

      return {
        companyId,
        requisiteId,
        nipAlreadyValid: false,
        nipUpdated: true,
      };
    },

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
