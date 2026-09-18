# Contextual Filters V1 - Tasks

## Status

Planejamento aprovado. Este documento divide a V1 em entregas sequenciais.

> [!important] Contrato semântico vigente
> Leia `dnd/AI-Knowledge/Contextual Content Contract.md` antes de executar ou revisar
> qualquer task. O contrato permanente e o handoff técnico substituem as decisões
> antigas deste arquivo sobre fallback de tags, escopo `generic`, elegibilidade de
> organizações locais e composição da Guarda. Esta lista continua sendo o roadmap
> técnico, mas não é a autoridade semântica. O draft técnico deve permanecer alinhado
> ao contrato, sem alterar dados canônicos.

## Andamento

- [x] Task 0: contrato e baseline confirmados.
- [x] Task 1: Organizations CRUD concluído em 2026-09-17.
- [x] Task 2: Organization Presence CRUD concluído em 2026-09-17.
- [x] Task 3: metadata contextual de CreatureSheets revisada conforme o contrato vigente.
- [x] Task 4: filtros de CreatureSheets revisados sem fallback contextual de tags/groups.
- [x] Revisão pós-Task 4: compatibilidade contextual, registry formal por fonte e navegação do World corrigidos conforme o contrato vigente.
- [x] Task 5: metadata contextual de Encounters concluída conforme o contrato vigente.
- [x] Task 6: filtros editoriais/contextuais de Encounters concluídos.
- [x] Task 7: Context Resolver derivado concluído.
- [x] Task 8: sugestões contextuais de criaturas no Encounter Builder concluídas.
- [x] Task 9: consolidação de backup, workspace e regressões concluída.

## Regras antigas superseded

O bloco anterior de “Correções pós-Task 4” foi substituído. Em particular:

- tags e `groups` continuam disponíveis para busca textual, mas não participam de
  filtros geográficos, organizacionais ou de disponibilidade;
- `generic` é uma flag explícita de arquétipo reutilizável, não uma relação de
  localização;
- filtros organizacionais usam `organizationId` formal;
- Organizations formais vêm de `dnd/Guildas & Grupos/`; o tipo não restringe a
  elegibilidade, então cultos e famílias formais permanecem válidos;
- comunidades locais e infraestrutura encontradas apenas em `Mundo/.../Guildas.md`
  permanecem fora do registry mesmo quando têm nome, POI, escopo ou presença;
- as regras exatas de hierarquia e exibição estão no contrato movido.

## Estado atual encontrado

- `CampaignWorld.organizations` e o registry formal derivado de `dnd/Guildas & Grupos/`:
  possui ID, nome, aliases, tipo descritivo, organizacao-pai e `presence[]`. A fonte
  formal preserva guildas, grupos, cultos e familias; material encontrado apenas em
  notas locais fica fora dele.
- `CampaignWorldService` preserva presencas e oferece lookup formal por escopo; a
  navegacao territorial nao exibe uma lista de Organizations.
- `CampaignContextService` ja persiste e resolve `currentLocation` para
  `empire | state | settlement`. POI e deliberadamente excluido.
- `WorldPage` lista, cria, edita, arquiva e restaura organizacoes. Tambem permite
  cadastrar, editar e remover presencas globais, imperiais, estaduais e locais.
- O tipo de organizacao e uma string descritiva. `guild`, `group`, `cult` e `family`
  sao exemplos validos; o tipo nao decide elegibilidade.
- `SavedSheetInterface` ja e o envelope editorial de uma `CreatureSheet`: ID,
  categoria, tags e source vivem nele. `CreatureSheet.data` e o stat block
  reutilizavel.
- Fichas usam `archived?`, `generic?`, `classes?` (somente NPC/PC), `locationRefs?` e `organizationRefs?` no envelope
  `SavedSheetInterface`; encounters usam `archived?`, `locationRefs?` e `organizationRefs?` no root da entidade de preparação.
- Homebrew Sheets filtra texto, categoria, tag, source, lifecycle, tipo de criatura,
  classe por tag canonica, localizacao e organizacao formal. Encounter Hub ja filtra
  texto e estado de batalha, mas esse estado nao e o ciclo de vida editorial.
