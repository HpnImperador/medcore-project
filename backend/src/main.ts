import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    // Permitimos o acesso tanto do localhost quanto do IP da rede
    origin: ['http://localhost:3001', 'http://192.168.0.109:3001'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Escutamos em '0.0.0.0' para que o backend aceite conexões externas no IP da rede
  await app.listen(3000, '0.0.0.0');
  console.log(`🚀 Backend rodando em: http://192.168.0.109:3000`);
}
bootstrap();