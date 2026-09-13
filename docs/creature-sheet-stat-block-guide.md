# Guia de Implementação: CreatureSheet como Stat Block

## Objetivo

Evoluir `CreatureSheet` para representar um stat block de criatura/NPC 5e, não uma ficha de personagem. A criação mínima continua sendo nome, CA, HP e ações. Todo campo novo é opcional e seções sem conteúdo não renderizam.

## Contratos que não podem regredir

- `maxHp` e `armorClass` continuam sendo os valores numéricos usados pelo Battle Tracker.
- Estado de combate fica em `BattleCombatant`: HP atual, HP temporário, condições, cooldowns, usos, slots gastos, concentração e death saves.
- `CreatureSheet` é referência reutilizável e `EncounterParticipant.sheet` é um snapshot preparado por cópia profunda.
- Uma edição posterior da biblioteca não altera encounter já preparado nem batalha iniciada.
- Backup de campanha permanece no schema `2`. Campos novos ausentes devem ser aceitos e preservados como ausentes, sem preencher `0`, `[]` ou texto de placeholder.
- O renderer nunca mostra `—` para campos opcionais ausentes.
- O DM pode sempre informar texto manual/homebrew; catálogos são sugestões, não enums obrigatórios.

## Modelo alvo

Adicionar campos opcionais canônicos em `CreatureSheet` para aliases, groups, source, size, type, alignment, CR, level, nota de CA, fórmula de HP, movement, scores, saves, skills, passive perception, defesas, senses, languages, metadata de spellcasting e metadata de ações lendárias.

Usar os seguintes princípios de estrutura:

- Scores: record parcial de `str`, `dex`, `con`, `int`, `wis`, `cha`; modifier é derivado no renderer.
- Saves e skills: listas explícitas `{ ability|skill, bonus }`, únicas pela chave. Nunca calcular a lista completa.
- Defesas: grupos `{ types: string[], note?: string }`, para preservar condições como B/P/S não mágicos.
- Senses: `{ name, detail?: string }`, preservando distância e notas.
- Languages e condition immunities: strings livres, com sugestões opcionais.
- Features: uma coleção por `kind` (`trait`, `action`, `bonus`, `reaction`, `legendary`, `spellcasting`, `note`), com custo lendário opcional.
- Recarga operacional: novas abilities apontam para `featureId`; `specialAbilities` legadas permanecem aceitas para não invalidar backups. Não criar a mesma action duas vezes para dados novos.
- Spellcasting: magias e slots continuam nas estruturas existentes; metadata adicional é somente descritiva e não vira ficha de caster/player.

## Ordem obrigatória de trabalho

1. Atualizar tipos e normalizadores em `creature-sheet-model.ts`, `CreatureTemplateService` e `LocalStorageService`.
2. Atualizar validação/importação/exportação de sheets e backup V2.
3. Centralizar conversão de `CompendiumMonster` e `FiveEToolsMonster` para os campos canônicos, preservando apenas saves/skills presentes no RAW.
4. Criar catálogo local gerado para sugestões de skills, languages, senses e condition immunities. Componentes nunca leem JSON RAW diretamente.
5. Expandir o editor por seções colapsáveis e linhas adicionáveis, sem card-inside-card e sem campos vazios permanentes.
6. Criar `CreatureStatBlockComponent` de leitura e reutilizá-lo no Bestiary e no modal da batalha.
7. Guardar uma referência imutável de ficha uma única vez em `BattleEncounter`, fora de `BattleTurnSnapshot`; combatants apontam para ela por ID.
8. Adicionar testes de compatibilidade, round-trip, conversão, snapshot e independência de runtime.
9. Atualizar documentação e rodar todos os validadores.

## Datasets locais: uso nesta task

| Dataset RAW | Uso atual nesta task | Consumer planejado | Snapshots/backups |
| --- | --- | --- | --- |
| `skills.json` | Sugestão de skills selecionadas | catálogo local de criatura | apenas strings/bônus escolhidos |
| `languages.json` | Sugestão de idiomas | catálogo local de criatura | apenas textos escolhidos |
| `senses.json` | Sugestão de tipos de sense | catálogo local de criatura | apenas entradas escolhidas |
| `conditionsdiseases.json` | Sugestão de condition immunities | catálogo local de criatura | apenas textos escolhidos |
| `monsterfeatures.json` | Inspecionado; não é dependência | futuro picker/CR tooling | não |
| `bestiary/template.json` | Referência futura para templates | não implementar | não |
| `bestiary/fluff-index.json`, `fluff-bestiary-*.json` | Enrichment sob demanda por name + source | futuro fluff repository | nunca em snapshot/runtime/undo |

`makebrew-creature.json` não está presente neste checkout. Não introduzir dependência dele.

## Datasets fora de escopo

| Dataset | Uso futuro, não implementar agora |
| --- | --- |
| `feats.json`, `fluff-feats.json` | Compêndio de feats ou importação opcional como trait |
| `optionalfeatures.json`, `fluff-optionalfeatures.json` | Referência opcional para NPC/homebrew |
| `items.json`, `items-base.json`, `magicvariants.json`, `fluff-items.json` | Compêndio de itens/magic items |
| `loot.json`, `tables.json`, `rewards.json` | Loot e recompensas |
| `trapshazards.json`, `fluff-trapshazards.json` | Compêndio de traps/hazards, nunca fake monster |
| `actions.json`, `variantrules.json` | Referência rápida de regras |
| `objects.json`, `fluff-objects.json` | Objetos/destructibles próprios |

## Conversão 5eTools

- O caminho é RAW -> normalizer/adapter -> domínio; UI não acessa RAW.
- Preservar `name + source` em spell references. Não fazer alias silencioso de `XPHB` para `PHB`.
- Importar AC com nota, HP com fórmula, speed, scores, saves, skills, passive, defesas, senses, languages, blocos de feature e spellcasting.
- Preservar campos técnicos úteis em `rawFiveETools` para reexportação de homebrew, sem expô-los no editor comum.
- `officialSnapshot` e `rawFiveETools` são enrichment/proveniência. A ficha canônica deve ser suficiente para consulta durante batalha.

## Battle Tracker

- Não colocar o stat block inteiro no card principal.
- Criar ação discreta `Ver ficha completa` no inspector.
- Modal mostra a referência congelada quando a batalha começou.
- Referências ficam em uma coleção de `BattleEncounter`, não dentro de cada combatant nem em snapshots de Undo.
- Batalhas antigas sem referência rica devem abrir uma ficha parcial sintetizada, sem falhar no carregamento.

## Validação final

Executar, após testes focados:

```bash
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
npm run test:migration
npm run validate:backup-v2
npm run validate:campaign-world
npm run validate:bestiary
npm run validate:spells
```
