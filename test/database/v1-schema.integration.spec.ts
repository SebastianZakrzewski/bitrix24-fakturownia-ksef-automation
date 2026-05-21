import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { DatabaseModule } from '../../src/database/database.module';
import { DatabaseService } from '../../src/database/database.service';
import {
  POSTGRES_CHECK_VIOLATION,
  POSTGRES_FOREIGN_KEY_VIOLATION,
  POSTGRES_UNIQUE_VIOLATION,
} from '../../src/database/database.constants';
import { DatabaseConstraintError } from '../../src/database/database.errors';
import {
  DEFAULT_DATABASE_SCHEMA,
  qualifiedSchemaName,
  withDatabaseSearchPath,
} from '../../src/database/database-schema';
import { migrate } from '../../src/database/migrate';
import { BitrixDealSnapshotRepository } from '../../src/modules/invoices/repositories/bitrix-deal-snapshot.repository';
import { ClientConfigRepository } from '../../src/modules/invoices/repositories/client-config.repository';
import { InvoiceEventRepository } from '../../src/modules/invoices/repositories/invoice-event.repository';
import { InvoiceProcessRepository } from '../../src/modules/invoices/repositories/invoice-process.repository';
import { InvoiceRecordRepository } from '../../src/modules/invoices/repositories/invoice-record.repository';
import { TechnicalRetryAttemptRepository } from '../../src/modules/invoices/repositories/technical-retry-attempt.repository';
import { PanelAdminUserRepository } from '../../src/modules/client-panel/repositories/panel-admin-user.repository';
import type { InvoiceProcessStatus, InvoiceType } from '../../src/modules/invoices/types/invoice.types';
import {
  validClientConfigParams,
  validInvoiceProcessParams,
  validInvoiceRecordParams,
} from './fixtures';

