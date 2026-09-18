# Guia para IAs: gerar fichas para o D&D DM Helper

Este documento é um contrato de geração. Uma IA que seguir estas instruções consegue criar uma ou várias fichas homebrew prontas para importar no D&D DM Helper.

Para contexto de campanha, aplique também `docs/contextual-content-contract-draft.md`. Localização e organização são relações formais; tags são somente busca. `classes` é usado apenas para NPCs/PCs com classe estabelecida. Monstros normalmente não possuem `classes`.

## Instruções para a IA

Ao receber um pedido para criar uma criatura, NPC, monstro, boss ou personagem:

1. Gere o JSON do formato descrito neste documento.
2. Use somente os nomes de campos definidos aqui. Campos inventados não fazem parte da ficha e podem ser ignorados pelo importador.
3. Gere JSON válido, sem comentários, trailing commas, explicações ou Markdown ao redor do JSON.
4. Se alguma informação opcional não for conhecida, omita o campo. Não use `"—"`, `"N/A"`, `0` ou arrays vazios para campos opcionais.
5. Sempre inclua os campos obrigatórios, mesmo quando uma lista estiver vazia.
6. Não gere estado de batalha. HP atual, condições, usos gastos, cooldown atual e rolagens pertencem ao Battle Tracker e são criados pelo aplicativo.
7. Se o usuário não informar um valor necessário para jogar, faça uma escolha razoável e informe essa escolha apenas fora do JSON, se ele tiver pedido explicações. Quando o pedido for somente o arquivo, entregue apenas o JSON.

O JSON final pode conter várias fichas em `sheets`. O usuário pode colá-lo no modal **Importar fichas** ou salvar o conteúdo como um arquivo `.json`.

## Envelope obrigatório

O importador aceita o formato atual de fichas, schema `2`. A raiz deve ser um objeto com esta estrutura:

```json
{
  "app": "dnd-dm-helper",
  "type": "homebrew-sheets",
  "schemaVersion": 2,
  "exportedAt": "2026-09-16T00:00:00.000Z",
  "sheets": []
}
```

| Campo | Tipo | Regra |
| --- | --- | --- |
| `app` | string | Deve ser exatamente `dnd-dm-helper`. |
| `type` | string | Deve ser exatamente `homebrew-sheets`. |
| `schemaVersion` | number | Deve ser exatamente `2`. |
| `exportedAt` | string | Data válida, preferencialmente ISO 8601 UTC. |
| `sheets` | array | Uma ou mais fichas no formato abaixo. |

Não use este formato para backup completo de campanha. Backups possuem outro importador e outro contrato.

## Envelope de cada ficha

Cada item de `sheets` deve conter:

```json
{
  "externalId": "boss-arauto-da-fenda-cr-6",
  "title": "Arauto da Fenda",
  "category": "monster",
  "tags": ["boss", "homebrew", "ai-generated"],
  "source": "Homebrew",
  "data": {}
}
```

| Campo | Obrigatório | Tipo | Regra |
| --- | --- | --- | --- |
| `externalId` | Recomendado | string | ID estável e único, em kebab-case. Não use UUID aleatório. Se omitido, o aplicativo gera um ID. |
| `title` | Sim | string | Título exibido na biblioteca. Normalmente igual a `data.name`. |
| `category` | Sim | string | Somente `monster`, `npc`, `pc` ou `other`. |
| `classes` | Não | string[] | Classes 5e formais para NPCs/PCs. Normalmente omita para monstros; não use tags como substituto em fichas novas. |
| `tags` | Não | string[] | Tags úteis para busca e filtros. |
| `source` | Sim | string | Origem do registro, por exemplo `Homebrew`, `AI-generated` ou `Notion`. Deve ser texto não vazio. |
| `data` | Sim | object | A ficha de criatura descrita na próxima seção. |

Não envie `id`, `createdAt` ou `updatedAt` no envelope. Esses campos são identidade local e timestamps do navegador; o importador os ignora ou recria.

## Metadata contextual

Use os campos abaixo quando a ficha tiver contexto de campanha revisado. Eles ficam no
envelope, fora de `data`:

