# MedCore Project

Sistema de gestão médica desenvolvido com NestJS e Prisma, com foco em SaaS multi-tenant.

## 📒 Histórico de Mudanças
- Consulte `CHANGELOG.md` para o histórico cronológico de evolução do projeto.

## 🔁 CI/CD
- Pipeline GitHub Actions para backend em `.github/workflows/backend-ci.yml`.
- Executa automaticamente em `push`/`pull_request` para `main` e `develop`.
- Etapas:
  - `npm ci`
  - `prisma:generate`
  - `prisma:deploy`
  - `prisma:seed`
  - `lint`
  - `build`
  - sobe backend e executa `scripts/bateria_api_backend.sh`

## 🧭 Padrão de Entregas
- Processo operacional documentado em `docs/OPERACAO_ENTREGAS.md`.
- Script de publicação de entrega grande: `scripts/push_grande_entrega.sh`.
- O script agora valida `ssh-agent` e aplica retry automático para falhas DNS transitórias no `git push`.
- Pré-requisito (uma vez por sessão do servidor): carregar a chave SSH no agente:
```bash
ssh-add ~/.ssh/id_ed25519
```

## 💾 Backup de Banco
- Pasta versionada: `backup/`
- Script manual: `scripts/backup_db_medcore.sh`
- Arquivo gerado: `backup/medcore_db_YYYYMMDD_HHMMSS.sql.gz`
- Agendamento ativo no servidor (cron diário às 14:00):
```cron
0 14 * * * /home/sppro/medcore-project/scripts/backup_db_medcore.sh >> /home/sppro/medcore-project/backup/backup_cron.log 2>&1
```
- Script de restore controlado: `scripts/restore_db_medcore.sh`
- Teste operacional de restore (base temporária): `scripts/validar_restore_backup.sh`
- Exemplo de restore (destrutivo):
```bash
cd /home/sppro/medcore-project
BACKUP_FILE=/home/sppro/medcore-project/backup/medcore_db_YYYYMMDD_HHMMSS.sql.gz CONFIRM_RESTORE=yes ./scripts/restore_db_medcore.sh
```


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
  - `GET /appointments/slots`
  - `PATCH /appointments/:id/complete`
  - `PATCH /appointments/:id/cancel`
  - `PATCH /appointments/:id/reschedule`
- Regras aplicadas:
  - Médico e paciente devem pertencer à mesma organização do usuário autenticado.
  - Usuário só acessa filiais permitidas em `branch_ids`/`branchIds` do JWT.
  - Médico precisa estar vinculado à filial em `user_branches`.
  - Data de agendamento precisa ser futura (`@IsFutureDate`).
  - Cancelamento/Reagendamento bloqueados para agendamentos já concluídos/cancelados.
  - Motivo operacional registrado em `notes` para trilha de auditoria da consulta.
  - Bloqueio de conflito de agenda: mesmo médico não pode ter duas consultas no mesmo horário (`400`).
  - Slots disponíveis ignoram horários passados (quando a data consultada é hoje em UTC).
  - Slots disponíveis respeitam janela de pausa configurável (ex.: almoço).
  - Slots disponíveis respeitam agenda semanal do médico quando configurada em `doctor_schedules`.
  - Se não houver agenda semanal ativa para o dia, o sistema aplica fallback para variáveis globais da agenda.

### Webhook n8n
- Ao concluir uma consulta (`PATCH /appointments/:id/complete`), a API dispara webhook assíncrono.
- Variável utilizada: `N8N_APPOINTMENTS_WEBHOOK_URL`.

### Documentação (Swagger)
- Swagger configurado com bearer token JWT.
- Acesse: `http://localhost:3000/api` (ou `http://192.168.0.109:3000/api`).

### Observabilidade
- Endpoints de healthcheck:
  - `GET /health`
  - `GET /health/db`
  - `GET /health/n8n`
  - `GET /health/metrics`
  - `GET /health/alert-check`
  - `GET /health/alerts`
- `/health` retorna status consolidado (`ok`, `degraded`, `error`).
- Quando `N8N_APPOINTMENTS_WEBHOOK_URL` não estiver definida, o status fica `degraded` sem derrubar a API.
- `GET /health/alert-check` dispara alerta operacional via webhook quando status estiver `degraded`/`error`.
- `GET /health/alerts` agora retorna histórico persistido em banco (`health_alert_events`).

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
- Endpoint `GET /auth/login-lock` para inspeção de bloqueio de login (ADMIN).
- Endpoint `POST /auth/login-lock/clear` para desbloqueio manual de login (ADMIN).
- Limite de sessões ativas por usuário/organização com revogação automática das mais antigas.
- Proteção de brute force no login com bloqueio progressivo por tentativas inválidas (email + IP).
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
- `doctor_schedules`

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
- `AUTH_MAX_FAILED_ATTEMPTS`
- `AUTH_ATTEMPT_WINDOW_MINUTES`
- `AUTH_LOCK_MINUTES`
- `APPOINTMENT_DURATION_MINUTES`
- `APPOINTMENT_SLOT_INTERVAL_MINUTES`
- `APPOINTMENT_WORKDAY_START_HOUR`
- `APPOINTMENT_WORKDAY_END_HOUR`
- `APPOINTMENT_BREAK_START_HOUR`
- `APPOINTMENT_BREAK_END_HOUR`
- `N8N_APPOINTMENTS_WEBHOOK_URL`
- `HEALTH_ALERT_WEBHOOK_URL`
- `HEALTH_ALERT_COOLDOWN_MINUTES`

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
- `GET /health`
- `GET /health/db`
- `GET /health/metrics`
- `GET /health/alert-check`
- `GET /health/alerts`
- proteção de brute force em login (`401` até limite e `429` ao bloquear)
- bloqueio de conflito de horário por médico em agendamento (`400`, janela configurável)
- `POST /auth/login`
- `GET /users/me`
- `POST /auth/refresh`
- `POST /auth/logout`
- validação de refresh revogado (`401`)
- `POST /auth/logout-all`
- `POST /appointments`
- `GET /appointments`
- `GET /appointments/slots`
- `PATCH /appointments/:id/complete`
- `PATCH /appointments/:id/reschedule`
- `PATCH /appointments/:id/cancel`

Variáveis úteis da bateria:
- `ENABLE_BRUTE_FORCE_CHECK` (default `1`)
- `LOGIN_MAX_FAILED_ATTEMPTS` (default `5`)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` (valida endpoints admin de lock quando informados)
- `BRUTE_FORCE_TEST_IP` (default `198.51.100.10`)

## 🛠️ Setup e Execução
```bash
cd backend
npm install
npm run prisma:generate
npm run build
npm run start:dev
```

Subida segura (evita erro `EADDRINUSE` na porta 3000):
```bash
cd /home/sppro/medcore-project
./scripts/start_backend_safe.sh
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
- usuário admin demo (`admin@medcore.com` / `123456`)
- paciente demo
- vínculo médico-filial em `user_branches`
- agenda semanal padrão do médico em `doctor_schedules` (segunda a sexta, 08h-18h, pausa 12h-13h)
- gera `backend/.seed.env` com `TEST_*` e IDs para a bateria automática

Fluxo rápido de validação real:
```bash
cd backend
npm run prisma:seed

cd ..
BASE_URL=http://127.0.0.1:3000 ./scripts/bateria_api_backend.sh
```

Validação local fim a fim (comando único):
```bash
cd /home/sppro/medcore-project
BASE_URL=http://127.0.0.1:3000 ./scripts/validar_backend_local.sh
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
