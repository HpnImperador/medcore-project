import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PatientsModule } from './patients/patients.module';
import { PrismaService } from './prisma/prisma.service';
import { AppointmentsModule } from './appointments/appointments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PatientsModule,
    AppointmentsModule,
  ],
  providers: [PrismaService],
})
export class AppModule {}
