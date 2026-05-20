import { Controller, Get, UseGuards } from '@nestjs/common';
import { ClientPanelAuthGuard } from '../../../common/guards/client-panel-auth.guard';
import { ClientInvoiceProcessListItemDto } from '../dto/client-invoice-process-list-item.dto';
import { ClientInvoiceProcessesService } from '../services/client-invoice-processes.service';

@Controller('client/invoice-processes')
@UseGuards(ClientPanelAuthGuard)
export class ClientInvoiceProcessesController {
  constructor(
    private readonly clientInvoiceProcessesService: ClientInvoiceProcessesService,
  ) {}

  @Get()
  list(): ClientInvoiceProcessListItemDto[] {
    return this.clientInvoiceProcessesService.listInvoiceProcesses();
  }
}
