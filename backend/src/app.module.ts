import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // Adicione isso
import { PatientsModule } from './patients/patients.module';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot(), // Isso carrega o arquivo .env automaticamente
    PatientsModule
  ],
  providers: [PrismaService],
})
export class AppModule {}