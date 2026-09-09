# DndDmHelper

Ferramenta para mesa de D&D com foco em uso local durante a sessão.

## O que já existe

- Encontros salvos e editáveis
- Encounter Hub com batalhas locais
- Battle Tracker com persistência local e cockpit do turno atual
  - próximo turno, HP/HP temporário, dano, cura, condições e estado de derrotado
  - habilidades relevantes, espaços de magia resumidos, próximos três turnos e próximo evento ambiental
  - recargas `d6` manuais: o mestre rola o dado físico e registra o resultado; cada habilidade recebe uma tentativa no próximo turno do dono
- Fichas homebrew salvas
- Calendário / world clock
- Backup completo em JSON do projeto
- Sincronização global por JSON remoto

## Fluxo de dados

- O app salva os dados no `localStorage`
- O arquivo canonico de homebrew 5eTools do projeto e `rpg_files/homebrew.json`
- Os arquivos `rpg_files/Notion_updated.json` e `rpg_files/Notion_updated_Nagawoods_FULL.json` ficam apenas como legado por enquanto
- O fluxo principal de backup fica na sidebar:
  - `Sincronizar`
  - `Exportar tudo`
- Import/export específicos continuam apenas como ações legadas ou por item

## Homebrew canonico

- O carregamento padrao de homebrew 5eTools deve apontar para `rpg_files/homebrew.json`
- O app online consome a copia publicada desse mesmo arquivo no GitHub
- Esse mesmo arquivo tambem e o usado pelo MCP e para import manual no 5eTools

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
