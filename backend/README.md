# MedCore Backend

API do projeto MedCore desenvolvida com NestJS + Prisma + PostgreSQL.

## 📒 Histórico de Mudanças
- Histórico consolidado do projeto: `../CHANGELOG.md`
- Estratégia de integração arquitetural com ProformaFarmERP: `../docs/INTEGRACAO_PROFORMAFARM_MEDCORE.md`
- CI backend: `../.github/workflows/backend-ci.yml`
- Publicação automática de entrega grande: `../scripts/push_grande_entrega.sh` (com retry DNS e validação de `ssh-agent`).
- Backup de banco em `../backup` com script `../scripts/backup_db_medcore.sh`, restore controlado via `../scripts/restore_db_medcore.sh`, backup diário às 14:00 e teste semanal de restore (domingo 14:30).
- Monitor operacional de backup/restore: `../scripts/monitor_backup_status.sh`.

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
- Outbox transacional para eventos de agendamento (`domain_outbox_events`).
- Endpoint ADMIN para replay manual de eventos FAILED (`POST /outbox/replay-failed`) com auditoria em `outbox_replay_audit`.
- Dashboard operacional ADMIN do Outbox com:
- `GET /outbox/metrics`
- `GET /outbox/events`
- `GET /outbox/replay-audit`
- `GET /outbox/maintenance-audit`
- `POST /outbox/cleanup` (limpeza controlada com `dry_run=true` por padrão)
- `GET /outbox/audit/export` (JSON/CSV com filtro temporal)
- `POST /outbox/audit/cleanup` (retenção de auditorias com `dry_run`)
- Limpeza automática do Outbox com retenção configurável, guarda de ambiente e auditoria (`OutboxMaintenanceService`).
- Processador assíncrono de Outbox para entrega de eventos ao n8n.
- Infra n8n isolada em banco dedicado (`n8n_db`) para evitar acoplamento de schema com `medcore_db`.
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
- `outbox`
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
- Agendamentos com proteção de conflito de horário por médico (mesmo horário retorna `400`).
- Janela de conflito configurável por `APPOINTMENT_DURATION_MINUTES` (default 30).
- Endpoint de disponibilidade: `GET /appointments/slots` (slots por médico/filial/data).
- Slots desconsideram horários passados (no dia atual) e respeitam pausa configurável de agenda.
- Slots respeitam agenda semanal ativa por médico (`doctor_schedules`) quando configurada.
- Na ausência de agenda semanal para o dia, o cálculo usa fallback por variáveis globais (`APPOINTMENT_WORKDAY_*` e `APPOINTMENT_BREAK_*`).
- Eventos de agendamento persistidos em Outbox na mesma transação do write principal.
- Endpoint administrativo para inspeção e limpeza de lock de login:
  - `GET /auth/login-lock` (ADMIN)
  - `POST /auth/login-lock/clear` (ADMIN)

## ⚙️ Execução Local
```bash
npm install
npm run prisma:generate
npm run build
npm run start:dev
```

Arquivo base de configuração:
```bash
cp .env.example .env
```

