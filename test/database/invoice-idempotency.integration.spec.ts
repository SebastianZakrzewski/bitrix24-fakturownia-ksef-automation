import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { DatabaseModule } from '../../src/database/database.module';
import { DatabaseService } from '../../src/database/database.service';
import {
  DEFAULT_DATABASE_SCHEMA,
  qualifiedSchemaName,
  withDatabaseSearchPath,
} from '../../src/database/database-schema';
import { migrate } from '../../src/database/migrate';
import { InvoiceCreationBlockedError } from '../../src/modules/invoices/errors/invoice-process.errors';
import { InvoiceProcessRepository } from '../../src/modules/invoices/repositories/invoice-process.repository';
import { InvoiceRecordRepository } from '../../src/modules/invoices/repositories/invoice-record.repository';
import { InvoiceIdempotencyService } from '../../src/modules/invoices/services/invoice-idempotency.service';
import {
  validInvoiceProcessParams,
  validInvoiceRecordParams,
} from './fixtures';

describe('InvoiceIdempotencyService (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let moduleRef: TestingModule;
  let invoiceIdempotencyService: InvoiceIdempotencyService;
  let invoiceProcessRepository: InvoiceProcessRepository;
  let invoiceRecordRepository: InvoiceRecordRepository;

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

    moduleRef = await Test.createTestingModule({
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
        InvoiceIdempotencyService,
      ],
    }).compile();

    invoiceIdempotencyService = moduleRef.get(InvoiceIdempotencyService);
    invoiceProcessRepository = moduleRef.get(InvoiceProcessRepository);
    invoiceRecordRepository = moduleRef.get(InvoiceRecordRepository);
  }, 120_000);

  afterAll(async () => {
    const databaseService = moduleRef.get(DatabaseService);
    await databaseService.onModuleDestroy();
    await pool.end();
    await container.stop();
  });

  beforeEach(async () => {
    const schema = qualifiedSchemaName(DEFAULT_DATABASE_SCHEMA);
    await pool.query(`
      TRUNCATE TABLE
        ${schema}.invoice_records,
        ${schema}.invoice_processes
      RESTART IDENTITY CASCADE
    `);
  });

  it('returns same process on duplicate claim without second row', async () => {
    const first = await invoiceIdempotencyService.claim('deal-100', 'FULL');
    const second = await invoiceIdempotencyService.claim('deal-100', 'FULL');

    expect(second.id).toBe(first.id);

    const count = await pool.query(
      `SELECT count(*)::int AS count FROM ${qualifiedSchemaName(DEFAULT_DATABASE_SCHEMA)}.invoice_processes WHERE bitrix_deal_id = $1 AND invoice_type = $2`,
      ['deal-100', 'FULL'],
    );
    expect(count.rows[0].count).toBe(1);
  });

  it('handles parallel claim race with single process row', async () => {
    const [first, second] = await Promise.all([
      invoiceIdempotencyService.claim('deal-race', 'FULL'),
      invoiceIdempotencyService.claim('deal-race', 'FULL'),
    ]);

    expect(first.id).toBe(second.id);

    const count = await pool.query(
      `SELECT count(*)::int AS count FROM ${qualifiedSchemaName(DEFAULT_DATABASE_SCHEMA)}.invoice_processes WHERE bitrix_deal_id = $1`,
      ['deal-race'],
    );
    expect(count.rows[0].count).toBe(1);
  });

  it('allows separate processes for different invoice types on same deal', async () => {
    const advance = await invoiceIdempotencyService.claim('deal-multi', 'ADVANCE');
    const final = await invoiceIdempotencyService.claim('deal-multi', 'FINAL');

    expect(advance.id).not.toBe(final.id);
    expect(advance.invoice_type).toBe('ADVANCE');
    expect(final.invoice_type).toBe('FINAL');
  });

  it('blocks createInvoice when invoice record exists for process', async () => {
    const process = await invoiceProcessRepository.create(
      validInvoiceProcessParams(),
    );

    await invoiceRecordRepository.insert(validInvoiceRecordParams(process.id));

    await expect(
      invoiceIdempotencyService.assertCanCreateInvoice(process.id),
    ).rejects.toBeInstanceOf(InvoiceCreationBlockedError);
  });
});
