import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { REPOSITORY_TOKENS } from '../domain/repositories/repository-tokens';
import { PrismaPatientsRepository } from '../infra/repositories/prisma-patients.repository';
import { PrismaAppointmentsRepository } from '../infra/repositories/prisma-appointments.repository';
import { N8nWebhookService } from '../integrations/n8n/n8n-webhook.service';
import { JwtStrategy } from '../common/strategies/jwt.strategy';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [AppointmentsController],
  providers: [
    PrismaService,
    AppointmentsService,
    N8nWebhookService,
    JwtStrategy,
    {
      provide: REPOSITORY_TOKENS.PATIENTS,
      useClass: PrismaPatientsRepository,
    },
    {
      provide: REPOSITORY_TOKENS.APPOINTMENTS,
      useClass: PrismaAppointmentsRepository,
    },
  ],
})
export class AppointmentsModule {}