- `Encounter` contem snapshots de participantes; `BattleEncounter` e runtime. A
  metadata contextual nao deve entrar nos snapshots.
- Backup V2 preserva fichas e encounters nas secoes formais existentes, mas
  `CampaignWorld` e um artefato separado, exportado/importado junto do backup pelo
  fluxo de Workspace.
- Nao existe Context Resolver de conteudo nem painel "Disponivel aqui".

## Decisoes arquiteturais

- Evoluir o registry existente em `campaignWorld.organizations`; nao criar catalogo
  paralelo de guildas.
- Organizacoes usarao `archived?: boolean`; ausencia do campo significa ativa e
  preserva mundos existentes.
- Presencas permanecem em `CampaignOrganization.presence`, com escopos `global`,
  `empire`, `state` e `settlement`. POI fica fora da V1.
- A origem formal em `dnd/Guildas & Grupos/` decide elegibilidade do registry; o tipo
  permanece descritivo e livre para valores revisados. Tipos de presenca continuam
  livres para preservar o dado narrativo, mas nao sao exibidos automaticamente no World.
- Criar tipos compartilhados para `ContentLocationRelation` e
  `ContentOrganizationRelation`.
- As relacoes de uma ficha ficarao no envelope `SavedSheetInterface`, nao em
  `CreatureSheet.data`. Isso protege a cadeia
  `CreatureSheet -> Encounter -> BattleEncounter`.
- As relacoes de encounter ficam no root de `Encounter`, que ja e a entidade de
  preparacao editorial.
- `archived` sera opcional. Registros antigos sem esse campo serao tratados como
  ativos.
- `tags` e `groups` legados continuam somente para busca e filtros textuais/tags. Eles
  nunca participam dos filtros contextuais e nunca criam uma relacao persistida.
- Classes de personagem usam o catalogo imutavel de 13 classes 5e, incluindo
  Artificer. `classes[]` e metadata formal somente para NPCs e PCs com classe
  estabelecida; monstros normalmente omitem o campo. Tags antigas de classe continuam
  pesquisaveis, mas nao sao metadata formal nem fallback do filtro de classe.
- Tipos oficiais de criatura usam o catalogo imutavel de 14 tipos 5e. Tipos customizados
  permanecem validos e pesquisaveis por texto, mas nao ganham uma faceta canonica.
- Conteudo sem referencia formal nao e global. Uma ficha `generic: true` e um
  arquetipo reutilizavel sem localizacao fisica e nao entra automaticamente em um
  filtro territorial.
- Relacoes com IDs inexistentes devem ser preservadas, avisadas no editor e
  ignoradas pelo resolver, nunca apagadas automaticamente.
- O filtro geografico da biblioteca inclui o escopo selecionado e seus descendentes,
  nunca uma relacao ancestral mais ampla. Isso nao afirma que o conteudo esteja
  "disponivel aqui".
- O resolver e mais estrito: relacao com outro settlement do mesmo estado nao entra
  como "Aqui".
- A Guarda de Mornk e uma instituicao publica e nao e Organization neste registry;
  qualquer composicao futura exige um modelo separado e aprovado.
- Backup V2 nao ganha uma copia de `CampaignWorld`: metadata de fichas e encounters
  continua nas colecoes formais existentes, enquanto organizacoes e presencas ficam
  no arquivo World complementar ja usado por Workspaces.

## Sequencia de tasks

### Task 0: Confirmar contrato e baseline

- Objetivo: registrar as decisoes deste documento antes da primeira alteracao.
- Arquivos/areas provavelmente afetados: documentacao, modelos e servicos citados
  no handoff.
- Models envolvidos: `CampaignWorld`, `CampaignContextState`,
  `SavedSheetInterface`, `Encounter` e `BattleEncounter`.
- Comportamento esperado: nenhuma mudanca funcional; POI permanece fora de
  `currentLocation`; Missions permanece fora da V1.
- Compatibilidade necessaria: preservar Backup V2, Workspaces e snapshots.
- Testes obrigatorios: confirmar baseline com `npm run build` e a suite completa
  antes de iniciar a V1.
- Dependencias de tasks anteriores: nenhuma.
- Criterio de conclusao: plano aprovado e ownership da metadata confirmado.

### Task 1: Completar o CRUD existente de Organizations

