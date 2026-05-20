import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { rethrowDatabaseError } from '../../../database/database.errors';
import { mapPanelAdminUserRow } from '../mappers/panel-admin-user.persistence-mapper';
import type {
  InsertPanelAdminUserParams,
  PanelAdminUserRow,
} from '../persistence/panel-admin-user.persistence';

@Injectable()
export class PanelAdminUserRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(params: InsertPanelAdminUserParams): Promise<PanelAdminUserRow> {
    try {
      const result = await this.databaseService.query(
        `
          INSERT INTO panel_admin_users (email, password_hash, is_active)
          VALUES ($1, $2, $3)
          RETURNING *
        `,
        [params.email, params.password_hash, params.is_active ?? true],
      );

      return mapPanelAdminUserRow(result.rows[0]);
    } catch (error) {
      rethrowDatabaseError(error);
    }
  }
}
