# Changelog

Todas as mudanças relevantes do projeto serão documentadas neste arquivo.

Formato baseado em Keep a Changelog e versionamento semântico.

## [Unreleased]

### Planejado
- Testes E2E dos fluxos de autenticação e usuários.

### Adicionado
- Padronização operacional de entregas em `docs/OPERACAO_ENTREGAS.md`.
- Script de automação para commit/push de entrega grande:
  - `scripts/push_grande_entrega.sh`
- Módulo `auth` com endpoint `POST /auth/login` para emissão de JWT.
- Módulo `users` com endpoint `GET /users/me`.
- RBAC com `Role`, `@Roles` e `RolesGuard`.
- Repositório de usuários (`IUserRepository`) com implementação Prisma.
- `LoggingInterceptor` global com auditoria de request/response.
- `TransformInterceptor` global com envelope `{ data, meta }`.
- `GlobalExceptionFilter` global com mapeamento de erro HTTP/Prisma.
- Suíte de testes E2E para fluxos críticos em `test/app.e2e-spec.ts`:
  - login JWT
  - perfil autenticado
  - ciclo completo de agendamentos
- Hardening de autenticação: remoção do fallback de senha em texto plano; login agora aceita apenas `password_hash` bcrypt.
- Rotação de sessão implementada com refresh token:
  - `POST /auth/refresh`
  - `POST /auth/logout`
- Revogação global de sessões:
  - `POST /auth/logout-all`
- Persistência de refresh tokens com hash em banco (`refresh_tokens`).
- Higienização automática de refresh tokens expirados/revogados no fluxo de autenticação.
- Política de limite de sessões ativas por usuário/organização (`JWT_MAX_ACTIVE_SESSIONS`) com revogação automática dos tokens mais antigos.
- Script `scripts/bateria_api_backend.sh` atualizado para suportar envelope `{ data, meta }` e cobrir fluxo de sessão (`refresh`, `logout`, `logout-all`).
- Seed idempotente adicionado em `backend/prisma/seed.js` com script `npm run prisma:seed` para criar/atualizar organização, filial, médico, vínculo em `user_branches` e paciente de teste.
- Seed agora gera `backend/.seed.env`; `scripts/bateria_api_backend.sh` passa a consumir esse arquivo automaticamente como fallback para `TEST_*`.
- Endpoints de gestão operacional de consulta:
  - `PATCH /appointments/:id/reschedule`
  - `PATCH /appointments/:id/cancel`
- Regras de negócio para impedir cancelamento/reagendamento de consulta já concluída/cancelada, com registro de motivo em `notes`.
- Bateria API ampliada para validar `reschedule` e `cancel` em fluxo real.
- Módulo de observabilidade com healthchecks:
  - `GET /health`
  - `GET /health/db`
  - `GET /health/n8n`
  - `GET /health/metrics`
- Bateria API ampliada para validar health endpoints.
- Pipeline CI do backend adicionado em `.github/workflows/backend-ci.yml` com PostgreSQL de serviço, `prisma:deploy`, `prisma:seed`, `lint`, `build` e bateria API.
- `scripts/bateria_api_backend.sh` ajustado para usar caminho relativo do repositório ao carregar `backend/.seed.env`.
- Alertas operacionais adicionados com endpoint `GET /health/alert-check` e serviço de notificação por webhook (`HEALTH_ALERT_WEBHOOK_URL`) com cooldown (`HEALTH_ALERT_COOLDOWN_MINUTES`).
- Logging HTTP migrado para formato JSON estruturado no `LoggingInterceptor`.
- Bateria API ampliada para validar `GET /health/alert-check`.
- Hardening adicional de autenticação com bloqueio progressivo de login por tentativas inválidas (chave `email+ip`).
- Novas variáveis de configuração de proteção de login:
  - `AUTH_MAX_FAILED_ATTEMPTS`
  - `AUTH_ATTEMPT_WINDOW_MINUTES`
  - `AUTH_LOCK_MINUTES`
- Bateria API ampliada para validar brute force no login (`401` até limite configurado + `429` no bloqueio).
- Endpoints administrativos de suporte operacional para lock de login (somente ADMIN):
  - `GET /auth/login-lock`
  - `POST /auth/login-lock/clear`
- Seed idempotente atualizado com usuário `ADMIN` padrão (`admin@medcore.com`) para validações operacionais.
- Bateria API ampliada para validar `login-lock` e `login-lock/clear` quando credenciais admin estiverem disponíveis.
- Histórico de alertas operacionais adicionado com endpoint `GET /health/alerts`.
- Bateria API ampliada para validar `GET /health/alerts`.
- Persistência do histórico de alertas em PostgreSQL com tabela `health_alert_events` e migration dedicada.
- `HealthAlertService` migrado de buffer em memória para Repository Pattern com consulta persistida.
- Regra de negócio adicionada para bloquear conflito de agenda por médico no mesmo horário em criação/reagendamento.
- Regra evoluída para janela de sobreposição configurável via `APPOINTMENT_DURATION_MINUTES` (default 30 minutos).
- Endpoint `GET /appointments/slots` adicionado para consulta de disponibilidade por médico/filial/data.
- Configurações de agenda operacional adicionadas:
  - `APPOINTMENT_SLOT_INTERVAL_MINUTES`
  - `APPOINTMENT_WORKDAY_START_HOUR`
  - `APPOINTMENT_WORKDAY_END_HOUR`