Status: concluida.

- Objetivo: evoluir o registry existente no Campaign World para listar, criar,
  editar e arquivar organizacoes.
- Arquivos/areas provavelmente afetados: `campaign-world-model.ts`,
  `campaign-world-service.ts`, `pages/world/` e specs correspondentes.
- Models envolvidos: `CampaignOrganization`, `CampaignOrganizationType` e
  `CampaignWorld`.
- Comportamento esperado: criacao sem presenca global implicita; edicao preserva
  ID; aliases, tipo e pai sao editaveis; arquivamento nao apaga referencias nem
  arquiva filhas automaticamente.
- Compatibilidade necessaria: Organizations formais existentes continuam validas;
  tipos descritivos como `cult` e `family` nao sao rejeitados; entidades locais
  encontradas apenas em notas estaduais nao sao criadas no registry; nenhuma
  organizacao de Mornk e codificada.
- Testes obrigatorios: criar, editar, aliases, ID estavel, pai opcional,
  arquivamento, tipos `guild`, `group`, `cult` e `family`, rejeicao apenas de
  registros sem tipo ou identidade formal, fixture Winterhold sem duplicacao e
  isolamento entre dois workspaces.
- Dependencias de tasks anteriores: Task 0.
- Criterio de conclusao: World permite manter organizacoes ativas e arquivadas sem
  JSON manual, com persistencia por workspace.

### Task 2: Completar o CRUD existente de Organization Presence

Status: concluida.

- Objetivo: permitir gerenciar presencas de cada organizacao.
- Arquivos/areas provavelmente afetados: `campaign-world-model.ts`,
  `campaign-world-service.ts`, `pages/world/` e specs de World/Campaign World.
- Models envolvidos: `CampaignOrganizationPresence`, `CampaignOrganization` e
  `CampaignWorldScopeType`.
- Comportamento esperado: criar, editar e remover presencas `global`, `empire`,
  `state` e `settlement`; `presenceType` aceita presets simples e valor customizado.
- Compatibilidade necessaria: presencas atuais permanecem validas; POI nao se torna
  escopo de presenca nem localizacao atual; presenca nao cria relacoes em fichas.
- Testes obrigatorios: presenca global, imperial, estadual e de settlement;
  resolução direta por escopo exato sem agregação de descendentes; remoção;
  organização arquivada; posto local sem criar outra organização.
- Dependencias de tasks anteriores: Task 1.
- Criterio de conclusao: uma organizacao unica pode possuir varias presencas
  explicitas e editaveis, sem inferencia sobre seus membros.

### Task 3: Adicionar metadata contextual a CreatureSheets

Status: concluida.

- Objetivo: adicionar lifecycle e relacoes formais opcionais ao catalogo de fichas.
- Arquivos/areas provavelmente afetados: novo model contextual compartilhado,
  `local-storage-service.ts`, Homebrew Builder, import/export individual,
  normalizadores e specs.
- Models envolvidos: `SavedSheetInterface`, `CreatureSheet`,
  `ContentLocationRelation` e `ContentOrganizationRelation`.
- Comportamento esperado: ficha pode ser arquivada, ter varias localizacoes e
  varias organizacoes; formulario usa IDs do Campaign World; relacoes quebradas sao
  preservadas e avisadas; tags/groups continuam somente para busca.
- Compatibilidade necessaria: ficha antiga sem metadata abre como ativa;
  `CreatureSheet.data` continua mecanico; importacao e duplicacao preservam
  metadata nova; nenhum campo contextual e copiado ao stat block do participante.
- Testes obrigatorios: ficha antiga com tags/groups; multiplas localizacoes;
  organizacao formal sem inferencia por tag; relacao quebrada preservada;
  duplicacao; import/export individual; ficha generica sem criar Organization para
  instituicao publica; nenhuma composicao estadual automatica.
- Dependencias de tasks anteriores: Tasks 1 e 2.
- Criterio de conclusao: metadata contextual e persistida no envelope da ficha e
  editavel sem alterar o stat block.

### Task 4: Evoluir filtros de CreatureSheets

Status: concluida.

