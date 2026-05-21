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
import { FakturowniaOrderRepository } from '../../src/modules/invoices/repositories/fakturownia-order.repository';
import { InvoiceProcessRepository } from '../../src/modules/invoices/repositories/invoice-process.repository';
import { validFakturowniaOrderParams, validInvoiceProcessParams } from './fixtures';

describe('FakturowniaOrderRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let fakturowniaOrderRepository: FakturowniaOrderRepository;
  let invoiceProcessRepository: InvoiceProcessRepository;

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
      providers: [FakturowniaOrderRepository, InvoiceProcessRepository],
    }).compile();

    fakturowniaOrderRepository = moduleRef.get(FakturowniaOrderRepository);
    invoiceProcessRepository = moduleRef.get(InvoiceProcessRepository);
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
        ${schema}.fakturownia_orders,
        ${schema}.invoice_processes
      RESTART IDENTITY CASCADE
    `);
  });

  it('inserts and finds order by bitrix_deal_id', async () => {
    const params = validFakturowniaOrderParams();
    const inserted = await fakturowniaOrderRepository.insert(params);

    expect(inserted.id).toBeDefined();
    expect(inserted.bitrix_deal_id).toBe('deal-100');
    expect(inserted.fakturownia_order_id).toBe('order-100');
    expect(inserted.fakturownia_order_number).toBe('ZAM/100/2026');
    expect(inserted.created_from_invoice_process_id).toBeNull();

    const found = await fakturowniaOrderRepository.findByBitrixDealId('deal-100');

    expect(found).toEqual(inserted);
  });

  it('rejects duplicate bitrix_deal_id', async () => {
    await fakturowniaOrderRepository.insert(validFakturowniaOrderParams());

    await expect(
      fakturowniaOrderRepository.insert(
        validFakturowniaOrderParams({
          fakturownia_order_id: 'order-200',
        }),
      ),
    ).rejects.toMatchObject({
      code: POSTGRES_UNIQUE_VIOLATION,
    } satisfies Partial<DatabaseConstraintError>);
  });

  it('rejects duplicate fakturownia_order_id', async () => {
    await fakturowniaOrderRepository.insert(validFakturowniaOrderParams());

    await expect(
      fakturowniaOrderRepository.insert(
        validFakturowniaOrderParams({
          bitrix_deal_id: 'deal-200',
        }),
      ),
    ).rejects.toMatchObject({
      code: POSTGRES_UNIQUE_VIOLATION,
    } satisfies Partial<DatabaseConstraintError>);
  });

  it('requires created_from_invoice_process_id to reference a real invoice_process', async () => {
    await expect(
      fakturowniaOrderRepository.insert(
        validFakturowniaOrderParams({
          created_from_invoice_process_id: '00000000-0000-4000-8000-000000000000',
        }),
      ),
    ).rejects.toMatchObject({
      code: POSTGRES_FOREIGN_KEY_VIOLATION,
    } satisfies Partial<DatabaseConstraintError>);
  });

  it('allows optional created_from_invoice_process_id when process exists', async () => {
    const process = await invoiceProcessRepository.create(validInvoiceProcessParams());

    const order = await fakturowniaOrderRepository.insert(
      validFakturowniaOrderParams({
        created_from_invoice_process_id: process.id,
      }),
    );

    expect(order.created_from_invoice_process_id).toBe(process.id);
  });
});
