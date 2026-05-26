import {
  buildFullBitrixE2eSetupPayload,
} from './build-full-bitrix-deal-fields';
import { createBitrixTestSetupClient } from './bitrix-test-setup-client';
import type { BitrixRestCallFn } from './bitrix-test-setup-client.types';

type RecordedCall = {
  method: string;
  params?: Record<string, unknown>;
};

function createRecordingCallFn(): {
  call: BitrixRestCallFn;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];

  const call: BitrixRestCallFn = async (method, params) => {
    calls.push({ method, params });

    switch (method) {
      case 'crm.company.add':
        return 9001;
      case 'crm.requisite.add':
      case 'crm.address.add':
      case 'crm.deal.productrows.set':
      case 'crm.deal.update':
        return true;
      case 'crm.deal.add':
        return 8001;
      default:
        throw new Error(`Unexpected Bitrix method in test: ${method}`);
    }
  };

  return { call, calls };
}

describe('createBitrixTestSetupClient REST coverage', () => {
  it('calls documented Bitrix REST methods once each for FULL setup path', async () => {
    const { call, calls } = createRecordingCallFn();
    const client = createBitrixTestSetupClient(call);
    const payload = buildFullBitrixE2eSetupPayload({
      dealTitle: '[TEST] REST method coverage',
      initialStageId: 'UC_NEW',
    });

    const { companyId } = await client.createTestCompany(payload.company);
    const { dealId } = await client.createTestDeal({
      ...payload.deal,
      companyId,
    });
    await client.updateTestDeal(dealId, payload.deal.customFields);
    await client.setDealStage(dealId, payload.paidStageId);

    const methodCounts = calls.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.method] = (acc[entry.method] ?? 0) + 1;
      return acc;
    }, {});

    expect(methodCounts['crm.company.add']).toBe(1);
    expect(methodCounts['crm.requisite.add']).toBe(1);
    expect(methodCounts['crm.address.add']).toBe(1);
    expect(methodCounts['crm.deal.add']).toBe(1);
    expect(methodCounts['crm.deal.productrows.set']).toBe(1);

    const stageUpdates = calls.filter(
      (entry) =>
        entry.method === 'crm.deal.update' &&
        (entry.params?.fields as Record<string, unknown> | undefined)?.STAGE_ID ===
          'PREPARATION',
    );
    expect(stageUpdates).toHaveLength(1);
    expect(stageUpdates[0]?.params).toMatchObject({
      id: '8001',
      fields: { STAGE_ID: 'PREPARATION' },
    });

    const fieldUpdates = calls.filter(
      (entry) =>
        entry.method === 'crm.deal.update' &&
        (entry.params?.fields as Record<string, unknown> | undefined)?.STAGE_ID ===
          undefined,
    );
    expect(fieldUpdates).toHaveLength(1);
  });

  it('propagates errors without embedding call params in message', async () => {
    const call: BitrixRestCallFn = async (method, params) => {
      if (method === 'crm.company.add') {
        expect(params).toBeDefined();
        throw new Error('crm.company.add failed');
      }
      return 1;
    };

    const client = createBitrixTestSetupClient(call);

    await expect(
      client.createTestCompany({
        title: '[TEST] Buyer',
        nip: '1111111111',
        street: 'ul. Testowa 1',
        postalCode: '00-001',
        city: 'Warszawa',
        country: 'PL',
      }),
    ).rejects.toThrow('crm.company.add failed');
  });
});
