---
type: implementation_handoff
status: draft
canon_scope: draft
temporary: true
ai_generated: true
subject: Contract for contextual sheets, organizations, and locations
created: 2026-09-17
source: Obsidian audit and approved semantic decisions
---

# Contextual Content Contract - Decision Draft

> [!warning] Draft for technical handoff
> This document decides narrative semantics for the `dnd-dm-helper`. It does not alter the Helper, Backup V2, `campaign-world.json`, imported sheets, or campaign canon. The permanent creation rules are in the vault note `dnd/AI-Knowledge/Contextual Content Contract.md`.

> [!important] How to use this file
> Send this entire file to the implementation AI before it edits the repository. The
> section `# Prompt para correção do dnd-dm-helper` is the operational instruction;
> the preceding sections explain the decisions and acceptance cases that the prompt
> must preserve.

## 1. Problema

The prior implementation combined formal `locationRefs` and `organizationRefs` with tags, `groups`, organization presences, and hierarchy fallbacks. That made the same visible result mean different things. A tag could become a temporary location, a global organization could become a local card, and an institutional archetype could be mistaken for a local resident.

The broken Helper task documents confirm the concrete sources of confusion:

- `docs/contextual-filters-v1-tasks.md` authorizes tags and `groups` as contextual filter compatibility; this must stop.
- The same task document models `generic` as a geographic relation, which falsely turns reusability into placement.
- It has no explicit, persistable composition relation for a reusable institutional sheet such as the Guarda; that proposed public-institution relation is outside the Organization registry.
- Its organization export treated every local collective from `Guildas.md` as a registry entry, although many of those records are communities, workers' tables, councils, or POIs rather than campaign organizations.

The contract is intentionally smaller: explicit IDs, four location relations, five organization relations, and no inference engine.

## 2. Regra definitiva de localização

Every persisted sheet location is explicit and uses an ID from `campaign-world.json`:

```yaml
locationRefs:
  - scopeType: empire | state | settlement
    scopeId: stable-world-id
    relation: base | habitat | occurrence | operation
```

`base` is a normal home, duty station, or territorial attachment. `habitat` is a natural environment. `occurrence` records a documented appearance or possibility without claiming permanent habitat. `operation` records a confirmed area of action without residence.

A sheet can have one, several, or no locations. A no-location sheet is only valid as a deliberate `generic: true` archetype or a draft waiting for review. A character's current whereabouts are runtime, not durable sheet metadata.

### Geographic Questions Closed

| Question | Decision |
| --- | --- |
| Can a sheet belong to an empire, state, settlement, or several? | Yes. Each must be a separate formal relation with its actual scope and meaning. |
| What is regional? | A relationship at `state` scope. It does not mean every settlement. |
| What is local? | A relationship at `settlement` scope. |
| What is generic? | Reusable without a physical location. It is explicit and not global. |
| State creature in Feng? | It appears in a Feng state filter and in `Estado/regiao` while the party is in Feng. It is not `Aqui` in every Feng settlement. |
| Sheet linked only to Mornk? | It appears under Mornk, not when filtering Feng, Drek, or another state. |
| Sheet linked to Hotead? | It appears under Hotead and in Feng's aggregate state filter. It does not appear under another Feng settlement. |

### Filter Rule

- Empire includes its own direct references and references in child states and settlements.
- State includes its own direct references and references in child settlements.
- Settlement includes only direct settlement references.
- A parent reference never flows downward. `empire/mornk` does not match `state/feng`; `state/feng` does not make a sheet direct to Hotead.

This is a library filter, not a claim of availability in the party's exact position.

## 3. Regra definitiva de organizações

`CampaignWorld.organizations` stores formal campaign Organizations sourced from the top-level `dnd/Guildas & Grupos/` notes and global index. Registry eligibility comes from that formal source and review, not from `organizationType`.

`organizationType` is descriptive and accepts reviewed campaign values such as `guild`, `group`, `cult`, and `family`. Red Vortex remains a valid formal Organization as a cult; Daniels and Genya remain valid formal Organizations as families.

An entry found only in `Mundo/.../Guildas.md` is local distribution, presence, service, community, or infrastructure. It does not enter the formal registry merely because it has a name, `scope`, POI, or presence. Local councils, workers' tables, local businesses, shops, taverns, branch buildings, academies, dojos, temples, districts, markets, and temporary events remain local world material or POIs unless they are separately established in the top-level formal registry source.

Examples:

