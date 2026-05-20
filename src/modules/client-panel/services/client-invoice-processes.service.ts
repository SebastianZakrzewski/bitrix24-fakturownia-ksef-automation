import { Injectable } from '@nestjs/common';
import { ClientInvoiceProcessListItemDto } from '../dto/client-invoice-process-list-item.dto';

@Injectable()
export class ClientInvoiceProcessesService {
  listInvoiceProcesses(): ClientInvoiceProcessListItemDto[] {
    return [];
  }
}