```json
{
  "externalId": "npc-example",
  "title": "Example NPC",
  "category": "npc",
  "classes": ["ranger"],
  "generic": false,
  "locationRefs": [
    { "scopeType": "state", "scopeId": "feng", "relation": "base" }
  ],
  "organizationRefs": [
    { "organizationId": "example-organization", "relation": "member" }
  ],
  "tags": ["investigator", "social"],
  "source": "Homebrew",
  "data": {}
}
```

`classes` é opcional e só se aplica a NPCs/PCs com classe 5e estabelecida. Monstros
normalmente não possuem classe e devem omitir esse campo. `locationRefs` e
`organizationRefs` usam IDs formais; tags não substituem nenhum desses campos e não
devem duplicar classe, categoria, tipo de criatura, status, localização ou organização
em fichas novas.

### Escolha de organização e escopo

Antes de preencher `organizationRefs`, confirme que a organização pertence ao registry
formal de `dnd/Guildas & Grupos/`. O tipo é apenas descritivo: `guild`, `group`, `cult`,
`family` e outros tipos revisados não determinam elegibilidade. Red Vortex, Daniels e
Genya continuam disponíveis por serem organizações formais dessa fonte.

Uma entrada que existe apenas em `Mundo/.../Guildas.md` representa contexto local,
presença, serviço ou infraestrutura e não deve ser promovida automaticamente a
Organization. Para uma comunidade ou serviço limitado à vila, use contexto local ou um
POI, não uma relação organizacional formal. Nunca derive `organizationRefs` de tags,
`groups`, nome, profissão, presença ou proximidade.

## `data`: campos obrigatórios

O objeto `data` representa o stat block reutilizável da criatura. Estes campos sempre devem existir:

```json
{
  "name": "Arauto da Fenda",
  "armorClass": 17,
  "maxHp": 112,
  "spellSlots": [],
  "spells": [],
  "specialAbilities": [],
  "features": []
}
```

| Campo | Tipo | Regra |
| --- | --- | --- |
| `name` | string | Nome da criatura. Não pode ser vazio. |
| `armorClass` | number ou `null` | CA numérica. Use `null` se desconhecida. Prefira número, não texto como `"17 (armadura natural)"`. |
| `maxHp` | number inteiro | PV máximo, inteiro não negativo. |
| `spellSlots` | array | Sempre presente, mesmo para criaturas sem magia. |
| `spells` | array | Sempre presente, mesmo para criaturas sem magia. |
| `specialAbilities` | array | Sempre presente, mesmo sem habilidades com controle operacional. |
| `features` | array | Sempre presente, mesmo sem traits ou ações. |

## `data`: identidade e combate

Todos os campos a seguir são opcionais:

```json
{
  "aliases": ["Arauto"],
  "groups": ["Culto da Fenda"],
  "tags": ["aberration"],
  "origin": "Homebrew",
  "source": "Homebrew",
  "size": "Large",
  "creatureType": "aberration",
  "alignment": "chaotic evil",
  "challengeRating": "6",
  "armorClassNote": "armadura natural",
  "hitPointFormula": "13d10 + 39",
  "speed": [
    { "type": "walk", "distance": "30 ft." },
    { "type": "fly", "distance": "60 ft.", "hover": true }
  ]
}
```

Regras importantes:

- `challengeRating` é string. Valores válidos incluem `0`, `1/8`, `1/4`, `1/2` e os inteiros de `1` a `30`. Para CR 6, escreva `"6"`, não `"CR 6"`.
- `level` é number inteiro de `1` a `20` e pode ser usado para PC/NPC sem ND. Se `challengeRating` e `level` existirem, o ND determina o bônus de proficiência.
- `size`, `creatureType`, `alignment`, `origin` e `source` aceitam texto livre. Os valores de catálogo são sugestões, não uma restrição para homebrew.
- `speed[].type` normalmente é `walk`, `fly`, `swim`, `climb` ou `burrow`, mas o modelo aceita texto personalizado.
- `speed[].distance` é texto para preservar unidades, como `"30 ft."`, `"9 m"` ou `"3 quadrados"`.
- `hover: true` indica que a criatura pode pairar. Omita o campo quando não se aplicar.
- `hitPointFormula` e `armorClassNote` são apenas detalhes de exibição. O valor numérico continua em `maxHp` e `armorClass`.

## Atributos, salvaguardas e perícias

