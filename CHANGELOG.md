# Changelog

Todas as mudanças relevantes do projeto serão documentadas neste arquivo.

Formato baseado em Keep a Changelog e versionamento semântico.

## [Unreleased]

### Planejado
- Interceptores globais (`LoggingInterceptor`, `TransformInterceptor`).
- `GlobalExceptionFilter` com mapeamento de erros Prisma/validação.
- Testes E2E dos fluxos de autenticação e usuários.

### Adicionado
- Padronização operacional de entregas em `docs/OPERACAO_ENTREGAS.md`.
- Script de automação para commit/push de entrega grande:
  - `scripts/push_grande_entrega.sh`
- Módulo `auth` com endpoint `POST /auth/login` para emissão de JWT.
- Módulo `users` com endpoint `GET /users/me`.
- RBAC com `Role`, `@Roles` e `RolesGuard`.
- Repositório de usuários (`IUserRepository`) com implementação Prisma.
- Compatibilidade de login com hash bcrypt e fallback legado em texto plano.

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
