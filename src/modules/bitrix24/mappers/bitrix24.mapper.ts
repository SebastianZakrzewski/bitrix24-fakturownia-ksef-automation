import { Injectable } from '@nestjs/common';
import type {
  Bitrix24CompanyRaw,
  Bitrix24DealRaw,
  Bitrix24ProductRowRaw,
  Bitrix24RequisiteRaw,
} from '../types/bitrix24-api.types';
import type {
  BitrixCompanyData,
  BitrixDealCore,
  BitrixDealData,
  BitrixProductRow,
} from '../types/bitrix24.types';

const DEAL_SYSTEM_KEYS = new Set(['ID', 'STAGE_ID', 'COMPANY_ID']);

export type Bitrix24MapDealOptions = {
  portalBaseUrl?: string;
};

@Injectable()
export class Bitrix24Mapper {
  mapDeal(raw: Bitrix24DealRaw, options?: Bitrix24MapDealOptions): BitrixDealCore {
    const customFields: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(raw)) {
      if (!DEAL_SYSTEM_KEYS.has(key)) {
        customFields[key] = value;
      }
    }

    const dealId = String(raw.ID);
    const companyId =
      raw.COMPANY_ID !== undefined && raw.COMPANY_ID !== ''
        ? String(raw.COMPANY_ID)
        : undefined;

    return {
      dealId,
      dealUrl: this.buildDealUrl(dealId, options?.portalBaseUrl),
      stageId: String(raw.STAGE_ID),
      companyId,
      customFields,
    };
  }

  mapCompany(
    companyRaw: Bitrix24CompanyRaw,
    requisiteRaw?: Bitrix24RequisiteRaw,
  ): BitrixCompanyData {
    const companyId = String(companyRaw.ID);

    return {
      companyId,
      name: this.toOptionalString(companyRaw.TITLE),
      nip: this.toOptionalString(requisiteRaw?.RQ_INN),
      street:
        this.toOptionalString(requisiteRaw?.RQ_ADDR) ??
        this.toOptionalString(companyRaw.ADDRESS),
      postalCode:
        this.toOptionalString(requisiteRaw?.RQ_ZIP) ??
        this.toOptionalString(companyRaw.ADDRESS_POSTAL_CODE),
      city:
        this.toOptionalString(requisiteRaw?.RQ_CITY) ??
        this.toOptionalString(companyRaw.ADDRESS_CITY),
      country:
        this.toOptionalString(requisiteRaw?.RQ_COUNTRY) ??
        this.toOptionalString(companyRaw.ADDRESS_COUNTRY),
    };
  }

  mapProductRow(raw: Bitrix24ProductRowRaw): BitrixProductRow {
    return {
      id: String(raw.ID),
      productName: this.toOptionalString(raw.PRODUCT_NAME),
      quantity: this.parseOptionalNumber(raw.QUANTITY),
      grossPrice: this.parseOptionalNumber(raw.PRICE),
    };
  }

  toBitrixDealData(core: BitrixDealCore, productRows: BitrixProductRow[]): BitrixDealData {
    return {
      dealId: core.dealId,
      dealUrl: core.dealUrl,
      stageId: core.stageId,
      companyId: core.companyId,
      customFields: core.customFields,
      productRows,
    };
  }

  private buildDealUrl(dealId: string, portalBaseUrl?: string): string | undefined {
    if (!portalBaseUrl) {
      return undefined;
    }

    const base = portalBaseUrl.replace(/\/$/, '');
    return `${base}/crm/deal/details/${dealId}/`;
  }

  private toOptionalString(value: unknown): string | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    return String(value);
  }

  private parseOptionalNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const parsed = typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(parsed)) {
      return undefined;
    }

    return parsed;
  }
}
