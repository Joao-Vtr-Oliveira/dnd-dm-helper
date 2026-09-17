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
- It has no explicit, persistable composition relation for a reusable institutional sheet such as the Guarda.
- Its territorial organization rules hide local organizations categorically and privilege only certain guild/group scopes, although the world contains valid local collectives such as Conselho do Corte de Nagawoods.

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

`CampaignWorld.organizations` stores a durable collective identity with purpose and agency: guild, faction, cult, family, institution, military/public body, or local group.

It does not store a shop, tavern, branch building, academy building, dojo building, district, street market, or temporary event. Those are POIs or infrastructure, even when they belong to an organization.

Examples:

- Winterhold is one campaign organization.
- Instituto Winterhold de Plomos is a POI and a Winterhold post.
- Conselho do Corte de Nagawoods is a local organization because it is a durable collective with customary authority and functions.
- Rede equestre de Hotead is not yet an organization: the notes explicitly leave its formal association undecided.
- Guarda de Mornk is a regional public institution and belongs in the registry once reviewed data is migrated.

Organization `scope` remains `campaign`, `regional`, or `local`; it describes reach, never physical presence.

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
- Tags remain independent text/tag filters.
- `active` means `archived` is absent or false. `archived` means true. Do not derive lifecycle from tag `draft`, prose, canon status, mechanical status, or player knowledge.

### Organizations

- Root catalog shows the organization registry, including campaign-wide organizations.
- A territory view shows an organization only when it has an explicit presence in that territory or a descendant, labelled with its actual scope and form.
- A settlement does not turn an inherited state presence into `Aqui`; show it as broader context when useful.
- A `global-network` alone never produces a territorial card.
- Local Organizations are eligible where their explicit presence is relevant. Do not hide them simply because their scope is local.

## 6. Regra de "Disponível aqui"

This is a resolver presentation, not a fallback mechanism:

| Section | Includes | Excludes |
| --- | --- | --- |
| Aqui | direct `settlement` sheet relations and direct physical/agent organization presences | state/empire relations; remote contacts; unrelated members |
| Estado/regiao | direct state sheet relations and state presences inherited by the current settlement | other settlements; claims of direct local presence |
| Organizacoes presentes | explicit organization presence records, labelled by form | all sheets merely related to that organization |
| Contexto amplo | empire-level context and explicit generic archetypes | a claim that the content is physically available |

Generic archetypes may be shown as `Contexto amplo` only when clearly labelled and never promoted to `Aqui`. A guard archetype enters a local usable list only through the separate composition rule below.

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

Expected display: root catalog; Khaer Morn, Nagazav, and Yotus only where the direct/inherited presence rule applies. Never Feng, Plomos, Hotead, or Drek without future explicit evidence.

### Guarda de Mornk

[[Bestiário/Guarda de Mornk/Patrulheiro de Contato C|Patrulheiro de Contato C]] is one reusable NPC archetype. It must not be copied into state-specific sheets. Each canonical `Guarda.md` establishes the state response composition.

Reviewed target once `guarda-de-mornk` exists in the organization registry:

```yaml
externalId: mornk-guard-contact-patrol
generic: true
locationRefs: []
organizationRefs:
  - organizationId: guarda-de-mornk
    relation: institution
```

State composition is separate data on the Guard's state presence, ideally an optional list of `externalId`s. Feng explicitly includes Patrulheiros C, Escudeiros/Atiradores B, limited Guerreiro A, and external S support. The list makes local use explicit without claiming that all Guard members are in Feng.

### Other Validation Cases

| Kind | Canonical example | Required interpretation |
| --- | --- | --- |
| Global guild | PDB | Global identity; only explicit posts/dojo presences create territorial display. |
| Regional organization | SDA | Regional scope does not imply a branch in every state; Plomos headquarters and documented remote contacts stay distinct. |
| Local group | Conselho do Corte de Nagawoods | Local organization with an associated POI, not a campaign guild. |
| NPC | Oto Veio-Claro | Explicit state/POI narrative metadata can support reviewed `base`/`operation`, not membership in Liga dos Pesadores without its own organization record. |
| Regional creature | Serpente de Dunas de Nagazav | State habitat, not direct presence in every settlement. |
| Multi-region creature | Snowbound Hunter | One sheet with two state habitats, no duplication. |
| POI linked to organization | Instituto Winterhold de Plomos | POI plus Winterhold `post`, not a second organization. |

## 9. Schema recomendado

The contextual metadata stays on the saved sheet envelope, outside mechanical `CreatureSheet.data`:

```yaml
externalId: npc-example
category: npc
archived: false
generic: false
locationRefs:
  - scopeType: state
    scopeId: feng
    relation: base
organizationRefs:
  - organizationId: example-organization
    relation: member
  - Feng
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

Recommended optional addition to a presence, only when it has a true reviewed composition:

```yaml
scopeType: state
scopeId: feng
presenceType: post
availableSheetExternalIds:
  - mornk-guard-contact-patrol
