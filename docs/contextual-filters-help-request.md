# Pedido de Ajuda: Contexto de Fichas e Organizações

> [!warning] Documento histórico
> Este arquivo registra o problema e o estado anterior. As decisões foram fechadas
> em `docs/contextual-content-contract-draft.md`; não use a seção “Decisões
> Necessárias” como perguntas abertas de produto.

> [!important] Resolução semântica vigente
> O registry formal de `CampaignWorld.organizations` deve ser abastecido pelas notas
> de `dnd/Guildas & Grupos/`, não por qualquer entrada local de
> `Mundo/.../Guildas.md`. `organizationType` é descritivo: cultos e famílias formais
> continuam válidos, incluindo Red Vortex, Daniels e Genya. Comunidades, serviços e
> infraestrutura encontrados apenas nas notas locais permanecem contexto local ou POI.
> Esta resolução atualiza as decisões históricas abaixo, mas não autoriza nenhuma
> migração ou alteração de JSON neste documento.

## Situação

O modelo atual de filtros contextuais e a apresentação de organizações no World não
estão atendendo ao uso da campanha. Este documento registra o formato de dados e o
comportamento implementado para servir de base a uma nova decisão de produto e
arquitetura.

Não implementar novas mudanças a partir deste documento sem uma proposta aprovada.

## Formato Atual de Fichas

Uma ficha salva usa `SavedSheetInterface` em
`src/app/services/local-storage-service/local-storage-service.ts`.

```ts
interface SavedSheetInterface {
  id: string;
  externalId?: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  data: CreatureSheet;
  category: 'monster' | 'npc' | 'pc' | 'other';
  tags: string[];
  source: string;
  archived?: boolean;
  locationRefs?: ContentLocationRelation[];
  organizationRefs?: ContentOrganizationRelation[];
}
```

Os campos contextuais formais ficam fora de `CreatureSheet.data`:

```ts
interface ContentLocationRelation {
  scopeType: 'empire' | 'state' | 'settlement';
  scopeId: string;
  relation: 'base' | 'occurrence' | 'habitat' | 'operation' | 'regional' | 'generic';
}

interface ContentOrganizationRelation {
  organizationId: string;
  relation: 'member' | 'leader' | 'affiliated' | 'institution' | 'trained_by' | 'associated';
}
```

Fichas antigas não possuem esses campos. O backup V2 rastreado contém fichas que usam
tags legadas, por exemplo:

```json
{
  "title": "He Xiao",
  "tags": ["Komic", "Rogue", "Assassin", "draft"]
}
```

Outro exemplo possui a tag `Feng`, mas não uma `locationRef` formal:

```json
{
  "title": "Talha Trusk",
  "tags": ["Mornk", "Feng", "feudal", "draft"]
}
```

## Formato Atual do Mundo

O World usa `CampaignWorld` em `src/app/models/campaign-world-model.ts`:

```ts
interface CampaignWorld {
  schemaVersion: 1;
  empires: CampaignEmpire[];
  states: CampaignState[];
  settlements: CampaignSettlement[];
  organizations: CampaignOrganization[];
  pointsOfInterest: CampaignPointOfInterest[];
  calendar: CampaignCalendar;
}
```

Geografia:

```ts
interface CampaignEmpire {
  id: string;
  name: string;
  aliases: string[];
}

interface CampaignState extends CampaignEmpire {
  empireId: string;
}

interface CampaignSettlement extends CampaignEmpire {
  stateId: string;
  settlementType: 'village' | 'city' | 'capital' | 'other';
}
```

Organizações possuem atualmente tipo, escopo editorial e presenças:

```ts
interface CampaignOrganization extends CampaignEmpire {
  organizationType: string;
  scope?: 'campaign' | 'regional' | 'local';
  parentOrganizationId?: string;
  presence: CampaignOrganizationPresence[];
  archived?: boolean;
}

interface CampaignOrganizationPresence {
  scopeType: 'global' | 'empire' | 'state' | 'settlement';
  scopeId?: string;
  presenceType: string;
}
```

O arquivo base é `rpg_files/campaign-world.json`. Ele contém organizações grandes,
regionais e locais na mesma coleção. Exemplos:

- `Winterhold`: guilda de escopo `campaign`.
- `Adaga Sob Luar`: grupo de escopo `regional`.
- `Comunidade dos Lotes de Nirvak`: grupo de escopo `local`, com presença em
  `nirvak-city`.

## Comportamento Implementado Hoje

### Filtros de fichas

`src/app/pages/homebrew-sheets/homebrew-sheet-filter.ts` aplica filtros de texto,
categoria, tag, source, status, tipo de criatura, classe, geografia e organização.