Subida segura (evita erro `EADDRINUSE` em 0.0.0.0:3000):
```bash
cd /home/sppro/medcore-project
./scripts/start_backend_safe.sh
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

## ♻️ Outbox Cleanup Automático (Produção)
A limpeza automática é segura por padrão (`disabled` + `dry_run=true`).

Configuração recomendada para produção:
```env
OUTBOX_AUTO_CLEANUP_ENABLED=true
OUTBOX_AUTO_CLEANUP_ALLOW_NON_PROD=false
OUTBOX_AUTO_CLEANUP_RUN_ON_START=false
OUTBOX_AUTO_CLEANUP_INTERVAL_MS=86400000
OUTBOX_AUTO_CLEANUP_RETENTION_DAYS=30
OUTBOX_AUTO_CLEANUP_INCLUDE_FAILED=false
OUTBOX_AUTO_CLEANUP_DRY_RUN=false
OUTBOX_AUTO_AUDIT_CLEANUP_ENABLED=true
OUTBOX_AUDIT_RETENTION_DAYS=90
OUTBOX_MAINTENANCE_SYSTEM_USER_ID=00000000-0000-0000-0000-000000000000
OUTBOX_ADMIN_RATE_LIMIT_WINDOW_SECONDS=60
OUTBOX_ADMIN_RATE_LIMIT_MAX_REQUESTS=120
```

Recomendação de rollout:
1. Ativar primeiro com `OUTBOX_AUTO_CLEANUP_DRY_RUN=true` por 24h.
2. Verificar `GET /outbox/maintenance-audit`.
3. Alterar para `OUTBOX_AUTO_CLEANUP_DRY_RUN=false`.

O seed é idempotente e garante:
- organização demo
- filial demo
- médico demo com vínculo em `user_branches`
- admin demo para rotas operacionais protegidas
- paciente demo
- agenda semanal do médico demo em `doctor_schedules` (seg-sex, 08h-18h, pausa 12h-13h)

Credenciais e IDs de teste gerados/atualizados:
- `TEST_EMAIL=medico@medcore.com`
- `TEST_PASSWORD=123456`
- `ADMIN_EMAIL=admin@medcore.com`
- `ADMIN_PASSWORD=123456`
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

## 🔌 Operação n8n
- URL de acesso: `http://192.168.0.109:5678`
- Banco dedicado do n8n: `n8n_db` (definido em `docker-compose.yml`).
- Em caso de reset inesperado de setup/owner:
```bash
cd /home/sppro/medcore-project
docker compose stop n8n
docker compose up -d n8n
```
- Em caso de erro de owner no setup:
```bash
docker exec -it medcore-n8n n8n user-management:reset
docker compose restart n8n
```

## 📈 Observabilidade
- `GET /health`: status consolidado da API (DB + n8n).
- `GET /health/db`: teste de conectividade com PostgreSQL.
- `GET /health/n8n`: teste de conectividade do webhook n8n.
- Quando o probe `GET` no webhook retorna `404`, o health do n8n é classificado como `degraded` (caso típico de webhook apenas `POST`).
- `GET /health/metrics`: uptime e uso de memória do processo.
- `GET /health/outbox`: métricas do pipeline Outbox (`pending`, `failed`, `latência`).
- `GET /health/alert-check`: dispara alerta operacional via webhook se status estiver `degraded`/`error`.
- `GET /health/alerts`: histórico recente de alertas operacionais disparados.
- Histórico de alertas persistido em banco na tabela `health_alert_events`.
- Auditoria de replay manual persistida em `outbox_replay_audit`.
- Auditoria de limpeza controlada persistida em `outbox_maintenance_audit`.
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
- Se `ADMIN_EMAIL` e `ADMIN_PASSWORD` estiverem disponíveis, valida também:
  - `GET /auth/login-lock`
  - `POST /auth/login-lock/clear`
- `ENABLE_OUTBOX_CLEANUP_CHECK=1` habilita validação do fluxo admin de cleanup/auditoria do Outbox dentro da bateria.
- A bateria valida também export de auditoria (`GET /outbox/audit/export`) e retenção de auditoria (`POST /outbox/audit/cleanup`).

Teste operacional focado no cleanup do Outbox:
- Arquivo: `../scripts/testar_outbox_cleanup.sh`
- Fluxo: login admin -> auditoria inicial -> cleanup dry-run -> auditoria pós-cleanup -> export JSON/CSV -> cleanup de auditorias (dry-run).

Validação local fim a fim (comando único):
- Arquivo: `../scripts/validar_backend_local.sh`
- Fluxo: `docker compose up -d alloydb` + `prisma:deploy` + `prisma:seed` + bateria HTTP completa.
- Execução:
```bash
cd /home/sppro/medcore-project
BASE_URL=http://127.0.0.1:3000 ./scripts/validar_backend_local.sh
```

## 📝 Padrão de Atualização deste README
Sempre atualizar, a cada entrega:
1. `Atualizações Recentes`
2. `Módulos Atuais`
3. `Segurança e Escopo`
4. `Checks de Qualidade`