```

This field means the archetype is available through that institutional composition. It does not make every member physically present, and it is not necessary for ordinary organization presences.

## 10. Regras para novas fichas

Before generating the native JSON, answer in the Markdown note:

1. What is the narrative and operational category?
2. Is it a placed entity or a deliberate generic archetype?
3. Which exact `campaign-world.json` IDs support each actual place?
4. Which of `base`, `habitat`, `occurrence`, or `operation` describes each place?
5. Which organization IDs have a confirmed relationship, and which of the five relations applies?
6. Is any claimed organization merely a POI, profession, influence, tag, rumor, or planned hook instead?
7. Is the sheet active or archived operationally?
8. Which tags remain useful only for search?

Use exact IDs and explicit entries in the native sheet envelope. Do not use a tag, `groups`, a folder name, an organization presence, or a parent territory as a substitute.

## 11. Lacunas restantes

- The current `campaign-world.json` has no `guarda-de-mornk` organization or composition records. The narrative decision is closed; adding reviewed structural data belongs to a later approved migration.
- Existing ODL Khaer Morn data says `headquarters`, but canonical prose says clandestine contact. Correct the data only in a reviewed migration.
- Existing Backup V2 has no formal contextual metadata for its current sheets. The Helper must support and preserve the new fields without inventing them.
- A distinct POI current-location model is outside this correction. Settlement remains the deepest location scope.

# Prompt para correção do dnd-dm-helper

You are correcting the contextual-content implementation in `dnd-dm-helper`. Treat this prompt as the approved semantic contract. Do not decide campaign meaning yourself and do not read tags, names, folders, prose, or organization presence as hidden location/affiliation data.

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
3. Do not hide a valid local Organization merely because its scope is `local`.
4. Do not use a global organization scope or `global-network` presence to create territorial organization cards.
5. Do not use an organization presence to infer physical presence of every linked member or sheet.

## Keep And Implement

1. Keep `CampaignWorld.organizations` as the sole organization registry. Do not create a parallel guild catalog.
2. Keep formal contextual metadata on the `SavedSheetInterface` envelope, never inside `CreatureSheet.data`.
3. Keep `locationRefs`, `organizationRefs`, tags, and `archived`; add optional explicit `generic?: boolean` to the saved sheet envelope.
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

`generic: true` means a deliberately reusable archetype with no physical location. It is not global and does not appear in a location filter or `Aqui` merely because it is generic.

Location filter semantics are asymmetric and deterministic:

- Empire includes direct references to itself and descendants.
- State includes direct references to itself and child settlements.
- Settlement includes only direct references to itself.
- Parent references never match a narrower filter.

Organization filters use only `organizationRefs.organizationId`. Tags and `groups` must not qualify content.

## Presence And Territorial UI

- An Organization is a stable collective identity at campaign, regional, or local scope.
- A shop, branch building, dojo, academy, tavern, or district is a POI, not an Organization.
- A local collective can be an Organization when it has durable identity and agency.
- Presence says where the Organization has a documented form of activity. It never moves its members or sheets.
- Root displays the registry. A territorial view displays an Organization only if it has an explicit presence in that territory or its descendants, labelled by actual scope/form.
- `global-network` is root-only. `remote-contact` is access, not physical presence.

For `Disponivel aqui`, return separate explainable sections:

1. `Aqui`: direct settlement sheet relations and direct local organization presences.
2. `Estado/regiao`: direct state relations/presences inherited by a settlement.
3. `Organizacoes presentes`: presence records only; do not inject all linked members.
4. `Contexto amplo`: empire relations and clearly labelled generic archetypes; not physical availability.

## Guarda Composition

Model the reusable archetype separately from territorial composition:

```text
Patrulheiro de Contato C -> organizationRefs -> Guarda de Mornk (institution)
Guarda de Mornk state presence -> availableSheetExternalIds -> archetype external IDs
```

If a generic composition field is added to organization presences, make it optional, preserve unresolved `externalId`s, and use it only for explicit reviewed institutional compositions. Do not add geographic refs to generic Guard sheets and do not duplicate the stat block per state. Do not hardcode Mornk or Guard behavior.

## Legacy Data And Migration

- Do not infer or persist relationships from legacy tags/groups at runtime.
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
7. A local Organization remains selectable/displayable only where its explicit presence is relevant.
8. Tags and `groups` remain searchable but cannot satisfy geographic, organization, or availability filtering.
9. `Patrulheiro de Contato C` as `generic: true` plus `institution` relation has no direct location; an explicit composition record is required to make it locally usable.
10. Archived filtering, import/export, Backup V2 restore, workspace isolation, broken IDs, and the `CreatureSheet -> Encounter -> BattleEncounter` runtime boundary continue to work.

Implement the correction, update the stale task documents to reflect the replacement rules, run the relevant unit tests, `npm run build`, and the Backup V2 validation. Report the changed files, test results, and any purely technical blocker. Do not ask the user to decide any semantic rule above.
