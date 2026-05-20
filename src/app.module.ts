import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { Bitrix24Module } from './modules/bitrix24/bitrix24.module';
import { ClientPanelModule } from './modules/client-panel/client-panel.module';
import { HealthModule } from './modules/health/health.module';
import { InvoicesModule } from './modules/invoices/invoices.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    InvoicesModule,
    Bitrix24Module,
    ClientPanelModule,
    HealthModule,
  ],
})
export class AppModule {}
