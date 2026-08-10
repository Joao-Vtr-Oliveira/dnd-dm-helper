# Roadmap 5etools Homebrew

## Objetivo

Transformar a area 5etools em um criador de homebrew assistido, confortavel de usar e alinhado ao ecossistema real do 5etools.

## Regras de execucao

1. Trabalhar em partes pequenas.
2. Ao final de cada parte, rodar `npm run build`.
3. So avancar para a proxima parte se a build passar.
4. Manter `JSON avancado` como fallback para casos fora do fluxo comum.
5. Preservar compatibilidade com campos desconhecidos do 5etools.

## Fontes consultadas

- Dados reais do 5etools:
  - `data/bestiary/bestiary-mm.json`
  - `data/spells/spells-xphb.json`
- Schemas do ecossistema 5etools:
  - `schema/brew/homebrew.json`
  - `schema/brew/bestiary/bestiary.json`
  - `schema/brew/bestiary/template.json`
  - `schema/brew/spells/spells.json`
  - `schema/brew/actions.json`
  - `schema/brew/optionalfeatures.json`
  - `schema/brew/feats.json`
  - `schema/brew/items.json`
  - `schema/brew/entry.json`

## Partes planejadas

### Parte 1

Melhorar o editor principal de monster/trap para que o fluxo comum nao use campos JSON e tenha mais respiro visual.

Escopo:

- aumentar espacamento e separar melhor os grupos visuais do editor
- remover do fluxo comum:
  - `AC (JSON)`
  - `Speed (JSON)`
  - `Saves (JSON)`
  - `Skills (JSON)`
  - `Type` misturado com JSON
- substituir por campos visuais para:
  - tipo principal + tags
  - AC base + origem opcional
  - movement speeds
  - saves por atributo
  - skills por pericia
  - senses e idiomas com formato mais amigavel
  - resistencias/imunidades/vulnerabilidades/condition immunities
- manter `JSON avancado` apenas na aba especifica

Status: concluida

Resultado:

- editor basico do monster reorganizado em grupos mais claros
- campos JSON removidos do fluxo comum de criacao para:
  - tipo
  - AC
  - speed
  - saves
  - skills
- listas comuns agora editaveis como campos amigaveis:
  - senses
  - languages
  - resist
  - immune
  - vulnerable
  - conditionImmune
- `npm run build` passou apos a mudanca

### Parte 2

Criar a camada de dados de referencia do 5etools e o importador de magias.

Escopo:

- novo servico de referencia 5etools
- cache e lazy load por colecao/source
- importador de magias com busca e preview

Status: concluida

Resultado:

- novo servico de referencia 5etools focado em spells oficiais
- leitura do indice oficial de spells do 5etools
- carregamento lazy por `source`
- picker/modal de importacao de magias no editor de spellcasting
- busca por nome, filtro por `source`, nivel e escola
- preview da magia antes da importacao
- insercao da tag `{@spell Nome|Source}` no nivel selecionado
- `npm run build` passou apos a mudanca

### Parte 3

Adicionar importadores de:

- actions
- optional features
- feats

Status: concluida

Resultado:

- camada de referencia ampliada para:
  - `actions`
  - `optionalfeature`
  - `feat`
- novo picker generico para referencias baseadas em `entries`
- importacao conectada ao editor de blocos por secao:
  - `Importar action`
  - `Importar feature`
  - `Importar feat`
- a importacao atual e segura e textual:
  - cria um novo bloco com `name` + `entries` da referencia
- quando feat/feature possui `additionalSpells`, o sistema avisa que ha spells associadas para integracao em etapa posterior
- `npm run build` passou apos a mudanca

### Parte 4

Adicionar importador de items, conditions/status/languages e melhorar os blocos `entries`.

Status: concluida

Resultado:

- camada de referencia ampliada para:
  - `item`
  - `condition`
  - `status`
  - `language`
- importacao de `item`, `condition` e `status` no editor de blocos de monster
- importacao de `language` no campo de idiomas do monster
- melhoria incremental do editor visual de entries em blocos de monster:
  - suporte visual para texto simples
  - suporte visual para sub-blocos `entries`
  - nested entries editaveis sem abrir JSON
- importacoes continuam seguras:
  - criam blocos com `name` + `entries`
  - mantem fallback para JSON avancado quando a estrutura foge do subset visual
- `npm run build` passou apos a mudanca

### Parte 5

Adicionar templates, legendary groups e pacotes reutilizaveis de composicao.

Status: pendente

## Progresso

- [x] Roadmap salvo no repositorio
- [x] Parte 1 concluida
- [x] Parte 2 concluida
- [x] Parte 3 concluida
- [x] Parte 4 concluida
- [ ] Parte 5 concluida
