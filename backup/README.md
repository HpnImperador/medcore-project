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

## Restore (recuperação)
Script controlado:
```bash
cd /home/sppro/medcore-project
BACKUP_FILE=/home/sppro/medcore-project/backup/medcore_db_YYYYMMDD_HHMMSS.sql.gz CONFIRM_RESTORE=yes ./scripts/restore_db_medcore.sh
```

Observação:
- O restore recria o schema `public` e substitui os dados atuais.
