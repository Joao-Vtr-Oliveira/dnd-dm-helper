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

## Começo rápido

No primeiro acesso, o app abre uma tela de início limpa. Escolha `Criar campanha`, informe um nome e comece imediatamente com um mundo, calendário, fichas e encontros vazios. Bestiário e Magias continuam disponíveis como compêndios globais.

Cada campanha é um workspace local deste navegador. O último workspace usado abre automaticamente; use `Workspaces` para criar, trocar, renomear ou remover campanhas.

## Fluxo de dados

- O app salva os dados no `localStorage`, isolados por workspace
- O arquivo canonico de homebrew 5eTools do projeto e `rpg_files/homebrew.json`
- Os arquivos `rpg_files/Notion_updated.json` e `rpg_files/Notion_updated_Nagawoods_FULL.json` ficam apenas como legado por enquanto
- O backup remoto canônico é `rpg_files/dnd-dm-helper-backup-v2.json` (campaign backup schema `2`)
- O fluxo principal de backup fica em `Workspaces`:
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

## Campaign World

O Mundo da campanha é um arquivo separado, `campaign-world.json`. Ele contém geografia, organizações, POIs, definição do calendário e datas comemorativas. O Backup V2 mantém o estado operacional, incluindo a data/hora atual e a posição da party.

Use a página `Mundo` para criar Impérios, Estados, Localidades, POIs e Organizações. Use `Calendário` para criar eventos e ajustar a configuração básica. `sourcePath` é metadata opcional, preservada ao importar mundos existentes, e não é necessária para uma campanha comum.

Em `Workspaces`, exporte separadamente:

- `dnd-dm-helper-backup-v2.json`
- `campaign-world.json`

As importações são validadas antes de substituir os dados ativos e guardam uma cópia local de segurança.

## Sincronização

`Sincronizar`:

1. baixa o backup remoto configurado
2. valida o JSON
3. mostra um resumo
4. cria um backup local de segurança
5. restaura os dados do projeto

Para um workspace remoto, a sincronização baixa e valida o Backup e o Mundo antes de aplicar qualquer um deles. Ela é somente leitura: as mudanças continuam locais e devem ser exportadas para serem publicadas no host escolhido.

## Workspace remoto

URLs públicas são opcionais. Para usar o mesmo workspace em outro dispositivo:

1. Exporte Backup e Mundo.
2. Hospede os dois arquivos em qualquer URL HTTP(S) pública compatível.
3. Em `Workspaces`, informe e valide as duas URLs.
4. Exporte o `workspace.json` gerado.
5. No outro dispositivo, escolha `Conectar workspace` e cole a URL do `workspace.json`.

O manifesto contém apenas o nome da campanha e as URLs de Backup e Mundo. Não há login, conta, GitHub obrigatório ou upload automático.

## Compatibilidade e preservação de dados

O app é local-first e deve preservar campanhas já existentes. Ao evoluir o projeto:

- Backups e Campaign Worlds são validados antes de qualquer restauração.
- Importações e sincronizações criam cópias locais de segurança antes de substituir dados do workspace ativo.
- Migrações de storage precisam ser idempotentes e só são marcadas como concluídas depois que os dados foram associados com segurança.
- Alterações de schema devem manter leitura compatível ou incluir uma migração explícita; dados antigos não podem ser descartados silenciosamente.
- Workspaces mantêm seus dados separados. Um import, sync ou remoção nunca deve afetar outra campanha.
- Recursos novos devem preservar o fluxo existente de Backup, Encounter Builder, Battle Tracker, fichas, calendário e compêndios.

## Próximos passos

- Melhorar sons e playlists
- Expandir integrações de bestiário e magias