- Winterhold is one campaign organization.
- Instituto Winterhold de Plomos is a POI and a Winterhold post.
- Conselho do Corte de Nagawoods is local world context and a POI-linked community, not a registry organization.
- Rede equestre de Hotead is not an organization: the notes explicitly leave its formal association undecided.
- Guarda de Mornk is a public institution and remains outside this registry.

Organization `scope` remains `campaign`, `regional`, or `local`; it describes intended reach or management, never physical presence and never registry eligibility by itself. Creation should make the distinction visible: formal campaign/regional Organizations come from `Guildas & Grupos/`; village-only context belongs in local notes or POIs.

## 4. Regra de presença

A presence declares where the organization itself has a documented form of activity. It does not declare that every member, linked sheet, or related NPC is physically there.

```yaml
presence:
  - scopeType: global | empire | state | settlement
    scopeId: stable-world-id # omitted only for global
    presenceType: global-network | headquarters | post | agent | remote-contact | operation
```

- `global-network`: world-wide reach, root catalog only.
- `headquarters`: confirmed headquarters.
- `post`: branch, office, dojo, academy, workshop, or other established installation; link its POI where known.
- `agent`: local representative without implying a public building.
- `remote-contact`: access to the organization from the territory, not physical local presence.
- `operation`: bounded active operation; archive it when it ends. Planned material never creates it.

Legacy free-form presence labels are preserved for compatibility but must not be silently reclassified from lore.

## 5. Regra de filtros

### Sheets

- Location filters use only formal `locationRefs` and the geographic rule above.
- Organization filters use only formal `organizationRefs` by `organizationId`.
- `classes` is formal mechanical metadata only for NPCs and PCs whose class is established. Monsters normally omit it.
- Tags remain independent text/tag filters.
- `active` means `archived` is absent or false. `archived` means true. Do not derive lifecycle from tag `draft`, prose, canon status, mechanical status, or player knowledge.

### Organizations

- Root catalog shows the organization registry, including campaign-wide organizations.
- A territory view shows an organization only when it has an explicit presence whose `scopeType` and `scopeId` exactly match the selected territory.
- Descendant presences are not included in the territory's main organization list. If they become useful later, show them in a separate section grouped by their actual state or settlement.
- A `global-network` alone never produces a territorial card.
- The registry contains formal Organizations sourced from `dnd/Guildas & Grupos/`. A local community or infrastructure record is not eligible merely because it has a name, a POI, or a presence; formal cults and families remain eligible.

## 6. Regra de "Disponível aqui"

This is a resolver presentation, not a fallback mechanism:

| Section | Includes | Excludes |
| --- | --- | --- |
| Aqui | direct `settlement` sheet relations and direct physical/agent organization presences | state/empire relations; remote contacts; unrelated members |
| Estado/regiao | direct state sheet relations and state presences inherited by the current settlement | other settlements; claims of direct local presence |
| Organizacoes presentes | explicit organization presence records at the selected scope, labelled by form | descendant presences; all sheets merely related to that organization |
| Contexto amplo | empire-level context and explicit generic archetypes | a claim that the content is physically available |

Generic archetypes may be shown as `Contexto amplo` only when clearly labelled and never promoted to `Aqui`. Public-institution archetypes such as the Guarda do not enter the Organization registry or a local organization list.

## 7. Migração

No migration derives a formal relation from tags, groups, folder names, titles, or prose search at runtime.

| Category | Rule | Real example |
| --- | --- | --- |
| Safe after deterministic source review | Existing formal relation, or canonical structured frontmatter/exact heading link resolves to one Campaign World ID and one relation. Persist only after review. | Serpente de Dunas de Nagazav -> `state/nagazav`, `habitat`; Snowbound Hunter -> `state/dortx` and `state/treuz`, `habitat`. |
| Requires human review | A canonical note establishes a relationship but there are several possible scopes, sources conflict, or the sheet needs a judgment on relation type. | Talha: state attachment and Feng city activity are supported, but the reviewed migration must reconcile the canonical sheet with the stale Backup tag/source mismatch. |
| Do not migrate automatically | Only tag/group/folder/prose evidence, a rumor, a planned note, a generic archetype, or an organizational mention/absence. | `Feng` tag alone; ODL mentioned in a plot; Hotead's undefined breeder network; any Red Vortex preparation. |

Migration UI may show suggestions. It must require a user choice and persist only the selected formal relationship. Runtime behavior sees only saved formal metadata.

## 8. Casos reais

### Talha Trusk

Evidence:

- [[Mundo/Impérios/Mornk/7-Feng/NPCs/Talha Trusk/Talha Trusk|Talha Trusk]] declares `empire: Mornk`, `state: Feng`, makes her senhora feudal of Feng, and places her small stall at the Feirinha de Feng.
- [[Mundo/Impérios/Mornk/7-Feng/NPCs/Talha Trusk/Talha Trusk - Ficha Homebrew|Talha Trusk - Ficha Homebrew]] uses `external_id: npc-talha-trusk` and tags/groups `Mornk`, `Feng`, and `Feudal`.
- The notes do not establish membership in Guarda, PDB, ODL, or another organization. Endevor trained her as an individual; this is not an organization relation.

Reviewed target:

```yaml
generic: false
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

Expected result: Feng finds Talha. Drek does not. Hotead does not treat her as directly local, though Feng state context can surface her separately.

### Olhos de Luna (ODL)

ODL is a campaign-wide clandestine intelligence guild: [[Guildas & Grupos/Olhos De Luna (ODL)|Olhos de Luna]]. It is not physically present everywhere merely because its scope is campaign.

Confirmed Mornk presence:

- Khaer Morn: clandestine contact at [[Mundo/Impérios/Mornk/10-Khaer Morn/Pontos de Interesse/Arquivo da Lua Oculta|Arquivo da Lua Oculta]], not a public headquarters.
- Nagazav: secret agent Neerk Lyn.
- Yotus: individual agent Greta Mirrar.

Explicit absence:

- Feng has no identified ODL cell, agent, or headquarters.
- Plomos has no public headquarters or named ODL agent.

The current World record incorrectly calls the Khaer Morn presence `headquarters` when the canonical note supports only a clandestine contact. That is a future reviewed data correction, not a runtime reinterpretation by the Helper.

Formal ODL-linked CreatureSheets in the current Backup V2: none. Named ODL NPC notes are evidence candidates for future reviewed migration, not current formal sheet relations.

Expected display: root catalog; Khaer Morn, Nagazav, and Yotus only where an exact presence record exists. Never promote a presence from a child or parent territory into the selected territory.

### Guarda de Mornk (fora do registry de Organizations)

[[Bestiário/Guarda de Mornk/Patrulheiro de Contato C|Patrulheiro de Contato C]] is one reusable NPC archetype. It must not be copied into state-specific sheets. Each canonical `Guarda.md` establishes the state response composition.

The prior proposal to create `guarda-de-mornk` as an organization is obsolete. Guarda de Mornk is a public institution and remains world context, not a `CampaignOrganization`.

The reusable sheet may remain a generic sheet without a formal Organization relation until a separate approved model exists:

```yaml
externalId: mornk-guard-contact-patrol
generic: true
locationRefs: []
organizationRefs: []
```

State composition is outside this Organization cleanup. Do not create a public-institution Organization, geographic sheet relation, or automatic membership from the Guard notes in this task.

### Other Validation Cases

| Kind | Canonical example | Required interpretation |
| --- | --- | --- |
| Global guild | PDB | Global identity; only explicit posts/dojo presences create territorial display. |
| Regional organization | SDA | Regional scope does not imply a branch in every state; Plomos headquarters and documented remote contacts stay distinct. |
| Local community | Conselho do Corte de Nagawoods | Local world context with an associated POI, not a registry organization. |
| NPC | Oto Veio-Claro | Explicit state/POI narrative metadata can support reviewed `base`/`operation`, not membership in Liga dos Pesadores without its own organization record. |
| Regional creature | Serpente de Dunas de Nagazav | State habitat, not direct presence in every settlement. |
| Multi-region creature | Snowbound Hunter | One sheet with two state habitats, no duplication. |
| POI linked to organization | Instituto Winterhold de Plomos | POI plus Winterhold `post`, not a second organization. |

## 9. Schema recomendado

The contextual metadata stays on the saved sheet envelope, outside mechanical `CreatureSheet.data`:

```yaml
externalId: npc-example
category: npc
classes: [ranger] # only for an NPC/PC with an established class; omit for monsters
archived: false
generic: false
locationRefs:
  - scopeType: state
    scopeId: feng
    relation: base
organizationRefs:
  - organizationId: example-organization
    relation: member
tags:
  - investigator
```

For a reusable institutional archetype:

```yaml
externalId: institution-example
category: npc
archived: false
generic: true
locationRefs: []
organizationRefs:
  - organizationId: institution-id
    relation: institution
tags:
  - guard
```

Any future institutional composition is outside this Organization cleanup and requires a separate approved model.

```yaml
scopeType: state
scopeId: feng
presenceType: post
availableSheetExternalIds:
  - reviewed-external-id
