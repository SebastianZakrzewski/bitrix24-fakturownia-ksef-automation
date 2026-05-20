import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class N8nApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.header('x-api-key');
    const expectedKey = this.configService.get<string>('N8N_API_KEY');

    if (!expectedKey || providedKey !== expectedKey) {
      throw new UnauthorizedException('Missing or invalid n8n API key.');
    }

    return true;
  }
}
