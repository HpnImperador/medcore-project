# Backups MedCore

Diretório de backups do banco `medcore_db`.

## Formato
- Arquivo: `medcore_db_YYYYMMDD_HHMMSS.sql.gz`
- Origem: container `medcore-db` (PostgreSQL)

## Execução manual
```bash
cd /home/sppro/medcore-project
./scripts/backup_db_medcore.sh
```

## Agendamento (cron)
- Rotina diária às 02:00 (horário do servidor).
- Com retenção padrão de 15 dias.

## Observação
- Este diretório é versionado para manter estrutura/documentação.
- Os arquivos `.sql.gz` podem crescer; ajuste retenção conforme política do ambiente.
