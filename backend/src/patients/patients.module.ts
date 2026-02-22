import { Module } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PatientsController } from './patients.controller';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaPatientsRepository } from '../infra/repositories/prisma-patients.repository';
import { REPOSITORY_TOKENS } from '../domain/repositories/repository-tokens';

@Module({
  controllers: [PatientsController],
  providers: [
    PatientsService,
    PrismaService,
    {
      provide: REPOSITORY_TOKENS.PATIENTS,
      useClass: PrismaPatientsRepository,
    },
  ],
})
export class PatientsModule {}
