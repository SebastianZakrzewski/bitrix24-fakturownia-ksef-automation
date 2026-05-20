import { Module } from '@nestjs/common';
import { ClientPanelAuthGuard } from '../../common/guards/client-panel-auth.guard';
import { ClientInvoiceProcessesController } from './controllers/client-invoice-processes.controller';
import { PanelAdminUserRepository } from './repositories/panel-admin-user.repository';
import { ClientInvoiceProcessesService } from './services/client-invoice-processes.service';

@Module({
  controllers: [ClientInvoiceProcessesController],
  providers: [
    ClientPanelAuthGuard,
    ClientInvoiceProcessesService,
    PanelAdminUserRepository,
  ],
})
export class ClientPanelModule {}