```

This field is retained only as a future-model example; it is not used for the current Organization registry or World navigation.

## 10. Regras para novas fichas

Before generating the native JSON, answer in the Markdown note:

1. What is the narrative and operational category?
2. If this is an NPC or PC, is its mechanical class established? If it is a monster, omit `classes`.
3. Is it a placed entity or a deliberate generic archetype?
4. Which exact `campaign-world.json` IDs support each actual place?
5. Which of `base`, `habitat`, `occurrence`, or `operation` describes each place?
6. Which organization IDs have a confirmed relationship, and which of the five relations applies?
7. Is any claimed organization merely a POI, profession, influence, tag, rumor, or planned hook instead?
8. Is the sheet active or archived operationally?
9. Which tags remain useful only for search?

Use exact IDs and explicit entries in the native sheet envelope. Do not use a tag, `groups`, a folder name, an organization presence, or a parent territory as a substitute.

## 11. Lacunas restantes

  - The current data must be reviewed against the formal-source rule before any future JSON migration. Do not assume that every family or cult is excluded: formal entries such as Red Vortex, Daniels, and Genya must remain eligible. Local communities and infrastructure found only in state `Guildas.md` remain Markdown context or POIs.
- The current `campaign-world.json` has no `guarda-de-mornk` organization or composition records. The narrative decision is closed; adding a public institution would require a future semantic decision outside this registry.
- Existing ODL Khaer Morn data says `headquarters`, but canonical prose says clandestine contact. Correct the data only in a reviewed migration.
- Existing Backup V2 has no formal contextual metadata for its current sheets. The Helper must support and preserve the new fields without inventing them.
- A distinct POI current-location model is outside this correction. Settlement remains the deepest location scope.

# Prompt para correção do dnd-dm-helper

You are correcting the contextual-content implementation in `dnd-dm-helper`. Treat this prompt as the approved semantic contract. Do not decide campaign meaning yourself and do not read tags, names, prose, or organization presence as hidden location/affiliation data. Canonical source provenance is allowed only for deciding whether a record belongs to the formal Organization registry; it never creates a sheet relation by itself.

## Scope

Correct the existing contextual sheet and organization behavior. Do not import the vault, migrate data blindly, alter combat mechanics, place POIs in `currentLocation`, add Mission context, or build an inference/confidence engine.

Read these existing documents first:

- `docs/contextual-filters-v1-tasks.md`
- `docs/contextual-filters-help-request.md`
- `docs/dnd-helper-contextual-filters-handoff.md`
- the current models, filter functions, storage/backup/import code, and tests they name.

The task list is partially implemented but its post-Task-4 decisions are superseded where they conflict with this prompt.

## Remove Or Stop Using

1. Remove legacy tag/group derivation from all contextual location, organization, and availability filters. `sheet.tags`, `sheet.data.tags`, and `sheet.data.groups` remain only text/tag search facets.
2. Remove `regional` and `generic` as `ContentLocationRelation.relation` values. Keep only `base`, `habitat`, `occurrence`, and `operation`.
3. Accept formal Organizations from the top-level `dnd/Guildas & Grupos/` source. `organizationType` is descriptive and must not exclude formal cults or families. A local `Mundo/.../Guildas.md` record does not become an Organization merely because it has a name, scope, POI, or presence.
4. Do not use a global organization scope or `global-network` presence to create territorial organization cards.
5. Do not use an organization presence to infer physical presence of every linked member or sheet.

## Keep And Implement

1. Keep `CampaignWorld.organizations` as the sole organization registry. It contains formal Organizations sourced from `dnd/Guildas & Grupos/`; do not create a parallel guild catalog or promote local state notes automatically.
2. Keep formal contextual metadata on the `SavedSheetInterface` envelope, never inside `CreatureSheet.data`.
3. Keep optional `classes`, `locationRefs`, `organizationRefs`, tags, and `archived`; add explicit `generic?: boolean` to the saved sheet envelope. `classes` applies only to NPCs/PCs with an established class; monsters normally omit it.
4. Preserve sheets, imports, exports, backups, and references that omit new fields. Omission means active but unreviewed context, never global location.
5. Preserve unresolved formal IDs and warn in UI; do not delete them automatically.
6. Keep POI outside `currentLocation` and content location refs for this task.
7. Keep organization presence separately in Campaign World and preserve its current free-form legacy labels. Offer the canonical new choices `global-network`, `headquarters`, `post`, `agent`, `remote-contact`, and `operation` for future edits.

## Formal Rules

```ts
type ContentLocationRelation = {
  scopeType: 'empire' | 'state' | 'settlement';
  scopeId: string;
  relation: 'base' | 'habitat' | 'occurrence' | 'operation';
};