- Slots do dia atual agora removem horários já passados.
- Janela de pausa configurável adicionada para disponibilidade:
  - `APPOINTMENT_BREAK_START_HOUR`
  - `APPOINTMENT_BREAK_END_HOUR`
- Bateria API ampliada para validar conflito de horário com retorno `400`.
- Script operacional `scripts/validar_backend_local.sh` adicionado para validação local fim a fim em comando único (docker alloydb + prisma deploy + seed + bateria API).
- Estrutura de backup adicionada com pasta `backup/` versionada e script `scripts/backup_db_medcore.sh` para dump do `medcore_db` em `.sql.gz` com retenção automática.
- Agendamento diário de backup documentado (cron às 14:00) com log em `backup/backup_cron.log`.
- Script de restore controlado `scripts/restore_db_medcore.sh` adicionado para recuperação via dump `.sql.gz`, com confirmação explícita (`CONFIRM_RESTORE=yes`).
- Script `scripts/validar_restore_backup.sh` adicionado para teste operacional de restore em base temporária (`medcore_restore_check`).
- Agendamento semanal do teste operacional de restore adicionado no servidor (domingo às 14:30) com log em `backup/restore_check_cron.log`.
- Script `scripts/monitor_backup_status.sh` adicionado para monitorar idade do último backup e último teste de restore, com códigos de saída para automação.
- Documento de integração técnica ProformaFarmERP -> MedCore adicionado em `docs/INTEGRACAO_PROFORMAFARM_MEDCORE.md`, com matriz adotar/adaptar e roadmap de 60 dias (Outbox + Guardian + governança).
- Outbox transacional implementado para eventos de `appointments`, com tabela `domain_outbox_events` e migration dedicada.
- Processador assíncrono de Outbox adicionado para entrega de eventos de agendamento ao n8n com retry por tentativas.
- Fluxos `create`, `complete`, `cancel` e `reschedule` de agendamento migrados para gravação de evento no Outbox na mesma transação do write.
- Endpoint operacional `GET /health/outbox` adicionado com métricas de backlog/falhas/latência do Outbox.
- Healthcheck consolidado agora considera status do Outbox para classificar `ok/degraded/error` e acionar alerta quando backlog ultrapassa limites configurados.
- Endpoint ADMIN `POST /outbox/replay-failed` adicionado para replay manual de eventos FAILED com auditoria persistida em `outbox_replay_audit`.
- Dashboard operacional ADMIN do Outbox adicionado com endpoints:
- `GET /outbox/metrics`
- `GET /outbox/events`
- `GET /outbox/replay-audit`
- `GET /outbox/maintenance-audit`
- `POST /outbox/cleanup` com modo seguro `dry_run=true` por padrão e auditoria em `outbox_maintenance_audit`.
- Automação de retenção do Outbox adicionada via `OutboxMaintenanceService`, com limpeza periódica configurável por ambiente e variáveis `OUTBOX_AUTO_CLEANUP_*` (desativada por padrão).
- Arquivo `backend/.env.example` adicionado com baseline de configuração (auth, appointments, outbox, health e cleanup automático).
- Script `scripts/testar_outbox_cleanup.sh` adicionado para validação operacional isolada do fluxo de limpeza/auditoria do Outbox com login admin automático.
- Bateria principal (`scripts/bateria_api_backend.sh`) passou a suportar flag `ENABLE_OUTBOX_CLEANUP_CHECK` para controlar a validação de cleanup/auditoria do Outbox.
- Agenda semanal por médico adicionada com tabela `doctor_schedules` e migration dedicada.
- `GET /appointments/slots` evoluído para priorizar agenda semanal ativa por dia da semana (`doctor_schedules`) com fallback para variáveis globais de agenda.
- Seed idempotente atualizado para criar/atualizar agenda semanal padrão do médico demo (segunda a sexta, 08h-18h, pausa 12h-13h).

## [2026-02-22]

### Adicionado
- Módulo de agendamentos com endpoints:
  - `POST /appointments`
  - `GET /appointments`
  - `PATCH /appointments/:id/complete`
- Decorador de validação `@IsFutureDate`.
- Camada de domínio para repositórios:
  - `IPatientsRepository`
  - `IAppointmentsRepository`
- Implementações Prisma para repositórios de pacientes e agendamentos.
- Estratégia JWT com Passport e guard de autenticação.
- Decorador `@CurrentUser` para extração do usuário autenticado.
- Serviço de integração n8n para evento assíncrono de conclusão de agendamento.
- Configuração de Swagger com Bearer JWT.
- `ValidationPipe` global com `whitelist`, `transform` e `forbidNonWhitelisted`.

### Alterado
- `schema.prisma` atualizado com a entidade `appointments` e relacionamentos com:
  - `organizations`
  - `branches`
  - `patients`
  - `users`
- `PatientsService` e `PatientsModule` refatorados para uso de Repository Pattern.
- Scripts do `backend/package.json` atualizados para Prisma com schema explícito:
  - `prisma:generate`
  - `prisma:migrate`
  - `prisma:deploy`
- `README.md` raiz atualizado para refletir estado real do projeto.
- `backend/README.md` e `frontend/README.md` padronizados com estrutura de atualização.

### Qualidade
- `npm run lint` (backend): passou em 2026-02-22.
- `npm run build` (backend): passou em 2026-02-22.
- `npm test -- --runInBand` (backend): passou em 2026-02-22.

### Observações Operacionais
- Subida de container Docker bloqueada no ambiente atual por permissão no socket Docker.
- Sem PostgreSQL ativo em `localhost:5432`, `prisma:migrate` e `start:dev` falham com erro `P1001`.
