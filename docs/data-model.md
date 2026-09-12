# Data Model

The helper owns its data model. It does not use an external Battle Tracker JSON format.

## Flow

```text
CreatureSheet
  -> optional reference plus snapshot
Encounter
  -> explicit conversion when a battle starts
BattleEncounter
```

`CreatureSheet` contains reusable stat-block data: name, `armorClass: number | null`, maximum HP, features, abilities, spell capacity, spell references, and optional opaque 5eTools source data. It never carries current HP, conditions, death saves, cooldown state, or spent resources.

## Official Bestiary

```text
5eTools raw bestiary
  -> generated local index and source bundles
  -> repository and normalizer
  -> CompendiumMonster (read-only)
  -> adapter
  -> CreatureSheet / EncounterParticipant snapshot
```

The raw corpus lives in `rpg_files/5etools-2014/bestiary/` and is never rewritten. `npm run generate:bestiary` creates the browser-served index and lazy source bundles under `public/compendium/bestiary/`. The compact index is loaded once; a full source bundle is loaded only after selecting a creature and then cached in memory. Fluff image paths are compiled into those bundles and resolve to the corresponding 5eTools image URL only when its creature detail is opened.

Official identity is `name + source`; equal names from different sources are separate records. An official import adds `officialOrigin` and an immutable normalized `officialSnapshot` to the participant sheet, never `sourceSheetId`. The encounter remains stable if the source corpus changes. The compendium itself is read-only; creating a homebrew sheet creates an independent editable copy without official provenance.

`EncounterParticipant` is a prepared instance. It owns a stable ID, optional `sourceSheetId`, `initiative: number | null`, category/side configuration, notes, and a sheet snapshot. Its category is the category used in this encounter: it starts from a referenced sheet but may intentionally differ. The snapshot has no runtime state, so later sheet edits do not change preparation already made.

`EncounterLairAction` is a prepared environmental event, never a monster or participant. `EncounterTrap` is a prepared trap with its own trigger, frequency, initiative when applicable, and cooldown configuration. `Encounter` is preparation only: title, description, tags, notes, participants, lair actions, and traps. It does not store HP, conditions, turn state, death saves, pending actions, or history.

`BattleCombatant` is runtime. It receives a new ID and initializes current HP, temporary HP, runtime abilities, spent slots, conditions, death saves, pending actions, and its numeric initiative. `BattleEncounter` owns combatants, runtime lair actions/traps, turn state, snapshots, history, and DM notes independently. `sourceEncounterId` is optional provenance, not a foreign key: a historical battle remains valid after its source encounter is deleted.

## Backup And Migration

Campaign backups use the stabilized schema `2`; their encounters use `schemaVersion: 1` and type `dnd-dm-helper-encounter`. Runtime accepts V2 only. Formal sections include encounters, battles, sheets, calendar, campaign context, settings, and 5eTools homebrew state/backups. `rawLocalStorage` is reserved for an explicit auxiliary-key allowlist and is empty in the canonical backup; it must never duplicate a formal section.

`scripts/migrate-data-model-v2.mjs` converts an archived V1 campaign backup into a new V2 file without overwriting the input. `scripts/sanitize-data-model-v2.mjs` performs the final one-shot sanitation of a pre-final V2 file, including AC/initiative normalization, lair-action recovery, sheet reconciliation, and raw storage deduplication. The tracked V2 backup is `rpg_files/dnd-dm-helper-backup-v2.json`; the original V1 source remains only as an archival migration input.
