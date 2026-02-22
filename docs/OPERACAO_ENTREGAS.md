# Operação de Entregas Grandes

Este documento define o padrão operacional aplicado ao final de cada entrega grande no MedCore.

## Padrão automático adotado
1. Atualizar documentação relevante (`README.md`, `CHANGELOG.md` e README de módulo).
2. Validar backend com:
   - `npm run lint`
   - `npm run build`
   - `npm test -- --runInBand`
3. Publicar alterações com commit e push.

## Script padrão
Arquivo: `scripts/push_grande_entrega.sh`

Uso:
```bash
./scripts/push_grande_entrega.sh "escopo-da-entrega"
```

Exemplo:
```bash
./scripts/push_grande_entrega.sh "appointments + documentação"
```

## Formato de commit
O script usa automaticamente:
```text
chore(entrega): YYYY-MM-DD HH:MM | <escopo>
```

## Observações
- O script só cria commit se houver alterações no `git status`.
- Se não houver mudanças, ele encerra sem erro.
- `git push` depende de remote e credenciais já configuradas no servidor.
