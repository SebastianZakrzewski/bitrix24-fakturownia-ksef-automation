import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createValidationPipe } from './common/pipes/setup-validation.pipe';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(createValidationPipe());
  const configService = app.get(ConfigService);
  const panelOrigin = configService.get<string>('PANEL_ORIGIN');

  if (panelOrigin) {
    app.enableCors({ origin: panelOrigin });
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
}

void bootstrap();
