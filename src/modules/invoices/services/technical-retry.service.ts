import { Injectable, NotImplementedException } from '@nestjs/common';
import { TechnicalRetryRequestDto } from '../dto/technical-retry-request.dto';

@Injectable()
export class TechnicalRetryService {
  evaluateRetry(
    _invoiceProcessId: string,
    _request: TechnicalRetryRequestDto,
  ): never {
    throw new NotImplementedException(
      'Technical retry is not implemented in the V1 skeleton.',
    );
  }

  markReviewed(_invoiceProcessId: string): never {
    throw new NotImplementedException(
      'Mark reviewed is not implemented in the V1 skeleton.',
    );
  }
}
