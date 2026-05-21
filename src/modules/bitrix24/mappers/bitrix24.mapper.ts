import { Injectable } from '@nestjs/common';
import type {
  Bitrix24AddressRaw,
  Bitrix24CompanyRaw,
  Bitrix24DealRaw,
  Bitrix24ProductRowRaw,
  Bitrix24RequisiteRaw,
} from '../types/bitrix24-api.types';
import type {
  BitrixCompanyAddressSource,
  BitrixCompanyData,
  BitrixDealCore,
  BitrixDealData,
  BitrixProductRow,
} from '../types/bitrix24.types';

const DEAL_SYSTEM_KEYS = new Set(['ID', 'STAGE_ID', 'COMPANY_ID']);

export type Bitrix24MapDealOptions = {
  portalBaseUrl?: string;
};

export type Bitrix24MapCompanyOptions = {
  addressSource?: BitrixCompanyAddressSource;
  addressRaw?: Bitrix24AddressRaw;
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
    options?: Bitrix24MapCompanyOptions,
  ): BitrixCompanyData {
    const companyId = String(companyRaw.ID);
    const addressSource = options?.addressSource ?? 'REQUISITE';
    const addressFromList =
      addressSource === 'CRM_ADDRESS_LIST'
        ? this.mapAddressFromCrmList(options?.addressRaw)
        : undefined;

    return {
      companyId,
      name: this.toOptionalString(companyRaw.TITLE),
      nip: this.toOptionalString(requisiteRaw?.RQ_INN),
      street:
        addressFromList?.street ??
        this.toOptionalString(requisiteRaw?.RQ_ADDR) ??
        this.toOptionalString(companyRaw.ADDRESS),
      postalCode:
        addressFromList?.postalCode ??
        this.toOptionalString(requisiteRaw?.RQ_ZIP) ??
        this.toOptionalString(companyRaw.ADDRESS_POSTAL_CODE),
      city:
        addressFromList?.city ??
        this.toOptionalString(requisiteRaw?.RQ_CITY) ??
        this.toOptionalString(companyRaw.ADDRESS_CITY),
      country:
        addressFromList?.country ??
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

  private mapAddressFromCrmList(
    addressRaw?: Bitrix24AddressRaw,
  ):
    | Pick<BitrixCompanyData, 'street' | 'postalCode' | 'city' | 'country'>
    | undefined {
    if (!addressRaw) {
      return undefined;
    }

    const streetParts = [addressRaw.ADDRESS_1, addressRaw.ADDRESS_2]
      .map((part) => this.toOptionalString(part))
      .filter((part): part is string => part !== undefined);

    if (streetParts.length === 0) {
      return {
        street: undefined,
        postalCode: this.toOptionalString(addressRaw.POSTAL_CODE)?.trim(),
        city: this.toOptionalString(addressRaw.CITY),
        country: this.toOptionalString(addressRaw.COUNTRY),
      };
    }

    return {
      street: streetParts.join(' '),
      postalCode: this.toOptionalString(addressRaw.POSTAL_CODE)?.trim(),
      city: this.toOptionalString(addressRaw.CITY),
      country: this.toOptionalString(addressRaw.COUNTRY),
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
