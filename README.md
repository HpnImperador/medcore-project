# MedCore Project

Sistema de gestão médica desenvolvido com NestJS e Prisma, com foco em SaaS multi-tenant.

## 📒 Histórico de Mudanças
- Consulte `CHANGELOG.md` para o histórico cronológico de evolução do projeto.

## 🧭 Padrão de Entregas
- Processo operacional documentado em `docs/OPERACAO_ENTREGAS.md`.
- Script de publicação de entrega grande: `scripts/push_grande_entrega.sh`.

## 🚀 Atualizações Recentes

### Arquitetura e Multi-tenant
- Isolamento de dados por `organization_id`.
- Controle de escopo por filiais via `user_branches`.
- Implementação de **Repository Pattern** para desacoplar serviços do Prisma.

### Módulo de Agendamentos
- Criação da entidade `appointments` no schema Prisma com vínculos para:
  - `organizations`
  - `branches`
  - `patients`
  - `users` (médicos)
- Endpoints implementados:
  - `POST /appointments`
  - `GET /appointments`
  - `PATCH /appointments/:id/complete`
- Regras aplicadas:
  - Médico e paciente devem pertencer à mesma organização do usuário autenticado.
  - Usuário só acessa filiais permitidas em `branch_ids`/`branchIds` do JWT.
  - Médico precisa estar vinculado à filial em `user_branches`.
  - Data de agendamento precisa ser futura (`@IsFutureDate`).

### Webhook n8n
- Ao concluir uma consulta (`PATCH /appointments/:id/complete`), a API dispara webhook assíncrono.
- Variável utilizada: `N8N_APPOINTMENTS_WEBHOOK_URL`.

### Documentação (Swagger)
- Swagger configurado com bearer token JWT.
- Acesse: `http://localhost:3000/api` (ou `http://192.168.0.109:3000/api`).

### Interceptors e Exception Filter
- `LoggingInterceptor` global para auditoria de método, rota, status, duração, ator e IP.
- `TransformInterceptor` global com envelope padrão `{ data, meta }`.
- `GlobalExceptionFilter` global com tratamento de `HttpException` e erros conhecidos do Prisma.

### Validação Customizada
- **@IsFutureDate**: decorador customizado para impedir agendamentos no passado.
- Integrado ao `ValidationPipe` global (`whitelist: true`, `transform: true`).

### Autenticação
- Endpoint `POST /auth/login` implementado com emissão de JWT.
- Endpoint `POST /auth/refresh` implementado com rotação segura de refresh token.
- Endpoint `POST /auth/logout` implementado para revogação de refresh token.
- Endpoint `POST /auth/logout-all` implementado para revogar todas as sessões do usuário.
- Limite de sessões ativas por usuário/organização com revogação automática das mais antigas.
- Endpoint `GET /users/me` implementado para perfil do usuário autenticado.
- Proteção de rotas com `JwtAuthGuard` (Passport JWT).
- RBAC implementado com `Role`, `@Roles` e `RolesGuard`.
- Login exige `password_hash` em bcrypt para validação de credenciais.
- Decorador `@CurrentUser` para extrair contexto autenticado nas rotas.

## 📌 Status dos Itens Arquiteturais (Roteiro)
Itens mencionados como diretriz e que devem permanecer no roadmap de evolução:
- Testes E2E dedicados para autenticação/usuário

Observação: este README será mantido incrementalmente para refletir exatamente o que está implementado em cada etapa.

## 🧩 Estrutura de Domínio Atual
- `organizations`
- `branches`
- `users`
- `user_branches`
- `patients`
- `appointments`

## 🔐 Payload JWT Esperado
Campos mínimos no token:
- `sub` (ou `user_id` / `id`)
- `organization_id` (ou `organizationId`)
- `branch_ids` (ou `branchIds`)

Exemplo:
```json
{
  "sub": "6ef3ab38-a6b8-4cb7-9a5a-182e6ffdc5c4",
  "organization_id": "f8f79fe1-c4cf-4d98-b6e5-e5dd574029f4",
  "branch_ids": ["f10f3f31-93e0-4f74-84cf-3d0864f0529e"],
  "role": "DOCTOR"
}
```

## ⚙️ Variáveis de Ambiente (backend/.env)
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `JWT_MAX_ACTIVE_SESSIONS`
- `N8N_APPOINTMENTS_WEBHOOK_URL`

## 🧪 Testes

### Rodando Testes Unitários
```bash
cd backend
npm run test
```

### Rodando Testes E2E
```bash
cd backend
npm run test:e2e
```

### Rodando Bateria de API (smoke real)
```bash
cd /home/sppro/medcore-project
./scripts/bateria_api_backend.sh
```
Cobertura atual da bateria:
- `GET /api`
- `POST /auth/login`
- `GET /users/me`
- `POST /auth/refresh`
- `POST /auth/logout`
- validação de refresh revogado (`401`)
- `POST /auth/logout-all`
- `POST /appointments`
- `GET /appointments`
- `PATCH /appointments/:id/complete`

## 🛠️ Setup e Execução
```bash
cd backend
npm install
npm run prisma:generate
npm run build
npm run start:dev
```

## 🗃️ Migrações Prisma
```bash
cd backend
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:seed
```

O `prisma:seed` é idempotente e prepara base mínima para testes:
- organização e filial demo
- usuário médico demo (`medico@medcore.com` / `123456`)
- paciente demo
- vínculo médico-filial em `user_branches`
- gera `backend/.seed.env` com `TEST_*` e IDs para a bateria automática

Fluxo rápido de validação real:
```bash
cd backend
npm run prisma:seed

cd ..
BASE_URL=http://127.0.0.1:3000 ./scripts/bateria_api_backend.sh
```

## 🔎 Exemplo cURL (Agendamento)

Login:
```bash
curl -X POST "http://192.168.0.109:3000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "medico@medcore.com",
    "password": "123456"
  }'
```

Criar agendamento:
```bash
curl -X POST "http://192.168.0.109:3000/appointments" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id": "f10f3f31-93e0-4f74-84cf-3d0864f0529e",
    "patient_id": "8bcb577b-cbb8-4a19-8dca-ef8a8eeead29",
    "doctor_id": "6ef3ab38-a6b8-4cb7-9a5a-182e6ffdc5c4",
    "scheduled_at": "2026-03-15T14:00:00.000Z",
    "notes": "Retorno clínico."
  }'
```

Concluir agendamento:
```bash
curl -X PATCH "http://192.168.0.109:3000/appointments/<APPOINTMENT_ID>/complete" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

## ✅ Qualidade Atual (última varredura)
- `npm run lint` passou
- `npm run build` passou
- `npm test -- --runInBand` passou
