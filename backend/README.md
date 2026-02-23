# MedCore Backend

API do projeto MedCore desenvolvida com NestJS + Prisma + PostgreSQL.

## 📒 Histórico de Mudanças
- Histórico consolidado do projeto: `../CHANGELOG.md`
- CI backend: `../.github/workflows/backend-ci.yml`

## 🚀 Atualizações Recentes
- Implementação de módulo de agendamentos multi-tenant.
- Implementação de cancelamento e reagendamento de agendamentos.
- Implementação de autenticação com `POST /auth/login`.
- Implementação de rotação de sessão com `POST /auth/refresh`.
- Implementação de revogação de sessão com `POST /auth/logout`.
- Implementação de revogação global de sessões com `POST /auth/logout-all`.
- Implementação de perfil autenticado com `GET /users/me`.
- Implementação de RBAC com `Role`, `@Roles` e `RolesGuard`.
- Implementação global de `LoggingInterceptor`, `TransformInterceptor` e `GlobalExceptionFilter`.
- Adoção de Repository Pattern (`domain/repositories` + implementações Prisma).
- Validação de data futura com `@IsFutureDate`.
- JWT com Passport e `@CurrentUser` para contexto autenticado.
- Swagger com autenticação Bearer JWT.
- Webhook assíncrono para n8n ao concluir agendamento.
- Healthchecks e métricas básicas de processo (`/health/*`).

## 🧱 Stack
- NestJS 11
- Prisma 6
- PostgreSQL
- Passport JWT
- Swagger

## 📦 Módulos Atuais
- `auth`
- `users`
- `patients`
- `appointments`
- `prisma`
- `common` (auth, guards, decorators, strategy)
- `integrations` (n8n)

## 🔐 Segurança e Escopo
- Isolamento por `organization_id`.
- Escopo de filial por `branch_ids` no token.
- Regra de vínculo médico-filial via `user_branches`.
- Login exige `password_hash` em formato bcrypt (`$2a$`, `$2b$` ou `$2y$`).
- Refresh tokens persistidos com hash e rotação segura.
- Limite de sessões ativas com revogação automática dos refresh tokens mais antigos.
- Política de higiene aplicada em autenticação: purge de tokens expirados/revogados.
- Login protegido contra brute force com bloqueio progressivo por tentativas inválidas (email + IP).

## ⚙️ Execução Local
```bash
npm install
npm run prisma:generate
npm run build
npm run start:dev
```

## 🗃️ Prisma
Schema oficial deste backend:
- `backend/prisma/schema.prisma`

Comandos:
```bash
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:seed
```

O seed é idempotente e garante:
- organização demo
- filial demo
- médico demo com vínculo em `user_branches`
- paciente demo

Credenciais e IDs de teste gerados/atualizados:
- `TEST_EMAIL=medico@medcore.com`
- `TEST_PASSWORD=123456`
- `ORGANIZATION_ID`, `BRANCH_ID`, `DOCTOR_ID`, `PATIENT_ID` (exibidos no stdout)
- arquivo `backend/.seed.env` com variáveis `TEST_*` para uso direto na bateria

## 🔒 Migração de Senhas Legadas
Se houver usuários com senha em texto plano, atualize para bcrypt:
```bash
node -e "const {hashSync}=require('bcryptjs'); console.log(hashSync('123456',10));"
```
Depois aplique no banco (exemplo):
```sql
UPDATE users
SET password_hash = '<hash_bcrypt>'
WHERE email = 'medico@medcore.com';
```

## 📘 Documentação
- Swagger: `http://localhost:3000/api`
- Swagger (rede local): `http://192.168.0.109:3000/api`

## 📈 Observabilidade
- `GET /health`: status consolidado da API (DB + n8n).
- `GET /health/db`: teste de conectividade com PostgreSQL.
- `GET /health/n8n`: teste de conectividade do webhook n8n.
- `GET /health/metrics`: uptime e uso de memória do processo.
- `GET /health/alert-check`: dispara alerta operacional via webhook se status estiver `degraded`/`error`.
- Logs HTTP emitidos em JSON estruturado (`event=http_request_completed`).

## 🧪 Checks de Qualidade
```bash
npm run lint
npm run build
npm test -- --runInBand
```

## 🧪 Testes E2E
- Suíte E2E principal: `test/app.e2e-spec.ts`
- Cobertura de fluxo:
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `POST /auth/logout`
  - `POST /auth/logout-all`
  - `GET /users/me`
  - `POST /appointments`
  - `GET /appointments`
  - `PATCH /appointments/:id/complete`
  - `PATCH /appointments/:id/reschedule`
  - `PATCH /appointments/:id/cancel`

Execução:
```bash
npm run test:e2e
```

## 🧪 Bateria Real de API
Script de smoke para validar integração HTTP ponta a ponta:
- Arquivo: `../scripts/bateria_api_backend.sh`
- Fluxos: auth/login, users/me, auth/refresh, auth/logout, auth/logout-all e appointments.
- Se `backend/.seed.env` existir, a bateria usa os valores `TEST_*` automaticamente.

## 📝 Padrão de Atualização deste README
Sempre atualizar, a cada entrega:
1. `Atualizações Recentes`
2. `Módulos Atuais`
3. `Segurança e Escopo`
4. `Checks de Qualidade`
