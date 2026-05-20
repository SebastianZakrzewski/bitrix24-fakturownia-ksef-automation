import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createValidationPipe } from '../src/common/pipes/setup-validation.pipe';

describe('V1 skeleton endpoints', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.N8N_API_KEY = 'test-n8n-key';
    process.env.ADMIN_API_KEY = 'test-admin-key';
    process.env.PANEL_API_KEY = 'test-panel-key';
    process.env.PORT = '3000';

    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns health status without authentication', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          status: 'ok',
        });
      });
  });

  it('rejects trigger requests without the n8n API key', async () => {
    await request(app.getHttpServer())
      .post('/invoice-processes/bitrix-trigger')
      .send({
        bitrix_deal_id: '123',
        trigger_source: 'BITRIX24_STAGE_CHANGE',
        trigger_stage_id: 'OPLACONE',
        triggered_at: '2026-05-20T00:00:00.000Z',
      })
      .expect(401);
  });

  it('rejects trigger requests with invalid DTO shape', async () => {
    await request(app.getHttpServer())
      .post('/invoice-processes/bitrix-trigger')
      .set('x-api-key', 'test-n8n-key')
      .send({
        bitrix_deal_id: '123',
        trigger_source: 'INVALID_SOURCE',
        trigger_stage_id: 'OPLACONE',
        triggered_at: 'not-a-date',
      })
      .expect(400);
  });

  it('accepts trigger requests with the n8n API key and returns a scaffold response', async () => {
    await request(app.getHttpServer())
      .post('/invoice-processes/bitrix-trigger')
      .set('x-api-key', 'test-n8n-key')
      .send({
        bitrix_deal_id: '123',
        trigger_source: 'BITRIX24_STAGE_CHANGE',
        trigger_stage_id: 'OPLACONE',
        triggered_at: '2026-05-20T00:00:00.000Z',
      })
      .expect(202)
      .expect(({ body }) => {
        expect(body).toEqual({
          status: 'TRIGGER_RECEIVED',
          bitrix_deal_id: '123',
          message:
            'Trigger accepted by V1 skeleton. Invoice workflow is not implemented in this task.',
        });
      });
  });

  it('rejects admin retry requests without the admin API key', async () => {
    await request(app.getHttpServer())
      .post('/admin/invoice-processes/process-123/retry')
      .send({
        reason: 'Manual technical retry test',
        requested_by: 'admin@example.com',
        target_action: 'RETRY_VALIDATION_AND_PROCESS',
      })
      .expect(401);
  });

  it('rejects admin retry requests with invalid DTO shape', async () => {
    await request(app.getHttpServer())
      .post('/admin/invoice-processes/process-123/retry')
      .set('x-api-key', 'test-admin-key')
      .send({
        reason: '',
        requested_by: 'admin@example.com',
        target_action: 'INVALID_ACTION',
      })
      .expect(400);
  });

  it('rejects admin mark-reviewed requests without the admin API key', async () => {
    await request(app.getHttpServer())
      .post('/admin/invoice-processes/process-123/mark-reviewed')
      .send()
      .expect(401);
  });

  it('rejects client invoice list requests without panel auth', async () => {
    await request(app.getHttpServer())
      .get('/client/invoice-processes')
      .expect(401);
  });
});
