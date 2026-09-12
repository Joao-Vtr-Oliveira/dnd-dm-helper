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

`CreatureSheet` contains reusable stat-block data: name, AC, maximum HP, features, abilities, spell capacity, spell references, and optional opaque 5eTools source data. It never carries current HP, conditions, death saves, cooldown state, or spent resources.

`Encounter` is preparation. It owns title, description, tags, participant instances, lair actions, traps, and notes. Each participant has a stable UUID, optional `sourceSheetId`, and a sheet snapshot so later sheet edits do not change preparation already made.

`BattleEncounter` is runtime. It is created by `BattleEncounterService.createBattleFromEncounter`, receives new combatant IDs, initializes HP/resources/cooldowns, and persists turn state, conditions, pending actions, snapshots, history, and DM notes independently.

## Backup And Migration

Campaign backups use schema `2`; their encounters use `schemaVersion: 1` and type `dnd-dm-helper-encounter`. Runtime accepts V2 only.

`scripts/migrate-data-model-v2.mjs` converts an archived V1 campaign backup into a new file without overwriting the input. It reports every removed runtime or external field. The tracked V2 backup is `rpg_files/dnd-dm-helper-backup-v2.json`; the original V1 source remains only as an archival migration input.
