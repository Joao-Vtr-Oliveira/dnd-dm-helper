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
- Bestiário local 5eTools, com busca, filtros e ficha oficial somente leitura
- Calendário / world clock
- Backup completo em JSON do projeto
- Sincronização global por JSON remoto

## Fluxo de dados

- O app salva os dados no `localStorage`
- O arquivo canonico de homebrew 5eTools do projeto e `rpg_files/homebrew.json`
- Os arquivos `rpg_files/Notion_updated.json` e `rpg_files/Notion_updated_Nagawoods_FULL.json` ficam apenas como legado por enquanto
- O backup remoto canônico é `rpg_files/dnd-dm-helper-backup-v2.json` (campaign backup schema `2`)
- O fluxo principal de backup fica na sidebar:
  - `Sincronizar`
  - `Exportar tudo`
- Encounters não possuem import/export individual: backup e sync são os fluxos de transferência de dados

## Modelo de dados

`CreatureSheet` é uma ficha reutilizável. Um `EncounterParticipant` mantém referência opcional à ficha, snapshot estável e configuração de preparação. Lair actions e traps são entidades próprias do encounter, não monsters. Ao iniciar, o app cria um `BattleEncounter` separado com HP atual, condições, recursos, eventos runtime e histórico.

Veja `docs/data-model.md` para o contrato e a política de migração.

## Bestiário local

Os arquivos raw ficam em `rpg_files/5etools-2014/bestiary/`. Eles são compilados sem alteração para `public/compendium/bestiary/`: o índice compacto carrega na abertura e cada source completo carrega sob demanda. Use `npm run generate:bestiary` após atualizar os arquivos raw e `npm run validate:bestiary` para validar os artefatos.

O compêndio é somente leitura. Ao adicionar uma criatura ao encounter, o app guarda a origem `name + source` e um snapshot normalizado dentro da ficha do participante. A ação de criar ficha gera uma cópia homebrew independente.

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
- estado atual e backups do homebrew 5eTools

`rawLocalStorage` não é fonte de verdade para dados formais. O Backup V2 é o contrato canônico estabilizado do projeto.

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