- Objetivo: completar os filtros existentes com status, localizacao e organizacao.
- Arquivos/areas provavelmente afetados: `pages/homebrew-sheets/`, possivel servico
  puro de filtros e specs da pagina.
- Models envolvidos: `SavedSheetInterface`, relacoes contextuais e `CampaignWorld`.
- Comportamento esperado: texto, categoria, tags, source legado,
  `Ativos | Arquivados | Todos`, imperio, estado, settlement e organizacao; filtro
  organizacional usa somente `organizationId` formal e o filtro de classe usa
  `classes[]` formal quando presente.
- Compatibilidade necessaria: filtros atuais continuam funcionando; tags/groups nao
  viram filiacao persistida; ausencia de relacao nao equivale a global.
- Testes obrigatorios: filtro de cada faceta; composicao de facetas; padrao ativo;
  tags/groups no texto; organizacao por ID; localizacao hierarquica de catalogo;
  referencia quebrada sem crash.
- Dependencias de tasks anteriores: Task 3.
- Criterio de conclusao: a biblioteca encontra fichas por metadata formal sem
  alterar o comportamento mecanico existente.

### Task 5: Adicionar metadata contextual a Encounters

Status: concluída.

- Objetivo: adicionar lifecycle e relacoes opcionais ao encounter de preparacao.
- Arquivos/areas provavelmente afetados: `encounter-model.ts`,
  `local-storage-service.ts`, Encounter Builder e specs.
- Models envolvidos: `Encounter`, `ContentLocationRelation`,
  `ContentOrganizationRelation` e `BattleEncounter`.
- Comportamento esperado: encounter pode ser arquivado, ter localizacoes,
  organizacoes e tags; duplicacao preserva metadata.
- Compatibilidade necessaria: encounters antigos continuam validos; metadata nao
  entra em participantes, `BattleEncounter`, combatentes ou snapshots.
- Testes obrigatorios: encounter antigo; criar/editar/duplicar; multiplas
  localizacoes; relacoes organizacionais; arquivamento; iniciar batalha e confirmar
  que metadata nao aparece no runtime.
- Dependencias de tasks anteriores: Task 3.
- Criterio de conclusao: encounter preserva metadata contextual propria sem acoplar
  preparacao ao runtime.

### Task 6: Evoluir filtros de Encounters

- Objetivo: adicionar filtros editoriais/contextuais ao Encounter Hub sem misturar
  com status de batalha.
- Arquivos/areas provavelmente afetados: `encounter-hub-filter-service.ts`,
  `pages/encounter-hub/`, backup de preferencias e specs.
- Models envolvidos: `EncounterHubFilters`, `Encounter`, relacoes contextuais e
  `BattleEncounter`.
- Comportamento esperado: texto, tags, lifecycle, imperio, estado, settlement e
  organizacao; o filtro editorial `Ativos | Arquivados | Todos` e separado de
  `prepared | active | paused | completed`.
- Compatibilidade necessaria: ordenacao e filtros runtime persistidos continuam
  validos; uma batalha ativa continua acessivel mesmo se o encounter for arquivado.
- Testes obrigatorios: combinacao de status editorial e runtime; localizacao;
  organizacao; tags; encounters sem metadata; persistencia compativel dos filtros.
- Dependencias de tasks anteriores: Tasks 2 e 5.
- Criterio de conclusao: Encounter Hub filtra preparacao contextual sem
  reinterpretar o estado de `BattleEncounter`.

### Task 7: Criar Context Resolver derivado

Status: concluída.

- Objetivo: resolver conteudo formal contra a localizacao atual sem inferencias
  narrativas.
- Arquivos/areas provavelmente afetados: novo servico de resolver,
  `CampaignContextService`, `CampaignWorldService`, modelos contextuais e specs.
- Models envolvidos: `CampaignLocationRef`, `ResolvedCampaignLocation`,
  `RelevantCampaignOrganization`, fichas e encounters salvos.
- Comportamento esperado: settlement exato entra em "Aqui"; estado entra em
  "Estado/regiao"; imperio entra em "Regional/amplo"; organizacao presente entra
  em "Organizacoes"; outro settlement nao entra como "Aqui".
- Compatibilidade necessaria: POI continua fora; arquivado fica fora por padrao;
  organizacao presente nao torna membros fisicamente presentes; conteudo sem
  relacao formal nao aparece.
