import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ClientPanelAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.header('x-panel-api-key');
    const expectedKey = this.configService.get<string>('PANEL_API_KEY');

    if (!expectedKey || providedKey !== expectedKey) {
      throw new UnauthorizedException(
        'Missing or invalid client panel credentials.',
      );
    }

    return true;
  }
}