describe('V1 database schema constraints', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let invoiceProcessRepository: InvoiceProcessRepository;
  let invoiceRecordRepository: InvoiceRecordRepository;
  let invoiceEventRepository: InvoiceEventRepository;
  let bitrixDealSnapshotRepository: BitrixDealSnapshotRepository;
  let technicalRetryAttemptRepository: TechnicalRetryAttemptRepository;
  let clientConfigRepository: ClientConfigRepository;
  let panelAdminUserRepository: PanelAdminUserRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    process.env.DATABASE_URL = container.getConnectionUri();
    process.env.DATABASE_SCHEMA = DEFAULT_DATABASE_SCHEMA;
    const connectionString = withDatabaseSearchPath(
      process.env.DATABASE_URL,
      DEFAULT_DATABASE_SCHEMA,
    );
    pool = new Pool({ connectionString });
    await migrate(pool, DEFAULT_DATABASE_SCHEMA);

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              DATABASE_URL: process.env.DATABASE_URL,
              DATABASE_SCHEMA: DEFAULT_DATABASE_SCHEMA,
            }),
          ],
        }),
        DatabaseModule,
      ],
      providers: [
        InvoiceProcessRepository,
        InvoiceRecordRepository,
        InvoiceEventRepository,
        BitrixDealSnapshotRepository,
        TechnicalRetryAttemptRepository,
        ClientConfigRepository,
        PanelAdminUserRepository,
      ],
    }).compile();

    invoiceProcessRepository = moduleRef.get(InvoiceProcessRepository);
    invoiceRecordRepository = moduleRef.get(InvoiceRecordRepository);
    invoiceEventRepository = moduleRef.get(InvoiceEventRepository);
    bitrixDealSnapshotRepository = moduleRef.get(BitrixDealSnapshotRepository);
    technicalRetryAttemptRepository = moduleRef.get(TechnicalRetryAttemptRepository);
    clientConfigRepository = moduleRef.get(ClientConfigRepository);
    panelAdminUserRepository = moduleRef.get(PanelAdminUserRepository);
  }, 120_000);

  afterAll(async () => {
    const databaseService = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              DATABASE_URL: process.env.DATABASE_URL,
              DATABASE_SCHEMA: DEFAULT_DATABASE_SCHEMA,
            }),
          ],
        }),
        DatabaseModule,
      ],
    })
      .compile()
      .then((moduleRef) => moduleRef.get(DatabaseService));

    await databaseService.onModuleDestroy();
    await pool.end();
    await container.stop();
  });

  beforeEach(async () => {
    const schema = qualifiedSchemaName(DEFAULT_DATABASE_SCHEMA);
    await pool.query(`
      TRUNCATE TABLE
        ${schema}.technical_retry_attempts,
        ${schema}.bitrix_deal_snapshots,
        ${schema}.invoice_records,
        ${schema}.invoice_events,
        ${schema}.fakturownia_orders,
        ${schema}.invoice_processes,
        ${schema}.client_configs,
        ${schema}.panel_admin_users
      RESTART IDENTITY CASCADE
    `);
  });

  it('creates invoice_process with valid invoice_type and status', async () => {
    const process = await invoiceProcessRepository.create(validInvoiceProcessParams());

    expect(process.id).toBeDefined();
    expect(process.invoice_type).toBe('FULL');
    expect(process.status).toBe('TRIGGER_RECEIVED');
  });

  it('rejects invoice_process with invalid invoice_type', async () => {
    await expect(
      invoiceProcessRepository.create({
        ...validInvoiceProcessParams(),
        invoice_type: 'INVALID' as InvoiceType,
      }),
    ).rejects.toMatchObject({
      code: POSTGRES_CHECK_VIOLATION,
    } satisfies Partial<DatabaseConstraintError>);
  });

  it('rejects invoice_process with invalid status', async () => {
    await expect(
      invoiceProcessRepository.create({
        ...validInvoiceProcessParams(),
        status: 'NOT_A_REAL_STATUS' as InvoiceProcessStatus,
      }),
    ).rejects.toMatchObject({
      code: POSTGRES_CHECK_VIOLATION,
    } satisfies Partial<DatabaseConstraintError>);
  });

  it('rejects duplicate bitrix_deal_id and invoice_type', async () => {
    const params = validInvoiceProcessParams();
    await invoiceProcessRepository.create(params);

    await expect(
      invoiceProcessRepository.create({
        ...params,
        idempotency_key: 'different-key',
      }),
    ).rejects.toMatchObject({
      code: POSTGRES_UNIQUE_VIOLATION,
    } satisfies Partial<DatabaseConstraintError>);
  });

  it('rejects duplicate idempotency_key', async () => {
    const params = validInvoiceProcessParams();
    await invoiceProcessRepository.create(params);

    await expect(
      invoiceProcessRepository.create({
        ...params,
        bitrix_deal_id: 'deal-200',
        invoice_type: 'ADVANCE',
      }),
    ).rejects.toMatchObject({
      code: POSTGRES_UNIQUE_VIOLATION,
    } satisfies Partial<DatabaseConstraintError>);
  });

  it('enforces one invoice_record per invoice_process', async () => {
    const process = await invoiceProcessRepository.create(validInvoiceProcessParams());
    await invoiceRecordRepository.insert(validInvoiceRecordParams(process.id));

    await expect(
      invoiceRecordRepository.insert(
        validInvoiceRecordParams(process.id, {
          fakturownia_invoice_id: 'fakt-200',
        }),
      ),
    ).rejects.toMatchObject({
      code: POSTGRES_UNIQUE_VIOLATION,
    } satisfies Partial<DatabaseConstraintError>);
  });

  it('rejects duplicate fakturownia_invoice_id', async () => {
    const firstProcess = await invoiceProcessRepository.create({
      ...validInvoiceProcessParams(),
      bitrix_deal_id: 'deal-101',
      invoice_type: 'ADVANCE',
      idempotency_key: 'deal-101:ADVANCE',
    });
    const secondProcess = await invoiceProcessRepository.create({
      ...validInvoiceProcessParams(),
      bitrix_deal_id: 'deal-102',
      invoice_type: 'FINAL',
      idempotency_key: 'deal-102:FINAL',
    });

    await invoiceRecordRepository.insert(validInvoiceRecordParams(firstProcess.id));
    await expect(
      invoiceRecordRepository.insert(validInvoiceRecordParams(secondProcess.id)),
    ).rejects.toMatchObject({
      code: POSTGRES_UNIQUE_VIOLATION,
    } satisfies Partial<DatabaseConstraintError>);
  });

  it('allows STALE_TRIGGER_IGNORED event without invoice_process_id', async () => {
    const event = await invoiceEventRepository.insert({
      invoice_process_id: null,
      bitrix_deal_id: 'deal-stale',
      event_type: 'STALE_TRIGGER_IGNORED',
      message: 'Trigger ignored because deal is no longer paid',
    });

    expect(event.invoice_process_id).toBeNull();
    expect(event.event_type).toBe('STALE_TRIGGER_IGNORED');
  });

  it('requires bitrix_deal_snapshots to reference a real invoice_process', async () => {
    await expect(
      bitrixDealSnapshotRepository.insert({
        invoice_process_id: '00000000-0000-4000-8000-000000000000',
        bitrix_deal_id: 'deal-missing',
        raw_deal: { ID: 'deal-missing' },
      }),
    ).rejects.toMatchObject({
      code: POSTGRES_FOREIGN_KEY_VIOLATION,
    } satisfies Partial<DatabaseConstraintError>);
  });

  it('requires technical_retry_attempts to reference a real invoice_process', async () => {
    await expect(
      technicalRetryAttemptRepository.create({
        invoice_process_id: '00000000-0000-4000-8000-000000000000',
        requested_by: 'admin',
        reason: 'retry',
        from_status: 'FAKTUROWNIA_ERROR',
        target_action: 'RETRY_FAKTUROWNIA_CREATION',
        allowed: false,
      }),
    ).rejects.toMatchObject({
      code: POSTGRES_FOREIGN_KEY_VIOLATION,
    } satisfies Partial<DatabaseConstraintError>);
  });

  it('enforces unique panel_admin_users.email', async () => {
    await panelAdminUserRepository.create({
      email: 'admin@example.com',
      password_hash: 'hashed-password',
    });

    await expect(
      panelAdminUserRepository.create({
        email: 'admin@example.com',
        password_hash: 'another-hash',
      }),
    ).rejects.toMatchObject({
      code: POSTGRES_UNIQUE_VIOLATION,
    } satisfies Partial<DatabaseConstraintError>);
  });

  it('allows only one active client_config', async () => {
    await clientConfigRepository.create(validClientConfigParams({ name: 'Primary' }));

    await expect(
      clientConfigRepository.create(
        validClientConfigParams({ name: 'Secondary', is_active: true }),
      ),
    ).rejects.toMatchObject({
      code: POSTGRES_UNIQUE_VIOLATION,
    } satisfies Partial<DatabaseConstraintError>);
  });

  it('rejects STALE_TRIGGER_IGNORED as invoice_process status', async () => {
    await expect(
      invoiceProcessRepository.create({
        ...validInvoiceProcessParams(),
        status: 'STALE_TRIGGER_IGNORED' as InvoiceProcessStatus,
      }),
    ).rejects.toMatchObject({
      code: POSTGRES_CHECK_VIOLATION,
    } satisfies Partial<DatabaseConstraintError>);
  });
});
