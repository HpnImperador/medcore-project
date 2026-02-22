# MedCore Backend

API do projeto MedCore desenvolvida com NestJS + Prisma + PostgreSQL.

## 📒 Histórico de Mudanças
- Histórico consolidado do projeto: `../CHANGELOG.md`

## 🚀 Atualizações Recentes
- Implementação de módulo de agendamentos multi-tenant.
- Adoção de Repository Pattern (`domain/repositories` + implementações Prisma).
- Validação de data futura com `@IsFutureDate`.
- JWT com Passport e `@CurrentUser` para contexto autenticado.
- Swagger com autenticação Bearer JWT.
- Webhook assíncrono para n8n ao concluir agendamento.

## 🧱 Stack
- NestJS 11
- Prisma 6
- PostgreSQL
- Passport JWT
- Swagger

## 📦 Módulos Atuais
- `patients`
- `appointments`
- `prisma`
- `common` (auth, guards, decorators, strategy)
- `integrations` (n8n)

## 🔐 Segurança e Escopo
- Isolamento por `organization_id`.
- Escopo de filial por `branch_ids` no token.
- Regra de vínculo médico-filial via `user_branches`.

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
```

## 📘 Documentação
- Swagger: `http://localhost:3000/api`
- Swagger (rede local): `http://192.168.0.109:3000/api`

## 🧪 Checks de Qualidade
```bash
npm run lint
npm run build
npm test -- --runInBand
```

## 📝 Padrão de Atualização deste README
Sempre atualizar, a cada entrega:
1. `Atualizações Recentes`
2. `Módulos Atuais`
3. `Segurança e Escopo`
4. `Checks de Qualidade`
