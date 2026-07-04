# DndDmHelper

Ferramenta para mesa de D&D com foco em uso local durante a sessão.

## O que já existe

- Encontros salvos e editáveis
- Encounter Hub com batalhas locais
- Battle Tracker com persistência local
- Fichas homebrew salvas
- Calendário / world clock
- Backup completo em JSON do projeto
- Sincronização global por JSON remoto

## Fluxo de dados

- O app salva os dados no `localStorage`
- O fluxo principal de backup fica na sidebar:
  - `Sincronizar`
  - `Exportar tudo`
- Import/export específicos continuam apenas como ações legadas ou por item

## Backup completo

`Exportar tudo` gera um JSON com:

- encounters
- battle encounters
- fichas homebrew
- calendário
- configurações úteis de UI
- chaves do projeto no `localStorage`

## Sincronização

`Sincronizar`:

1. baixa o backup remoto configurado
2. valida o JSON
3. mostra um resumo
4. cria um backup local de segurança
5. restaura os dados do projeto

## Próximos passos

- Melhorar sons e playlists
- Expandir integrações de bestiário e magias
