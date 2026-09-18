# Prompt de Retomada - Correção Antes da Task 5

Você vai continuar o trabalho no repositório `dnd-dm-helper`, mas a prioridade não é implementar a próxima task. A última IA deixou falhas na implementação de contexto. Primeiro audite e corrija essas falhas. Só avance para a Task 5 depois que as Tasks 3 e 4 estiverem conformes ao contrato abaixo e os testes comprovarem isso.

## Ordem obrigatória

1. Leia completamente estes arquivos:

   - `docs/contextual-content-contract-draft.md`
   - `docs/contextual-filters-v1-tasks.md`
   - `docs/contextual-filters-help-request.md`
   - `docs/dnd-helper-contextual-filters-handoff.md`

2. Trate `docs/contextual-content-contract-draft.md` como a autoridade semântica. O arquivo `contextual-filters-v1-tasks.md` é apenas o roadmap técnico e contém histórico de decisões substituídas.
3. Antes de editar, execute `git status`, examine `git diff` e revise os commits recentes relacionados ao contexto. Não faça `reset`, `checkout`, `clean`, revert ou destruição de alterações existentes.
4. Localize no código todos os caminhos envolvidos em Tasks 1–4: modelos, filtros, resolveres, World, formulários, storage, import/export, Backup V2, workspace e testes.
5. Produza primeiro um diagnóstico curto com:

   - o que realmente está implementado;
   - quais partes das Tasks 3 e 4 estão incorretas;
   - quais testes existentes estão desatualizados;
   - quais arquivos serão alterados;
   - a ordem mínima de correção.

Não avance para implementação de Encounters enquanto houver falha nas regras desta especificação.

## Falhas que precisam ser corrigidas primeiro

### 1. Tags e groups

Remova qualquer uso de `sheet.tags`, `sheet.data.tags` ou `sheet.data.groups` para resolver silenciosamente:

- localização;
- organização;
- presença;
- disponibilidade contextual.

Esses campos continuam existindo apenas para busca textual, filtro explícito de tags e compatibilidade visual. Uma tag `Feng` não pode criar nem simular `locationRef`. Uma tag com nome de organização não pode criar nem simular `organizationRef`.

Não implemente fallback “seguro”, “exato”, “não persistido” ou “somente em memória”. O contrato novo proíbe esse comportamento.

### 2. Localização formal

As relações persistidas de ficha usam somente IDs formais do `Campaign World`:

```ts
type ContentLocationRelation = {
  scopeType: 'empire' | 'state' | 'settlement';
  scopeId: string;
  relation: 'base' | 'habitat' | 'occurrence' | 'operation';
};
```

Não use `regional` ou `generic` como valores de `relation`.

`generic` deve ser uma flag explícita da ficha:

```ts
generic?: boolean;
```

`generic: true` significa arquétipo reutilizável sem local físico. Não significa global e não deve aparecer automaticamente em qualquer território.

Regras de filtro:

- filtro por império inclui a referência ao próprio império e seus descendentes;
- filtro por estado inclui a referência ao próprio estado e seus settlements descendentes;
- filtro por settlement aceita apenas referência direta ao settlement;
- uma referência ao império não corresponde automaticamente a um estado;
- uma referência ao estado não torna a ficha diretamente presente em todos os settlements;
- uma ficha ligada a Feng não pode aparecer ao filtrar Drek;
- uma ficha ligada apenas a Mornk não pode aparecer ao filtrar Feng.

### 2.1. Classes e tags

`classes?: string[]` é metadata mecânica formal somente para NPCs e PCs quando a classe estiver estabelecida. Um monstro normalmente não possui classe e deve omitir esse campo. Não invente classe a partir de creature type, profissão, organização, estatísticas ou estilo de combate.

Tags não substituem `classes`. Tags novas servem apenas para busca de características ou uso prático, como `boss`, `elite`, `spellcaster`, `stealth`, `support`, `ambush` e `social`. Tags antigas de classe continuam preservadas e pesquisáveis, mas não devem alimentar o filtro formal de classe.

### 3. Organizações

`CampaignWorld.organizations` continua sendo o único registry de organizações.

 Uma Organization formal vem de uma nota no nível superior `dnd/Guildas & Grupos/` e
 pertence ao único registry `CampaignWorld.organizations`. `organizationType` é
 descritivo e pode ser `guild`, `group`, `cult`, `family` ou outro valor de campanha
 revisado. Red Vortex, Daniels e Genya devem permanecer elegíveis por serem entradas
 formais dessa fonte.

 Comunidades locais, conselhos, mesas de trabalhadores, companhias locais, serviços,
 POIs e infraestrutura encontrados apenas em `Mundo/.../Guildas.md` não são
 Organizations formais. Permanecem como contexto local ou POI, mesmo que tenham nome,
 escopo ou presença. O escopo de criação deve ser explícito: Organization formal para
 alcance de campanha/regional; contexto local ou POI para algo restrito à vila.

Não transforme em Organization:

- loja;
- taverna;
- prédio;
- filial física;
- dojo ou academia como edifício;
- distrito;
- mercado;
- evento temporário.

Esses elementos são POIs ou infraestrutura. Podem apontar para uma Organization.

