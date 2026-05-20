import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import {
  resolveDatabaseSchema,
  withDatabaseSearchPath,
} from './database-schema';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly configService: ConfigService) {}

  getSchema(): string {
    return resolveDatabaseSchema(this.configService.get<string>('DATABASE_SCHEMA'));
  }

  getPool(): Pool {
    if (!this.pool) {
      const databaseUrl = this.configService.get<string>('DATABASE_URL');
      if (!databaseUrl) {
        throw new Error('DATABASE_URL is not configured');
      }

      const connectionString = withDatabaseSearchPath(databaseUrl, this.getSchema());
      this.pool = new Pool({ connectionString });
    }

    return this.pool;
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.getPool().query<T>(text, params);
  }

  async getClient(): Promise<PoolClient> {
    return this.getPool().connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