```json
{
  "abilityScores": {
    "str": 18,
    "dex": 14,
    "con": 16,
    "int": 12,
    "wis": 14,
    "cha": 16
  },
  "savingThrows": [
    { "ability": "con", "bonus": 6 },
    { "ability": "wis", "bonus": 5 }
  ],
  "skills": [
    { "name": "Perception", "ability": "wis", "bonus": 5 },
    { "name": "Athletics", "ability": "str", "bonus": 7, "proficiencyMultiplier": 1 },
    { "name": "Stealth", "ability": "dex", "bonus": 5, "proficiencyMultiplier": 2 }
  ],
  "passivePerception": 15
}
```

### `abilityScores`

É um objeto parcial. As únicas chaves de atributo são:

`str`, `dex`, `con`, `int`, `wis`, `cha`

Inclua somente os atributos conhecidos. O modificador é calculado pelo aplicativo com a fórmula padrão da 5e:

`floor((score - 10) / 2)`

### `savingThrows`

Cada salvaguarda tem:

- `ability`: uma das seis chaves de atributo.
- `bonus`: número, incluindo valores negativos.

Inclua somente salvaguardas proficientes ou explicitamente especiais. Não gere automaticamente as seis salvaguardas.

### `skills`

Cada perícia tem:

- `name`: texto da perícia.
- `ability`: habilidade governante. É recomendado sempre informar este campo, principalmente para perícias personalizadas ou nomes traduzidos.
- `bonus`: número.
- `proficiencyMultiplier`: `1` para proficiência normal ou `2` para expertise.

Para que a aplicação consiga inferir a habilidade automaticamente, use nomes padrão em inglês, como `Perception`, `Stealth` ou `Athletics`. Para nomes em português, informe `ability` explicitamente.

Quando `challengeRating` ou `level` e `abilityScores` estiverem presentes, o aplicativo recalcula bônus de salvaguardas e perícias a partir desses dados. Portanto, gere valores coerentes. A proficiência de uma criatura CR 6 é `+3`.

`passivePerception` é derivada automaticamente: `10 + bônus de Perception`, ou `10 + modificador de WIS` se não houver a perícia. Pode ser omitida.

## Defesas, sentidos, idiomas e condições

```json
{
  "damageVulnerabilities": [
    { "types": ["cold"] }
  ],
  "damageResistances": [
    { "types": ["fire", "lightning"], "note": "não mágicos" }
  ],
  "damageImmunities": [
    { "types": ["poison"] }
  ],
  "conditionImmunities": ["poisoned", "frightened"],
  "senses": [
    { "name": "darkvision", "detail": "120 ft." },
    { "name": "tremorsense", "detail": "30 ft." }
  ],
  "languages": ["Common", "Deep Speech"]
}
```

As três listas de dano usam objetos `{ "types": string[], "note?: string" }`. Agrupe tipos quando a mesma observação se aplica a todos. Exemplos de tipos: `acid`, `cold`, `fire`, `force`, `lightning`, `necrotic`, `poison`, `psychic`, `radiant`, `thunder`, `bludgeoning`, `piercing` e `slashing`.

Os textos de `conditionImmunities`, `senses` e `languages` são livres. Para condições, prefira os nomes padrão em inglês quando quiser que o reconhecimento visual do aplicativo seja mais consistente.

## Features: traits, ações e texto visível

`features` é a parte exibida no stat block. Cada item tem:

```json
{
  "id": "feature-rajada-da-fenda",
  "name": "Rajada da Fenda",
  "description": "Ataque à distância...",
  "kind": "action"
}
```

Campos:

- `id`: string estável e única dentro da ficha. O aplicativo consegue gerar uma, mas a IA deve fornecer uma ID legível.
- `name`: obrigatório e não vazio.
- `description`: texto da regra, alcance, alvo, teste, dano e efeitos.
- `kind`: exatamente um de `trait`, `action`, `bonus`, `reaction`, `legendary`, `spellcasting` ou `note`.
- `legendaryCost`: número inteiro positivo, usado somente quando `kind` é `legendary`.

Escolha o `kind` conforme a economia de ações:

| `kind` | Uso |
| --- | --- |
| `trait` | Traço passivo ou habilidade sempre disponível. |
| `action` | Ação no turno. |
| `bonus` | Ação bônus. |
| `reaction` | Reação. |
| `legendary` | Ação lendária fora do turno, com custo opcional. |
| `spellcasting` | Texto adicional de conjuração, se necessário. |
| `note` | Nota que não é uma ação ou traço. |

