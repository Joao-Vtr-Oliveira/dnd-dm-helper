# 5eTools Datasets

Os JSONs em `rpg_files/5etools-2014/` são RAW, read-only. A aplicação os consome por geradores, repositories e normalizers; componentes nunca devem ler esses arquivos diretamente.

| Dataset | Função atual | Uso futuro | Snapshots/backups |
| --- | --- | --- | --- |
| `bestiary/` | Bestiary local, normalizado em `CompendiumMonster` | nenhum framework genérico | ficha canônica; RAW só como proveniência |
| `skills.json` | sugestões do editor de CreatureSheet | nenhum cálculo automático de perícias | apenas skill selecionada e bônus |
| `languages.json` | sugestões de idiomas | enriquecimento de idioma | apenas texto escolhido |
| `senses.json` | sugestões de sentidos | nenhum engine de senses | apenas nome/detalhe escolhido |
| `conditionsdiseases.json` | sugestões de imunidade a condição | Conditions Compendium | apenas texto escolhido |
| `monsterfeatures.json` | não consumido | picker/CR tooling futuro | não |
| `bestiary/template.json` | não consumido | aplicação explícita de templates | não |
| `bestiary/fluff-index.json`, `fluff-bestiary-*.json` | imagem no Bestiary | lore/imagens sob demanda por `name + source` | nunca em runtime, Undo ou backups operacionais |
| `spells/` | Compêndio e Quick Spell View | fontes adicionais quando disponíveis | referências `name + source` |
| `feats.json`, `fluff-feats.json` | não consumido | compêndio/importação opcional como trait | não |
| `optionalfeatures.json` | não consumido | referência opcional para NPC/homebrew | não |
| `items.json`, `items-base.json`, `magicvariants.json`, `fluff-items.json` | não consumido | Compêndio de Itens | não |
| `loot.json`, `tables.json`, `rewards.json` | não consumido | loot/recompensas | não |
| `trapshazards.json` | não consumido | Trap/Hazard Compendium | snapshots próprios, nunca fake monster |
| `actions.json`, `variantrules.json` | não consumido | Quick Rules | não |
| `objects.json`, `fluff-objects.json` | não consumido | objetos/destructibles | snapshots próprios |

`scripts/generate-compendium-suggestions.mjs` gera `public/compendium/suggestions.json` a partir de skills, languages, senses e conditions. O `CompendiumSuggestionsService` carrega esse asset sob demanda para o editor. Textos homebrew continuam aceitos mesmo quando não aparecem no catálogo.

`makebrew-creature.json` não existe no checkout atual. Não deve ser introduzido como dependência implícita; traits manuais continuam sendo o contrato da CreatureSheet.