type ContentOrganizationRelation = {
  organizationId: string;
  relation: 'member' | 'leader' | 'institution' | 'trained_by' | 'affiliated';
};
```

The saved-sheet envelope may also contain `classes?: string[]` for established NPC/PC classes. Do not put class in `CreatureSheet.data` or use a new class tag for new sheets. Legacy class tags remain searchable only.

`generic: true` means a deliberately reusable archetype with no physical location. It is not global and does not appear in a location filter or `Aqui` merely because it is generic.

Location filter semantics are asymmetric and deterministic:

- Empire includes direct references to itself and descendants.
- State includes direct references to itself and child settlements.
- Settlement includes only direct references to itself.
- Parent references never match a narrower filter.

Organization filters use only `organizationRefs.organizationId`. Tags and `groups` must not qualify content.

## Presence And Territorial UI

- An Organization is a formal collective sourced from `dnd/Guildas & Grupos/`. Its type may be guild, group, cult, family, or another reviewed value. Scope describes reach, but scope alone does not qualify a local community or infrastructure record.
- A shop, branch building, dojo, academy, tavern, or district is a POI, not an Organization.
- Local communities, councils, workers' tables, local businesses, public bodies, and informal professional networks found only in local notes stay outside the Organization registry. Formal families and cults from `dnd/Guildas & Grupos/`, including Daniels, Genya, and Red Vortex, remain in the registry.
- Presence says where the Organization has a documented form of activity. It never moves its members or sheets.
- Root displays the formal Organization registry. World territory pages do not display an organization or presence list.
- Presence records remain available in the data for future explicit features, but navigation never renders them automatically.
- `global-network` is root-only. `remote-contact` is access, not physical presence.

For `Disponivel aqui`, return separate explainable sections:

1. `Aqui`: direct settlement sheet relations and direct local organization presences.
2. `Estado/regiao`: direct state relations/presences inherited by a settlement.
3. `Organizacoes presentes`: presence records only; do not inject all linked members.
4. `Contexto amplo`: empire relations and clearly labelled generic archetypes; not physical availability.

## Guarda Composition

Model the reusable archetype separately from territorial composition:

```text
Patrulheiro de Contato C -> generic reusable sheet
Any future institutional composition -> separate approved model, not a CampaignOrganization
```

Do not add a generic composition field to Organization presences as part of this cleanup. Do not add geographic refs to generic Guard sheets and do not duplicate the stat block per state.

## Legacy Data And Migration

- Do not infer or persist sheet relationships from legacy tags/groups, folder names, titles, or prose at runtime. The formal source folder is registry provenance only; it does not create `organizationRefs`.
- Provide an explicit review/migration flow later if useful: it may show tag-based suggestions but requires a user selection before saving formal metadata.
- Backup V2 must persist new formal sheet metadata. Existing sheets without it remain valid and unlocated.
- Do not invent metadata for the current Backup V2. A reviewed backup migration will arrive separately.

## Regression Tests

Add and run tests for all of these:

1. Talha Trusk with explicit `state/feng` base and `settlement/feng-city` operation: Feng filter finds it; Drek filter does not; the tag `Feng` alone has no effect.
2. An `empire/mornk` sheet appears for Mornk but not Feng or Drek.
3. A Hotead settlement sheet appears for Hotead and the aggregate Feng state filter, but not another Feng settlement.
4. A Feng state habitat appears in Feng and in `Estado/regiao` from Hotead, not as direct `Aqui` for every Feng settlement.
5. ODL/global-network does not produce territorial presence in Feng or Plomos. Explicit agent/contact presence does appear only at its documented scope.
6. An organization presence does not make an organization-linked NPC physically local.
7. The registry and dropdowns contain only formal Organizations from `dnd/Guildas & Grupos/`; `organizationType` does not restrict them to `guild` or `group`, while local communities and infrastructure from state `Guildas.md` are not selectable Organizations.
8. Tags and `groups` remain searchable but cannot satisfy geographic, organization, or availability filtering.
9. `Patrulheiro de Contato C` remains outside the Organization registry until a separate approved institutional-composition model exists.
10. Archived filtering, import/export, Backup V2 restore, workspace isolation, broken IDs, and the `CreatureSheet -> Encounter -> BattleEncounter` runtime boundary continue to work.

Implement the correction, update the stale task documents to reflect the replacement rules, run the relevant unit tests, `npm run build`, and the Backup V2 validation. Report the changed files, test results, and any purely technical blocker. Do not ask the user to decide any semantic rule above.
