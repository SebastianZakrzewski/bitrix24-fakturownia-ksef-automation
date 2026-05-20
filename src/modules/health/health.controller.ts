import { Controller, Get } from '@nestjs/common';

type HealthResponseDto = {
  status: 'ok';
};

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthResponseDto {
    return {
      status: 'ok',
    };
  }
}