Não promova um registro local ao registry apenas porque ele tem nome, escopo ou presença. O Conselho do Corte de Nagawoods e a rede equestre de Hotead permanecem material de mundo, não Organizations formais. Não remova uma Organization formal apenas porque seu tipo é `cult` ou `family`.

Filtros de organização usam somente:

```ts
organizationRefs[].organizationId
```

### 4. Presence

Presence descreve onde a organização possui atividade documentada. Não coloca automaticamente seus membros, NPCs ou fichas no local.

Uma presença global não deve gerar card em toda página territorial. Uma presença `remote-contact` representa acesso, não presença física. Uma operação temporária não deve ser criada a partir de material planejado.

O root pode listar o registry formal de Organizations. Páginas territoriais não exibem Organizations nem presenças automaticamente.

Não invente presenças por associação profissional, nome de tag, POI, menção narrativa ou existência de membros.

### 5. Guarda de Mornk

Não duplique a ficha `Patrulheiro de Contato C` para Plomos, Feng, Dortx ou qualquer outro estado.

O modelo correto é:

```text
Patrulheiro de Contato C
  -> organizationRef: Guarda de Mornk / institution

Guarda de Mornk + composição estadual
  -> externalId dos arquétipos utilizáveis naquele estado
```

A ficha reutilizável não recebe `state` ou `locationRef` apenas por pertencer à Guarda. A composição local vem das notas/registro institucional estadual e deve ser uma relação explícita separada.

Não hardcode Mornk ou a Guarda no código.

### 6. Casos obrigatórios

Implemente testes de regressão com fixtures explícitas. Não dependa do Backup V2 atual para inventar relações que ele ainda não possui.

Talha Trusk:

```yaml
externalId: npc-talha-trusk
locationRefs:
  - scopeType: state
    scopeId: feng
    relation: base
  - scopeType: settlement
    scopeId: feng-city
    relation: operation
organizationRefs: []
tags: [Mornk, Feng, Feudal]
```

Resultados obrigatórios:

- filtro Feng encontra Talha;
- filtro Drek não encontra Talha;
- remover as tags não altera o resultado contextual;
- a tag `Feng` sozinha não cria resultado contextual.

ODL:

- ODL é uma Organization de escopo `campaign`;
- `global-network` não gera presença física em Feng ou Plomos;
- Khaer Morn, Nagazav e Yotus só aparecem conforme presenças explícitas registradas;
- Feng e Plomos não recebem ODL sem metadata formal adicional;
- relação organizacional de um NPC não prova presença física no território.

Outros casos:

- referência `empire/mornk` encontra Mornk, mas não Feng ou Drek;
- referência direta a Hotead encontra Hotead e o filtro agregado de Feng, mas não outro settlement de Feng;
- criatura com habitat estadual em Nagazav não aparece diretamente em todos os settlements de Nagazav;
- Snowbound Hunter usa uma ficha para Dortx e Treuz, sem duplicação;
- Organization formal aparece somente onde há presença explícita; contexto local não
  vira Organization por possuir uma entrada em `Guildas.md`;
- POI associado a Winterhold não cria uma segunda Organization;
- ficha genérica sem localização não aparece como `Aqui`.

## Persistência e compatibilidade

- Metadata contextual deve continuar no envelope da ficha salva, fora de `CreatureSheet.data`.
- Backup V2 deve persistir `classes` quando presentes em NPCs/PCs, além de `locationRefs`, `organizationRefs`, `generic` e `archived`. Monstros sem classe devem omitir `classes`.
- Backups antigos sem esses campos continuam válidos.
- Ausência de metadata não significa localização global.
- IDs formais quebrados devem ser preservados e avisados, não apagados.
- Não migre automaticamente fichas existentes por tags, groups, pastas ou texto.
- Não altere `campaign-world.json`, o Backup V2 real ou o Bestiário durante esta correção.
- Não altere snapshots de `Encounter` ou `BattleEncounter` ao editar a ficha-base.

## Critério de conclusão desta retomada

Antes de iniciar Task 5, todos estes pontos devem estar verdadeiros:

- Tasks 3 e 4 foram reavaliadas contra o contrato novo;
- nenhum resolver contextual usa tags/groups como fallback;
- `generic` não é relation geográfica;
- filtro organizacional usa ID formal;
- Organizations formais não são descartadas por `organizationType`; cultos e famílias
  formais permanecem válidos, enquanto material local não é promovido automaticamente;
- presença não injeta membros ou fichas;
- Talha passa no caso Feng/Drek;
- Guarda usa uma ficha reutilizável com composição separada;
- import/export e Backup V2 preservam a metadata;
- testes antigos incompatíveis foram corrigidos;
- novos testes de regressão passam;
- NPC/PC com classe usa `classes[]` formal; monstro sem classe omite o campo e tag de classe não satisfaz o filtro formal;
- `npm run build` passa;
- `npm run validate:backup-v2` passa;
- a suite de testes configurada pelo projeto passa.

Somente após cumprir tudo isso, atualize `docs/contextual-filters-v1-tasks.md` e informe se a revisão pós-Task 4 está concluída. Se algum ponto falhar, pare na correção e reporte o bloqueio técnico; não avance para Task 5.
