# Integração ProformaFarmERP -> MedCore

## Objetivo
Consolidar no MedCore os padrões técnicos maduros do ProformaFarmERP, preservando as decisões já estáveis do projeto (multi-tenant, RBAC, backup/restore, healthcheck) e acelerando o roadmap para um patamar enterprise.

## Fontes analisadas
- `docs/proformafarm-import/RESUMO_TECNICO_EVOLUCAO_PROFORMAFARMERP.md`
- `docs/proformafarm-import/README_PROFORMA_DOCS.md`
- `docs/proformafarm-import/EVOLUCAO_ESTRATEGICA_WORLD_CLASS_2.md`
- `docs/proformafarm-import/outbox-implementation-notes.md`
- `docs/proformafarm-import/ROADMAP_TECNICO_PROXIMOS_OBJETIVOS_ATUALIZADO.md`
- `docs/DIRETRIZES_ARQUITETURAIS_OBRIGATORIAS_v2.md`
- `docs/GUARDIAN_TECHNICAL_DEEP_DIVE.md`
- `docs/PROFORMAFARM_GUARDIAN_SPEC.md`
- `docs/Segurança, Resiliência e Governança de Dados.md`

## Diagnóstico de aderência
### Já existente no MedCore
- Multi-tenant por `organization_id` com controle por filial em `user_branches`.
- RBAC (`USER`, `ADMIN`, `DOCTOR`) e JWT com contexto organizacional.
- Camada de observabilidade (`/health`, `/health/db`, `/health/metrics`, alert-check e histórico).
- Rotina de backup, restore controlado e teste operacional de restore com base temporária.
- Repository Pattern e regras de negócio de agendamento com isolamento organizacional.

### Gap para atingir padrão Proforma/World-Class
- Ausência de Outbox transacional para eventos de domínio do MedCore.
- Ausência de pipeline assíncrono idempotente para integração externa (n8n e futuras integrações).
- Auditoria de segurança ainda não consolidada em um domínio Guardian dedicado.
- Falta de monitoramento unificado de compliance de segurança por organização.

## Matriz de decisão (Adotar / Adaptar / Não Adotar)
### Adotar
- Domain Events + Outbox Pattern com persistência na mesma transação do caso de uso.
- Worker assíncrono com lock, retry e backoff.
- Idempotência de processamento de eventos.
- Trilha de auditoria estruturada por domínio e `organization_id`.

### Adaptar
- Modelo Guardian (Proforma) para contexto clínico:
- priorizar eventos: acesso a prontuário, exportação de dados sensíveis, falhas de backup/restore.
- política de segurança alinhada a LGPD/HIPAA com escopo médico.
- monitoramento proativo por organização (sem misturar tenants).

### Não adotar (neste ciclo)
- Dependências específicas do stack EF Core/Dapper do Proforma (MedCore usa NestJS/Prisma).
- Domínios funcionais não clínicos (fiscal/SNGPC/estoque farmacêutico) sem necessidade no MedCore atual.

## Blueprint de implementação no MedCore
### 1) Outbox transacional
- Criar tabela `domain_outbox_events` com campos mínimos:
- `id`, `organization_id`, `aggregate_type`, `aggregate_id`, `event_name`, `payload`, `status`, `attempts`, `occurred_at`, `processed_at`, `last_error`, `correlation_id`.
- Persistir evento no mesmo fluxo transacional de casos críticos:
- `appointment.created`
- `appointment.completed`
- `appointment.canceled`
- `appointment.rescheduled`
- Substituir disparo direto de webhook n8n por publicação via Outbox + worker.

### 2) Processador assíncrono
- Criar `OutboxProcessorService` (worker periódico) com:
- lote configurável
- lock por evento
- retry com backoff exponencial
- marcação de sucesso/falha com idempotência
- Integrar com `N8nWebhookService` sem acoplamento ao controller/service de domínio.

### 3) Guardian clínico (v1)
- Novo módulo `guardian` com foco em segurança operacional:
- `guardian_security_events` (auditoria imutável)
- `guardian_risk_signals` (sinais agregados por organização)
- Eventos monitorados no v1:
- tentativas de login bloqueadas (brute force)
- execução de exportações de dados clínicos
- falhas de backup/restore
- acesso administrativo em endpoints sensíveis

### 4) Governança e políticas
- Definir contrato de mascaramento para dados sensíveis em logs.
- Consolidar correlação (`correlation_id`) entre request, outbox e webhook externo.
- Definir critérios de saúde operacional para liberação de rollout:
- backup diário válido
- restore semanal válido
- fila outbox sem backlog crítico

## Roadmap sugerido (60 dias)
### Fase 1 (dias 1-15)
- Schema + migration do Outbox.
- Publicação de eventos de agendamento em transação.
- Primeiros testes de integração do pipeline.

### Fase 2 (dias 16-30)
- Worker de processamento com retry/backoff e idempotência.
- Integração n8n migrada para consumo via Outbox.
- Métricas do processador (`pendentes`, `processados`, `falhas`).

### Fase 3 (dias 31-45)
- Módulo Guardian v1 (auditoria e sinais de risco).
- Endpoints internos de consulta operacional de segurança.

### Fase 4 (dias 46-60)
- Endurecimento: testes de resiliência e carga do pipeline de eventos.
- Checklist de readiness LGPD/HIPAA para auditoria.

## Critérios de aceite para avanço
- Nenhum evento crítico enviado fora de transação.
- Reprocessamento idempotente validado em teste de integração.
- Falha em integração externa não impacta consistência de domínio.
- Monitor de backup/restore em `ok` contínuo.

## Próximo incremento recomendado (imediato)
- Implementar `domain_outbox_events` + `OutboxProcessorService` para os eventos de `appointments`, mantendo webhook n8n desacoplado do fluxo síncrono da API.