Descreva todo o comportamento relevante em `description`. O aplicativo exibe o texto, mas não interpreta automaticamente dados de dano, alcance ou jogadas de ataque.

## Habilidades com controle operacional

`specialAbilities` alimenta os controles do Battle Tracker. Ela não substitui o texto visível de `features`.

Tipos válidos de `recoveryType`:

| Valor | Significado | Campo adicional |
| --- | --- | --- |
| `manual` | O mestre controla manualmente. | Nenhum. |
| `turn-cooldown` | Volta após uma quantidade de turnos. | `cooldownTurns` positivo. |
| `round-cooldown` | Volta após uma quantidade de rounds. | `cooldownRounds` positivo. |
| `uses-per-day` | Quantidade limitada por dia. | `maxUses` positivo. |
| `uses-per-combat` | Quantidade limitada na batalha. | `maxUses` positivo. |
| `short-rest` | Recupera em descanso curto. | `maxUses` positivo. |
| `long-rest` | Recupera em descanso longo. | `maxUses` positivo. |
| `dice-recharge` | O mestre rola um d6 para recarregar. | `rechargeDice: "d6"` e, opcionalmente, `rechargeOn`. |

### Regra de vinculação

Quando uma habilidade já está descrita em uma feature, não duplique nome e descrição. Crie a feature visível e uma habilidade operacional apontando para ela:

```json
{
  "features": [
    {
      "id": "feature-reacao-do-abismo",
      "name": "Reação do Abismo",
      "description": "Quando sofrer dano, o Arauto reduz o dano em 10 pontos.",
      "kind": "reaction"
    }
  ],
  "specialAbilities": [
    {
      "id": "ability-reacao-do-abismo",
      "featureId": "feature-reacao-do-abismo",
      "recoveryType": "round-cooldown",
      "cooldownRounds": 1
    }
  ]
}
```

No início da batalha, o aplicativo resolve `featureId` e usa o nome e a descrição da feature no controle operacional. O `featureId` deve corresponder exatamente a uma `features[].id`.

Uma habilidade operacional também pode usar diretamente `name` e `description`, sem `featureId`, quando não houver texto correspondente no stat block:

```json
{
  "id": "ability-teleporte",
  "name": "Teleporte Instável",
  "description": "Move-se magicamente até 30 ft.",
  "recoveryType": "uses-per-combat",
  "maxUses": 2
}
```

Regras de recarga:

- Para `turn-cooldown`, use `cooldownTurns`, não `cooldownRounds`.
- Para `round-cooldown`, use `cooldownRounds`, não `cooldownTurns`.
- Para limites de uso, use `maxUses` e não `uses`.
- Para `dice-recharge`, `rechargeDice` deve ser exatamente `"d6"`.
- `rechargeOn` é uma lista de faces entre `1` e `6`; se omitida, o Battle Tracker usa `5` e `6`.
- Não inclua `usedCount`, `isAvailable`, `currentCooldownTurns`, `currentCooldownRounds`, `lastUsedAt` ou resultados de dados. Esses são campos de runtime.

## Magias e espaços

`spellSlots` representa a capacidade de conjuração:

```json
[
  { "level": 1, "max": 4 },
  { "level": 2, "max": 3 },
  { "level": 3, "max": 2 }
]
```

`level` deve ser inteiro de `1` a `9`. `max` é a quantidade de espaços.

Cada item de `spells` deve conter pelo menos:

```json
{
  "id": "PHB:shield",
  "name": "Shield",
  "source": "PHB",
  "level": 1,
  "castingGroup": "slot"
}
```

Campos de uma magia:

- `id`: string obrigatória. Use uma ID estável; para magias do compêndio, prefira a ID canônica `SOURCE:nome-url-encoded`.
- `name`: nome obrigatório.
- `source`: abreviação da fonte, como `PHB`, `XGE` ou `TCE`. É usada junto com o nome para resolver a referência local.
- `level`: `0` para truque ou `1` a `9` para magia de nível superior.
- `uses`: número opcional para grupos limitados.
- `castingGroup`: `slot`, `at-will`, `constant`, `daily`, `rest` ou `weekly`.
- `each`: `true` quando `uses` significa usos por criatura/alvo em vez de usos totais.

