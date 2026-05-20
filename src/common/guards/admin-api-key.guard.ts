import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.header('x-api-key');
    const expectedKey = this.configService.get<string>('ADMIN_API_KEY');

    if (!expectedKey || providedKey !== expectedKey) {
      throw new UnauthorizedException('Missing or invalid admin API key.');
    }

    return true;
  }
}