- Testes obrigatorios: relacao direta, estadual herdada, imperial ampla, outro
  settlement, organizacao global/local, membro ligado sem presenca individual,
  relacao quebrada, conteudo arquivado e fixture de Guarda com composicao estadual.
- Dependencias de tasks anteriores: Tasks 2, 3 e 5.
- Criterio de conclusao: servico puro e testavel retorna grupos explicaveis para
  fichas, encounters e organizacoes, sem Missions.

### Task 8: Sugerir criaturas contextuais no Encounter Builder

Status: concluída conforme escopo corrigido.

- Objetivo: sugerir criaturas relevantes no fluxo de montagem de encounters.
- Arquivos/areas afetados: `pages/encounter-builder/`, resolver contextual e specs.
- Models envolvidos: resultado do Context Resolver, `CampaignContextState` e
  `SavedSheetInterface`.
- Comportamento esperado: o modal Homebrew mostra sugestões agrupadas em
  "Aqui", "Estado/região" e "Regional/amplo"; somente categorias `monster` e
  `npc` entram nas sugestões; PCs e `other` permanecem na busca geral.
- Compatibilidade necessária: Organizations não aparecem nessa UI; tags, grupos,
  presenças e texto não criam sugestões; a busca geral continua disponível.
- Testes obrigatórios: posição ausente; hierarquia geográfica; filtro de categoria;
  arquétipo genérico; ficha fora da região; ações Usar/Adicionar.
- Dependencias de tasks anteriores: Tasks 4, 6 e 7.
- Criterio de conclusao: o DM consulta conteudo contextual da posicao atual com
  grupos simples e sem semantica enganosa.

### Task 9: Consolidar backup, migracao, workspace e regressoes

Status: concluída.

- Objetivo: validar persistencia integral e compatibilidade apos todas as mudancas.
- Arquivos/areas provavelmente afetados: `app-backup-service.ts`, validadores V2,
  `workspace-*`, import/export, scripts de validacao e specs de armazenamento/backup.
- Models envolvidos: `AppBackup`, `CampaignWorld`, `SavedSheetInterface`,
  `Encounter`, `BattleEncounter` e `CampaignContextState`.
- Comportamento esperado: Backup V2 restaura metadata de fichas/encontros nas
  colecoes existentes; World continua exportado/importado como artefato
  complementar; first-run e workspace vazio permanecem limpos.
- Compatibilidade necessaria: backup V2 rastreado continua valido; backups antigos
  sem metadata continuam restauraveis; nao duplicar Campaign World em
  `rawLocalStorage`; snapshots de encounter/battle permanecem independentes.
- Testes obrigatorios: backup/restauracao de metadata; par Backup + World; backup
  antigo; first-run; isolamento entre workspaces; import/export individual; sync
  remoto; referencias quebradas preservadas; cadeia
  `CreatureSheet -> Encounter -> BattleEncounter` sem alteracao retroativa.
- Dependencias de tasks anteriores: Tasks 1 a 8.
- Criterio de conclusao: `npm run validate:backup-v2`, `npm run build` e
  `npm test -- --watch=false --browsers=ChromeHeadless` passam.

## Dependencias

```text
0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9
                 \-------> 5
2 + 3 + 5 ----------------> 7
4 + 6 + 7 ----------------> 8
```

## Checklist geral da V1

- [x] Registry unico em `campaignWorld.organizations`.
- [x] CRUD e arquivamento de organizacoes.
- [x] CRUD de presencas sem presenca automatica de membros.
- [x] Metadata opcional e compativel em fichas.
- [x] Metadata opcional e compativel em encounters.
- [x] Filtros formais de ficha.
- [x] Filtros formais de encounter.
- [x] Catalogos imutaveis de classe e tipo de criatura 5e, sem catalogo customizado de funcao.
- [x] Resolver restrito a imperio, estado e settlement.
- [x] Sugestoes contextuais de monstros e NPCs no Encounter Builder.
- [x] Backup V2, World, Workspaces, import/export e snapshots cobertos por regressoes.
- [ ] Nenhuma Mission, importacao Obsidian, POI contextual, confidence/provenance
  engine ou organizacao hardcoded.
