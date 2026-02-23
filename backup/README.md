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
- Backup diário às 14:00 (horário do servidor).
- Teste de restore semanal no domingo às 14:30 (base temporária).
- Logs:
- `backup/backup_cron.log`
- `backup/restore_check_cron.log`
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

## Teste Operacional de Restore
Validação automática sem risco para a base principal (usa base temporária):
```bash
cd /home/sppro/medcore-project
./scripts/validar_restore_backup.sh
```