Use `castingGroup: "slot"` para magia que consome espaço, `"at-will"` para uso à vontade e os grupos de uso para habilidades inatas. Magias sem `castingGroup` usam o comportamento legado baseado em `level`.

O aplicativo resolve magias por `name + source`; o campo `id` é necessário no JSON da ficha, mas não substitui nome e fonte. Não invente uma fonte oficial para uma magia homebrew. Nesse caso, use algo como `source: "Homebrew"` e aceite que ela será apenas uma referência textual.

## Referências oficiais de IDs e fontes

Quando a ficha usar magias ou talentos existentes, consulte os dados originais do 5etools:

- [Diretório oficial de magias 5eTools 2014](https://github.com/5etools-mirror-3/5etools-2014-src/tree/main/data/spells)
- [Arquivo oficial de talentos](https://raw.githubusercontent.com/5etools-mirror-3/5etools-2014-src/refs/heads/main/data/feats.json)

Para magias, preserve `name` e `source` do registro original. No índice local do aplicativo, a forma típica da ID é `SOURCE:nome-com-espaços-codificados`, por exemplo `PHB:shield` ou `PHB:misty%20step`.

Talentos do arquivo oficial possuem identidade bibliográfica por `name + source`, mas `CreatureFeature` não possui um campo `featId` separado. Ao transformar um talento em trait:

1. Copie o nome para `features[].name`.
2. Converta o efeito para texto em `features[].description`.
3. Use uma ID local estável em `features[].id`, como `feature-alert`.
4. Não coloque o objeto bruto de feat dentro de um campo arbitrário.

Se for necessário preservar dados brutos para uma futura reexportação 5eTools, isso deve ser solicitado explicitamente. Para uma ficha homebrew plug-and-play, a forma canônica é o texto normalizado em `features`.

## O que não deve ser gerado

Não inclua:

- Uma raiz que seja array.
- `type: "campaign-backup"`.
- Campos de runtime de batalha, como HP atual, condições, death saves, recursos gastos ou iniciativa.
- Campos locais `id`, `createdAt` e `updatedAt` do envelope.
- `category` dentro de `data`; a categoria fica no item de `sheets`.
- `rechargeType` dentro de `data.specialAbilities`; use `recoveryType`.
- `usedCount` ou `isAvailable` em `data.specialAbilities`.
- Dano, CD ou alcance em campos inventados. Coloque regras em `features[].description`.
- `rawFiveETools` ou `officialSnapshot` sem uma razão concreta. Esses campos são metadados de proveniência, não necessários para uma ficha homebrew.

## Checklist antes de entregar o JSON

Verifique todos os itens:

- A raiz é um objeto JSON válido.
- `app` é `dnd-dm-helper`.
- `type` é `homebrew-sheets`.
- `schemaVersion` é `2`.
- `exportedAt` é uma data válida.
- `sheets` é um array.
- Cada ficha tem `title`, `category`, `source` e `data`.
- Cada categoria é `monster`, `npc`, `pc` ou `other`.
- `data.name` é texto não vazio.
- `data.armorClass` é número ou `null`.
- `data.maxHp` é um número inteiro não negativo.
- `spellSlots`, `spells`, `specialAbilities` e `features` são arrays.
- Toda magia tem `id` e `name`.
- Toda habilidade especial tem `recoveryType` válido.
- Toda feature tem `name` e `kind` válido.
- Todo `featureId` aponta para uma feature existente.
- IDs repetidas não existem dentro da mesma ficha.
- Nenhum comentário ou texto fora do JSON será enviado ao importador.

## Exemplo completo funcional

O exemplo abaixo pode ser importado diretamente:

```json
{
  "app": "dnd-dm-helper",
  "type": "homebrew-sheets",
  "schemaVersion": 2,
  "exportedAt": "2026-09-16T00:00:00.000Z",
  "sheets": [
    {
      "externalId": "boss-arauto-da-fenda-cr-6",
      "title": "Arauto da Fenda",
      "category": "monster",
      "tags": ["boss", "homebrew", "ai-generated"],
      "source": "Homebrew",
      "data": {
        "name": "Arauto da Fenda",
        "armorClass": 17,
        "maxHp": 112,
        "spellSlots": [
          { "level": 1, "max": 4 },
          { "level": 2, "max": 3 }
        ],
        "spells": [
          {
            "id": "PHB:shield",
            "name": "Shield",
            "source": "PHB",
            "level": 1,
            "castingGroup": "slot"
          },
          {
            "id": "PHB:misty%20step",
            "name": "Misty Step",
            "source": "PHB",
            "level": 2,
            "castingGroup": "slot"
          }
        ],
        "specialAbilities": [
          {
            "id": "ability-reacao-do-abismo",
            "featureId": "feature-reacao-do-abismo",
            "recoveryType": "round-cooldown",
            "cooldownRounds": 1
          },
          {
            "id": "ability-colapso-da-fenda",
            "featureId": "feature-colapso-da-fenda",
            "recoveryType": "uses-per-combat",
            "maxUses": 2
          },
          {
            "id": "ability-eco-dimensional",
            "name": "Eco Dimensional",
            "description": "O Arauto se teleporta até 30 ft.",
            "recoveryType": "dice-recharge",
            "rechargeDice": "d6",
            "rechargeOn": [5, 6]
          }
        ],
        "features": [
          {
            "id": "feature-presenca-distorcida",
            "name": "Presença Distorcida",
            "description": "Criaturas que começam o turno a até 10 ft. do Arauto devem ser bem-sucedidas em um teste de resistência de Sabedoria CD 14 ou ficam frightened até o início do próximo turno delas.",
            "kind": "trait"
          },
          {
            "id": "feature-rajada-da-fenda",
            "name": "Rajada da Fenda",
            "description": "Ataque mágico à distância: +6 para atingir, alcance 120 ft., um alvo. Dano: 18 (4d8) de force.",
            "kind": "action"
          },
          {
            "id": "feature-reacao-do-abismo",
            "name": "Reação do Abismo",
            "description": "Quando sofrer dano, o Arauto reduz o dano sofrido em 10 pontos.",
            "kind": "reaction"
          },
          {
            "id": "feature-colapso-da-fenda",
            "name": "Colapso da Fenda",
            "description": "Cada criatura em um raio de 15 ft. deve fazer um teste de resistência de Destreza CD 14. Em uma falha, sofre 22 (4d10) de force e fica prone; em um sucesso, sofre metade do dano e não fica prone.",
            "kind": "action"
          },
          {
            "id": "feature-passo-impossivel",
            "name": "Passo Impossível",
            "description": "O Arauto se move até metade do deslocamento sem provocar ataques de oportunidade.",
            "kind": "legendary",
            "legendaryCost": 1
          }
        ],
        "size": "Large",
        "creatureType": "aberration",
        "alignment": "chaotic evil",
        "challengeRating": "6",
        "armorClassNote": "armadura natural",
        "hitPointFormula": "13d10 + 39",
        "speed": [
          { "type": "walk", "distance": "30 ft." },
          { "type": "fly", "distance": "60 ft.", "hover": true }
        ],
        "abilityScores": {
          "str": 18,
          "dex": 14,
          "con": 16,
          "int": 12,
          "wis": 14,
          "cha": 16
        },
        "savingThrows": [
          { "ability": "con", "bonus": 6 },
          { "ability": "wis", "bonus": 5 }
        ],
        "skills": [
          { "name": "Perception", "ability": "wis", "bonus": 5 },
          { "name": "Athletics", "ability": "str", "bonus": 7 }
        ],
        "damageResistances": [
          { "types": ["fire", "lightning"], "note": "não mágicos" }
        ],
        "damageImmunities": [
          { "types": ["poison"] }
        ],
        "conditionImmunities": ["poisoned"],
        "senses": [
          { "name": "darkvision", "detail": "120 ft." }
        ],
        "languages": ["Common", "Deep Speech"],
        "spellcasting": {
          "ability": "cha",
          "spellSaveDc": 14,
          "spellAttackBonus": 6,
          "header": "O Arauto é um conjurador de 6º nível.",
          "slotRecovery": "Recupera todos os espaços após um descanso longo."
        },
        "legendaryActions": {
          "count": 2,
          "intro": "O Arauto pode realizar 2 ações lendárias, escolhendo entre as opções abaixo, no fim do turno de outra criatura."
        }
      }
    }
  ]
}
```

Depois da importação, o aplicativo cria a ficha na biblioteca. Ao usar a ficha em um encounter e iniciar a batalha, ele cria o estado runtime separadamente, inicializa os recursos e passa a controlar as recargas configuradas em `specialAbilities`.