Para compatibilidade com fichas antigas, há um resolvedor de tags em
`src/app/models/content-context-model.ts`:

- Reúne `sheet.tags`, `sheet.data.tags` e `sheet.data.groups`.
- Compara cada tag normalizada por igualdade exata com nomes e aliases registrados no
  World.
- Uma tag com correspondência única a império, estado ou settlement gera uma relação
  geográfica derivada apenas em memória.
- Uma tag com correspondência única a guilda ou grupo não local gera uma relação
  organizacional derivada apenas em memória.
- Correspondências ambíguas são ignoradas.
- A derivação não modifica a ficha nem grava metadata formal.

Semântica geográfica atual do filtro:

- Filtrar por império inclui relações no próprio império, nos estados dele e nos seus
  settlements.
- Filtrar por estado inclui apenas relações no estado selecionado e nos settlements
  dele.
- Filtrar por settlement inclui apenas relações naquele settlement.
- Relações em império não entram ao filtrar um estado específico.

Apesar disso, foi relatado que Talha Trusk, com tag `Feng`, não aparece ao selecionar
Feng, enquanto aparecia incorretamente ao selecionar Drek em uma versão anterior. Esse
fluxo precisa ser revalidado contra os dados reais carregados no navegador antes de
qualquer novo desenho.

### Organizações no World

As regras abaixo registram o comportamento observado quando este pedido foi escrito;
elas são históricas e foram superseded pela resolução semântica no início do arquivo.

`src/app/pages/world/` tem as seguintes regras atuais:

- A raiz exibe somente organizações de escopo `campaign` e tipo `guild` ou `group`.
- O editor de organizações cria apenas `Guilda` ou `Grupo`.
- Em uma página territorial, a seção de organizações só é exibida quando existe guilda
  ou grupo não local com presença direta naquele território.
- Presenças globais, imperiais ou estaduais herdadas não devem gerar card em uma
  localidade.
- Grupos locais não devem aparecer nos seletores de organização nem nos cards da
  localidade.
- O gerenciamento de presenças abre em modal e restaura a localização anterior ao
  fechar.

## Problemas Relatados

1. O conceito de `organizations` mistura organizações grandes com entidades locais e
   regionais, mesmo com o campo de escopo adicionado.
2. A lista de organizações e os selects continuam difíceis de interpretar e não deixam
   claro qual conjunto deveria ser elegível para uma ficha.
3. A seção territorial de organizações não é considerada útil para a mesa: organizações
   nacionais não precisam ser repetidas em todas as localidades, e grupos locais não
   deveriam necessariamente existir como organização do mesmo catálogo.
4. O filtro geográfico não é confiável no uso real. O caso obrigatório a reproduzir é
   Talha Trusk: estado Feng deve encontrá-la; estado Drek não deve encontrá-la.
5. A coexistência de relações formais, tags legadas derivadas e presenças de organizações
   tornou a regra difícil de explicar.

## Decisões Necessárias

1. Qual entidade deve viver em `CampaignWorld.organizations`?

   - Apenas guildas e grupos globais/nacionais?
   - Guildas/grupos em qualquer escala?
   - Organizações locais devem virar POIs, notas locais ou outro modelo?
2. Qual é a fonte de verdade para o contexto de fichas antigas?

   - Tags legadas continuam sendo fonte de filtro?
   - Deve haver uma migração explícita para `locationRefs` e `organizationRefs`?
   - Deve existir uma tela de revisão para converter tags em relações formais?
3. Qual deve ser a semântica geográfica desejada?

   - Estado deve incluir conteúdo marcado apenas com o império-pai?
   - Settlement deve incluir conteúdo marcado no estado-pai?
   - Ou cada filtro deve ser estritamente exato, como uma busca de catálogo?
4. Como distinguir entidades locais de organizações?

   - Um conselho, comunidade, associação ou oficina local deve ser um POI?
   - Deve haver um tipo de entidade local separado de guildas/grupos?
5. Que papel as presenças devem ter na interface?

   - Apenas administração do World?
   - Filtro de fichas?
   - Painel operacional da mesa?
   - Nenhum destes por enquanto?

## Arquivos Relevantes

- `src/app/models/content-context-model.ts`
- `src/app/models/campaign-world-model.ts`
- `src/app/services/campaign-world-service/campaign-world-service.ts`
- `src/app/pages/homebrew-sheets/homebrew-sheet-filter.ts`
- `src/app/pages/homebrew-sheets/homebrew-sheets.ts`
- `src/app/pages/world/world.ts`
- `src/app/pages/world/world.html`
- `rpg_files/campaign-world.json`
- `rpg_files/dnd-dm-helper-backup-v2.json`
- `docs/contextual-filters-v1-tasks.md`
