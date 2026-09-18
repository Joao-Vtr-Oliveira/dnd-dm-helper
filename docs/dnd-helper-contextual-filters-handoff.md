---
type: implementation_handoff
status: draft
canon_scope: draft
temporary: true
ai_generated: true
subject: Contextual filters and Disponível aqui in dnd-dm-helper
created: 2026-09-17
source: Obsidian audit
---

# Contextual Filters / Disponível Aqui - Handoff

> [!warning] DRAFT / PROVISÓRIO / TEMPORÁRIO
> Este documento é uma ponte de especificação entre o vault Obsidian e a IA que
> implementará uma evolução no repositório `dnd-dm-helper`. Ele não é fonte de
> cânone da campanha, não substitui `campaign-world.json` e não autoriza a importação
> em massa de fichas.

## Escopo deste handoff

O objetivo é preparar o `dnd-dm-helper` para organizar conteúdo de campanhas em
workspaces e, futuramente, responder perguntas como:

> O que está disponível ou é relevante na localização atual?

O foco inicial é organizar fichas reutilizáveis e encounters. Missões devem ser
consideradas como integração futura, não como pré-requisito para a primeira versão.

Este estudo foi feito a partir do vault:

`/home/onarcoleptico/Documents/obsidian-vault/dnd`

E da versão atual do Helper:

`/home/onarcoleptico/.local/share/opencode/repos/github.com/Joao-Vtr-Oliveira/dnd-dm-helper@main`

Não foram alterados nesta task:

- código do `dnd-dm-helper`;
- `campaign-world.json`;
- Backup V2;
- fichas importadas no Helper;
- notas canônicas de Campaign State ou Story So Far;
- conteúdo narrativo para criar novas associações.

## 1. Estado atual do vault

### 1.1. Mundo e hierarquia territorial

O mundo narrativo está organizado principalmente em:

```text
dnd/
  Mundo/
    Impérios/
      <Império>/
        <Estado>/
          NPCs/
          Vilas/
          Pontos de Interesse/
          Geografia e monstros.md
          Guarda.md
          Guildas.md
```

O padrão moderno mais confiável é a hierarquia:

```text
Império -> estado -> settlement -> ponto de interesse
```

Exemplos reais:

- `Mundo/Impérios/Mornk/7-Feng/Feng.md`
- `Mundo/Impérios/Mornk/7-Feng/Vilas/Hotead/Hotead.md`
- `Mundo/Impérios/Mornk/7-Feng/Vilas/Hotead/Pontos de Interesse/Estábulos da Poeira Baixa.md`
- `Mundo/Impérios/Mornk/7-Feng/Pontos de Interesse/Árvore-Loja de Asbeel.md`

Notas modernas de localidades usam, quando disponível:

- `type: location`;
- `location_type`;
- `parent_empire`;
- `parent_state`;
- `parent_settlement`;
- `status`.

A pasta ajuda a navegar, mas não é suficiente para determinar todas as relações.
Um ponto central pode ser regional, uma organização pode operar fora da sua sede,
e uma ficha centralizada pode ter mais de uma ocorrência.

### 1.2. NPCs

NPCs aparecem em mais de uma organização física:

- índices globais em `dnd/NPCs/`;
- grupos e guildas em `dnd/NPCs/<grupo>/`;
- notas locais em `Mundo/Impérios/<império>/<estado>/NPCs/`;
- NPCs vinculados a missões;
- fichas mecânicas junto da nota-base do NPC.

O padrão moderno para NPC local é explícito. Exemplo:

`Mundo/Impérios/Mornk/7-Feng/NPCs/Maia Ferradura.md`

```yaml
type: character
title: Maia Ferradura
status: canon
empire: Mornk
state: Feng
location: Hotead
role: horse_trainer
```

O corpo da nota ainda é necessário para entender a semântica. Maia é uma
treinadora de Hotead e contato dos Estábulos da Poeira Baixa, mas não controla toda
a vila e não representa uma filial da PDB.

Outro padrão é uma relação organizacional explícita no corpo, mesmo sem metadata
estruturada. `dnd/NPCs/Carai Borracha/Romero.md`, por exemplo, declara ser integrante
do grupo `[[Guildas & Grupos/Carai Borracha]]`.

Conclusão: `location`, `state`, `empire` e links de organização são evidências de
força diferente. A implementação não deve tratar todos os NPCs legados como se
tivessem o mesmo nível de metadata.

### 1.3. Bestiário e homebrew

O Bestiário foi reorganizado em camadas:

```text
Bestiário/
  Bestiário.md
  Homebrew/
  Guarda de Mornk/
  Canônicos/
  Inventário de Criaturas - temp.md
```

`Bestiário/Bestiário.md` é um painel humano. A ocorrência local continua nas notas
regionais; a ficha mecânica fica centralizada.

`Bestiário/Homebrew/Índice de Fichas Homebrew.md` mantém a navegação das criaturas
homebrew e relaciona notas centrais a headings exatos em `Geografia e monstros.md`.

Uma nota de criatura moderna pode declarar:

- `type: creature`;
- `creature_id`;
- `external_id`;
- `status`;
- `canon_scope`;
- `source_kind`;
- `locations`;
- `regions`;
- `player_knowledge`;
- `encounter_status`;
- `mechanical_status`;
- `has_native_json`;
- `external_id`;
- `source`.

Exemplo confiável:

`Bestiário/Homebrew/Enamel Ooze.md`

```yaml
type: creature
status: canon
canon_scope: canon
player_knowledge: unknown
encounter_status: planned
source_kind: homebrew
locations:
  - "[[.../Feng/Geografia e monstros#...|Feng - Ponte Velha]]"
  - "[[.../Dortx/Geografia e monstros#...|Dortx - Forint]]"
  - "[[.../Treuz/Geografia e monstros#...|Treuz - Escórias]]"
regions:
  - Feng
  - Dortx
  - Treuz
mechanical_status: mechanical_drift
```

Essa nota demonstra que uma criatura pode ter várias ocorrências regionais, estar
canônica sem ser conhecida pelos jogadores e ainda não estar pronta como ficha
operacional final.

Exemplo que deve permanecer excluído de um filtro padrão de disponibilidade:

`Bestiário/Homebrew/Abominação Instável-draft.md`

Ela possui `locations: []`, `regions: []`, `status: draft` e
`location_status: source_mission_only`. A associação operacional com Red Vortex e
Hotead no Backup V2 não basta para disponibilizá-la em Hotead.

### 1.4. Fichas de guardas

As nove fichas institucionais da Guarda de Mornk foram centralizadas em:

`Bestiário/Guarda de Mornk/`

Cada ficha possui metadata semelhante a:

```yaml
type: institution_sheet
status: canon
canon_scope: canon
entity_type: npc
category: npc
mechanical_status: reviewed
institution: Guarda de Mornk
response_tier: C | B | A | S
external_id: <id estável>
source: Luna
```

A ficha não afirma sozinha que o arquétipo está fisicamente em cada cidade. A
presença, composição, autoridade e limitações estão nas notas estaduais `Guarda.md`.

Exemplo:

`Mundo/Impérios/Mornk/6-Plomos/Guarda.md`

liga a Plomos aos arquétipos C, B, A e S e explica que os arquétipos podem ser
combinados conforme ambiente, alvo e prioridade civil.

Isso é importante para o Helper: a ficha é reutilizável, mas “Guarda de Plomos
disponível aqui” é uma relação institucional/geográfica, não uma consequência da
ficha estar na pasta `Bestiário/Guarda de Mornk`.

### 1.5. Guildas e grupos

Existem dois níveis principais:

- `dnd/Guildas & Grupos/`: fonte formal do registry de Organizations, incluindo
  organizações globais, grupos, cultos e famílias;
- `Mundo/Impérios/Mornk/<estado>/Guildas.md`: distribuição, presença e contexto local;
  não cria uma Organization formal por si só.

O pertencimento ao registry vem da fonte formal e da revisão narrativa, não do valor de
`organizationType`. Cultos e famílias formais continuam válidos: Red Vortex, Daniels e
Genya não devem ser removidos por tipo. Comunidades, serviços, negócios e infraestrutura
que aparecem apenas nas notas estaduais continuam locais ou POIs. A criação deve deixar
visível a diferença entre uma Organization de alcance de campanha/regional e um contexto
local da vila; não se deve usar nome, tag ou allowlist para decidir isso.

O índice global `Guildas & Grupos/Guildas & Grupos.md` lista, entre outros:

- Winterhold;
- Ladrões;
- Olhos De Luna;
- Mãos De Atronos;
- Profusos De Batalha;
- Sindicado Dos Aventureiros;
- Idealistas;
- Red Vortex;
- Blue Pen;
- Carai Borracha;
- Daniels;
- Genya.

As notas estaduais modernas são muito mais semânticas. Por exemplo,
`Mundo/Impérios/Mornk/7-Feng/Guildas.md` registra:

- artesãos formados pela MDA, sem confirmar uma filial da MDA;
- Asbeel como negócio independente, sem filial de guilda;
- rede equestre de Hotead sem associação formal estabelecida;
- SDA como contato remoto inferido, sem filial confirmada;
- PDB como ausência intencional, apesar de haver cavalos e treinamento local;
- ASL como operação externa em Ponte Velha, não como filial em Feng;
- ausência de ODL, Winterhold, Idealistas, Red Vortex, Komic e Genya como presenças locais canonizadas.

Essas distinções são exatamente o tipo de informação que um filtro de guilda não
pode reduzir a uma tag booleana.

### 1.6. Missions

`Missions/` possui uma estrutura híbrida:

```text
Missions/
  Missions.md
  Campaign State.md
  Story So Far.md
  notas de missão individuais
  *-draft.md
  campanha ou arco/
    missão principal.md
    sessões/
    encontros/
    fichas/
```

O índice `Missions/Missions.md` separa visualmente:

- estado da campanha;
- sessões e preparação;
- seeds e missões legadas;
- missões arquivadas;
- drafts;
- missões canônicas por status e local;
- contratos SDA;
- missões canônicas por região.

O sistema de missões documenta metadata explícita:

- `type`;
- `story_id`;
- `status`;
- `canon_scope`;
- `parent_arc`;
- `locations`;
- `regions`;
- `npcs`;
- `guilds`;
- `contract_source`;
- `contractor`;
- `contract_contact`;
- `sda_post`;
- `difficulty`;
- `play_status`;
- `contains_canon_events`.

Esse sistema é uma boa fonte futura para contexto, mas precisa ser filtrado por
status e escopo. Uma seed localizada em Nagazav não é missão disponível. Uma sessão
planejada não é automaticamente acontecimento jogado. `Campaign State.md`,
`Story So Far.md` e `dm-notes/acontecimentos.md` continuam sendo fontes especiais
de continuidade.

## 2. Relações encontradas

### 2.1. Ficha ↔ localização

Foram encontrados quatro significados diferentes:

1. **Base ou residência de NPC**: Maia → Hotead.
2. **Ocorrência ecológica**: Enamel Ooze → headings específicos em Feng, Dortx e Treuz.
3. **Presença institucional**: arquétipos da Guarda → composição em cada `Guarda.md` estadual.
4. **Ambientação de missão**: uma missão pode ter início, passagem, destino e região ampla.

Esses significados não devem ser comprimidos em um único campo sem semântica.

### 2.2. Ficha ↔ organização

Existem relações como:

- NPC membro de uma organização;
- NPC treinado ou certificado por uma organização;
- ficha pertencente a uma instituição pública;
- criatura ligada operacionalmente a uma facção;
- ficha com `groups` no CreatureSheet;
- ponto de interesse pertencente ou associado a uma organização;
- organização atuando em uma localidade sem possuir filial;
- operação externa de uma organização;
- influência ou contato remoto.

Uma relação não significa automaticamente disponibilidade.

Exemplo: Maia Ferradura se relaciona com a PDB por contexto e comparação, mas a
nota afirma que ela não representa uma filial da PDB. Exemplo: a ASL usa Ponte Velha
em Feng ocasionalmente, mas isso não cria uma sede local.

### 2.3. Encounter ↔ localização

No Obsidian, encounters podem estar:

- em uma pasta de missão;
- em uma nota de sessão;
- em uma ficha auxiliar;
- descritos dentro de uma missão;
- ligados por wikilink a uma localidade.

Essa relação ainda não é uniforme. Portanto, a primeira versão do Helper não deve
tentar inferir a localização de um encounter somente a partir do nome, da pasta ou
dos participantes.

Quando a relação for explicitamente escolhida pelo DM, ela pode ser armazenada no
encounter. Quando vier apenas da missão pai, deve ser distinguida como relação
herdada.

### 2.4. Conteúdo ↔ ativo/arquivado

Para missões, `status: archived`, `completed`, `abandoned` e `draft` já possuem
semântica documentada.

Para criaturas, NPCs e fichas, o vault ainda não possui um padrão universal para:

- morto;
- falecido;
- obsoleto;
- deprecated;
- substituído;
- arquivado sem deixar de existir no mundo.

O Helper não deve criar um filtro automático de “morto” com base em texto livre.
Deve permitir estado operacional explícito quando o DM decidir adotá-lo.

### 2.5. Conteúdo ↔ tags/categorias

Tags reais aparecem em fichas nativas e são úteis para facetas rápidas. Exemplos:

- `Komic`, `Warlock` em Dodman;
- `Komic`, `Rogue`, `Assassin` em He Xiao;
- `Mornk`, `Guarda`, `elite` em arquétipos da Guarda;
- `Feng`, `Dortx`, `Treuz`, `ooze`, `homebrew` em Enamel Ooze.

Mas as tags não são tipadas. A mesma lista mistura:

- classe;
- organização;
- região;
- tipo de criatura;
- função;
- estado mecânico;
- palavras de busca.

Tags devem continuar existindo, mas não podem ser a única fonte de relações de
guilda ou localização.

## 3. Padrões confiáveis

### 3.1. Referências formais de `campaign-world`

O `campaign-world.json` atual já modela:

- `empires`;
- `states` com `empireId`;
- `settlements` com `stateId`;
- `organizations`;
- `pointsOfInterest` com `settlementId`;
- calendário;
- presenças de organizações com `scopeType`, `scopeId` e `presenceType`.

Os escopos existentes são:

- `global`;
- `empire`;
- `state`;
- `settlement`.

As presenças reais incluem:

- `global-network`;
- `headquarters`;
- `major-post`;
- `regional-post`;
- `outpost`;
- `school`;
- `dojo-network`;
- `research-branch`;
- `agent`;
- `individual-agent`;
- `remote-contact`;
- `territorial-influence`;
- `operation`-like semantics em notas locais, quando ainda não foram codificadas.

Esse modelo deve ser reutilizado e ampliado com cautela, em vez de criar uma lista
paralela exclusiva para guildas.

### 3.2. Frontmatter moderno do vault

São fontes fortes quando aparecem no primeiro bloco YAML da nota:

- `type`;
- `status`;
- `canon_scope`;
- `empire`;
- `state`;
- `location`;
- `locations`;
- `regions`;
- `guild`;
- `guilds`;
- `parent_empire`;
- `parent_state`;
- `parent_settlement`;
- `parent_arc`;
- `mechanical_status`;
- `encounter_status`;
- `player_knowledge`;
- `play_status`.

O parser não deve interpretar exemplos YAML dentro de blocos de código como
metadata real. O primeiro frontmatter delimitado é a fonte de propriedades.

### 3.3. Wikilinks com heading

Links para headings específicos são evidência forte de uma relação local precisa:

```text
[[Mundo/Impérios/Mornk/2-Nagazav/Geografia e monstros#2.2. Nagawoods|Nagawoods]]
```

O Helper pode armazenar a nota de origem e o fragmento como proveniência. O texto
do heading não deve ser convertido em um settlement diferente sem resolver a
hierarquia de mundo.

### 3.4. Índices e notas de distribuição

São fontes especialmente úteis:

- `Bestiário/Bestiário.md`;
- `Bestiário/Homebrew/Índice de Fichas Homebrew.md`;
- `Mundo/Impérios/Mornk/<estado>/Guildas.md`;
- `Mundo/Impérios/Mornk/<estado>/Guarda.md`;
- `Missions/Missions.md`;
- notas individuais de localização;
- notas individuais de NPC.

Índices são navegação derivada. A nota individual ou a relação formal do mundo
continua sendo a fonte da associação.

## 4. Padrões que não são confiáveis

Não usar isoladamente:

- pasta da ficha como localização;
- pasta de NPC como prova de pertencimento a uma guilda;
- tag de organização como prova de presença local;
- nome mencionado em prosa como relação formal;
- criatura citada em uma missão como localização ecológica;
- `canon_scope: canon` como prova de conhecimento dos jogadores;
- `encounter_status: planned` como encontro disponível agora;
- existência de um ponto de interesse como prova de filial de guilda;
- existência de cavaleiros, artesãos ou soldados como prova de PDB, MDA ou Guarda;
- `groups` de CreatureSheet como relacionamento organizacional canônico;
- `source` ou `origin` como localização;
- `status: completed` como entidade arquivada em todos os domínios;
- texto contendo “morto” como status operacional sem confirmação estruturada.

O parser também não deve:

- atribuir uma criatura presente em Nagawoods a todo Nagazav;
- atribuir uma guilda a todas as settlements do estado onde ela possui um ponto;
- transformar uma operação externa em filial;
- tratar uma organização global como presente fisicamente em toda a campanha;
- duplicar uma ficha para cada ocorrência;
- transformar uma seed em disponibilidade atual;
- usar a primeira nota homônima quando um wikilink estiver ambíguo.

## 5. Bestiário/Homebrew

### 5.1. Organização atual

As fichas de criatura reutilizáveis ficam principalmente em:

`dnd/Bestiário/Homebrew/`

As fichas institucionais da Guarda ficam em:

`dnd/Bestiário/Guarda de Mornk/`

NPCs nomeados continuam em suas pastas de NPC, mesmo quando o Helper os armazena
na coleção operacional compatível de CreatureSheets.

Referências oficiais ficam em:

`dnd/Bestiário/Canônicos/Referências Oficiais.md`

O Bestiário separa NPC, instituição e fauna conceitualmente, ainda que a coleção
interna do Helper use `CreatureSheet` para mais de uma dessas categorias.

### 5.2. Metadata útil para fichas

O Helper deve conseguir armazenar ou indexar semanticamente:

- identidade estável (`id`/`externalId`);
- categoria `monster`, `npc`, `pc` ou `other`;
- tags livres;
- facetas de classe/função;
- organizações relacionadas por ID;
- localizações relacionadas por referência formal;
- tipo de relação com cada localização;
- escopo de presença;
- status operacional;
- escopo narrativo;
- conhecimento dos jogadores;
- estado do encontro;
- estado mecânico;
- proveniência da nota e do vínculo.

### 5.3. Genérico, regional e global

Uma ficha pode ser:

- **específica de um lugar**: criatura documentada somente em um heading de uma região;
- **regional**: criatura documentada em várias localizações de um estado ou região;
- **organizacional**: NPC ou unidade ligada a uma organização;
- **genérica reutilizável**: arquétipo que pode ser usado em mais de uma região sem afirmar presença em todas;
- **global**: ficha ou conteúdo explicitamente aplicável à campanha inteira.

Uma ficha genérica não deve ser retornada automaticamente como “disponível aqui”.
Ela pode aparecer em uma seção separada como “arquétipos compatíveis” ou “sem local
fixo”, desde que o Helper preserve essa diferença.

## 6. Guardas

A Guarda de Mornk é um caso de teste central.

### 6.1. O que está explícito

As fichas centrais declaram:

- instituição `Guarda de Mornk`;
- categoria `npc`;
- tier de resposta;
- canon e estado mecânico;
- IDs estáveis.

As notas estaduais declaram:

- composição local;
- autoridade;
- presença física;
- capacidade C/B/A/S;
- limitações;
- pedido de reforço;
- relação com PDB, SDA, Winterhold, MDA e outras instituições;
- cidades, rios, minas, rotas e pontos onde cada resposta é plausível.

### 6.2. Recomendação semântica

Não colocar `state: Plomos` na ficha genérica `Patrulheiro de Contato C`.

Modelar duas relações:

1. Ficha → instituição: `Guarda de Mornk`.
2. Instituição/arquétipo → escopo local: Plomos, Dortx, Khaer Morn etc., com
   composição ou presença e eventual tier/resposta.

Uma unidade especial pode ter:

- organização dona;
- estado de operação;
- settlement de base;
- área de atuação;
- tier de resposta;
- disponibilidade condicional;
- relação de reforço.

Isso evita duplicar a ficha mecânica para cada cidade.

## 7. Guildas e organizações

### 7.1. A lista de guildas é uma pré-condição

O filtro por guilda não pode depender apenas de tags.

Para filtrar por guilda de maneira confiável, o Helper precisa primeiro possuir uma
lista de organizações criada e persistida no workspace.

O `campaign-world.json` já possui a coleção `organizations`. A direção recomendada
é evoluir essa coleção para ser a fonte de identidade organizacional do workspace,
em vez de criar uma tabela paralela chamada apenas `guilds`.

O usuário precisa conseguir:

- listar organizações;
- criar organização;
- editar nome, aliases e tipo;
- arquivar ou desativar organização sem apagar referências históricas;
- declarar organização pai quando aplicável;
- cadastrar presenças por império, estado, settlement ou global;
- escolher o tipo da presença;
- vincular conteúdo à organização;
- criar uma organização durante o fluxo de edição de uma ficha ou encounter,
  sem perder o conteúdo que estava sendo editado;
- distinguir uma guilda de um grupo, culto, família ou instituição.

O rótulo de interface pode dizer “Guildas e organizações”, porque o vault contém
mais do que guildas formais.

### 7.2. Registro de organização recomendado

Sem exigir nomes exatos de TypeScript, a semântica mínima é:

```text
Organization
  stable id
  display name
  aliases
  organization type
  optional parent organization
  lifecycle status
  optional source path
  presence records[]
```

Cada presença deve conter semanticamente:

```text
OrganizationPresence
  scope type: global | empire | state | settlement | poi
  scope id
  presence type
  certainty or provenance when needed
  active/archive state when needed
```

Os tipos atuais do mundo são bons exemplos, mas não devem virar uma enumeração
fechada que impeça outras campanhas. O Helper deve aceitar novos tipos de presença
como strings validadas, ou possuir uma extensão segura para tipos customizados.

### 7.3. Relação de ficha com organização

Uma ficha deve poder ter várias relações organizacionais tipadas, por exemplo:

- member;
- leader;
- employee;
- trained_by;
- certified_by;
- institution_sheet;
- affiliated;
- enemy;
- associated;
- contractor;
- unrelated_context.

O filtro “ficha da guilda X” deve usar o ID da organização e a relação explícita.
Não deve comparar apenas o texto da tag.

Se a ficha tiver apenas uma tag com o nome da guilda e nenhum vínculo formal, a UI
pode mostrar “tag não confirmada” ou mantê-la no filtro textual, mas não deve tratá-la
como pertencimento organizacional forte.

### 7.4. Presença não é disponibilidade

Uma organização pode estar presente em Plomos como sede, em Nagazav como contato
remoto e em Dortx como posto regional. Isso não significa que toda ficha de todos os
membros está disponível em todos esses lugares.

O resultado contextual deve distinguir:

- organização presente aqui;
- conteúdo ligado à organização;
- conteúdo com presença física aqui;
- conteúdo disponível por contato ou contratação;
- conteúdo apenas relacionado por história.

## 8. Filtros de classe, categoria e tags

### 8.1. Estado atual

O Helper já filtra fichas por:

- categoria;
- tag;
- source;
- texto livre.

As fichas do vault usam tags como `Warlock`, `Rogue`, `Assassin`, `Barbarian`,
`Komic`, `Guarda`, `Mornk`, `Feng`, `ooze`, `elite` e outras.

### 8.2. Problema das tags sem tipo

Uma tag `Komic` pode ser uma organização, enquanto `Warlock` é classe e `elite` é
função ou qualidade mecânica. O Helper não consegue inferir essa diferença com
segurança a partir de uma lista plana.

Recomendação:

- manter tags livres para busca e compatibilidade;
- adicionar facetas estruturadas para os filtros importantes;
- representar organização por `organizationId`, não por tag;
- representar classe/função por uma faceta tipada ou por um catálogo de tags
  classificadas como `class`, `role`, `region`, `organization`, `mechanics` etc.;
- não obrigar fichas antigas a uma migração destrutiva imediata;
- permitir que tags existentes continuem funcionando como fallback textual.

Para a primeira versão, a ordem mais segura é:

1. categoria nativa;
2. classe/função estruturada ou tags de classe normalizadas;
3. organização formal;
4. tags livres;
5. texto livre.

O filtro de classe não deve confundir `category: npc` com classe de personagem.
`category` responde “que tipo de entidade é”; classe responde “qual arquétipo,
profissão ou classe mecânica ela possui”.

## 9. Missions

Missions já possui um sistema mais maduro de relações do que fichas e encounters.

### 9.1. Relações disponíveis

Missões podem declarar:

- localizações exatas;
- regiões amplas;
- NPCs;
- guildas;
- arco pai;
- contratante;
- contato;
- posto SDA;
- dificuldade;
- status;
- escopo de cânone;
- estado de jogo.

### 9.2. Participação futura

Uma missão pode contribuir para “Disponível aqui” em uma fase futura se:

- estiver em `canon_scope: canon`;
- não estiver `archived`, `abandoned` ou concluída quando a pergunta for sobre
  oportunidades atuais;
- tiver relação explícita com o local;
- tiver status operacional compatível, como `available`, `planned` ou `active`;
- seeds e drafts só entrarem quando o DM solicitar explicitamente.

Uma missão concluída ainda pode aparecer como histórico relacionado ao local, mas
não como oportunidade atual. O Helper deve ter pelo menos os modos “oportunidades”
e “histórico/contexto”.

### 9.3. Não misturar fontes de continuidade

Preparação de sessão, nota de missão e histórico jogado são camadas diferentes.
O Helper não deve transformar a existência de uma sessão planejada em acontecimento.
`Campaign State.md`, `Story So Far.md` e `dm-notes/acontecimentos.md` merecem
tratamento especial se Missions for integrada.

## 10. Arquivamento e ciclo de vida

### 10.1. O que já existe

O vault usa:

- `status: archived` para missões e continuidades antigas;
- pastas como `M. Completas/`;
- sufixos `-draft.md`;
- `canon_scope: seed` ou `draft`;
- `status: completed` em sessões;
- `mechanical_status: draft_only` ou `mechanical_drift` em fichas;
- texto narrativo sobre morte, obsolescência ou substituição.

### 10.2. Recomendação

Separar:

- existência narrativa;
- disponibilidade operacional;
- estado de publicação/importação;
- conhecimento dos jogadores;
- status da história;
- estado da mecânica.

Uma criatura pode ser canônica e ter `mechanical_status: mechanical_drift`. Uma
missão pode ser canônica e arquivada. Um NPC pode estar morto na narrativa, mas a
ficha pode continuar sendo útil para histórico ou flashback.

O modo padrão de “Disponível aqui” deve excluir:

- `draft`;
- `seed`;
- `archived`;
- conteúdo explicitamente inativo;
- ficha sem relação local ou organizacional suficiente.

`dm_only`, segredo, rumor e `player_knowledge` não excluem conteúdo do Helper,
porque o Helper é uma ferramenta do mestre. Devem aparecer como badge ou filtro
visual, por exemplo `[DM ONLY]`, sem serem confundidos com conteúdo público para
os jogadores.

O modo “mostrar contexto histórico” pode incluir arquivados e concluídos, sempre com
badges claros.

## 11. “Disponível aqui”

### 11.1. Localização atual existente no Helper

O Helper já possui `CampaignContextService` com:

```text
currentLocation: { scopeType, scopeId } | null
```

O `CampaignWorldService` resolve:

- império;
- estado;
- settlement;
- breadcrumb;
- organizações relevantes por presenças globais, de império, estado e settlement.

O cálculo atual não indexa conteúdo. Ele apenas resolve o mundo e organizações.

POIs existem no mundo e podem ser pesquisados, mas não são aceitos atualmente como
`currentLocation`. Isso precisa ser uma decisão consciente, não uma extensão
silenciosa.

### 11.2. Camadas de resultado

O resultado de “Disponível aqui” deve separar pelo menos:

1. **Relação direta**
   - ficha ou conteúdo declara exatamente este settlement, estado ou POI;
   - exemplo: Maia Ferradura → Hotead.

2. **Relação herdada geográfica**
   - conteúdo declara o estado e a party está em uma settlement daquele estado;
   - exemplo: presença estadual de uma organização em Feng quando a party está em Hotead;
   - deve mostrar “herdado do estado”, não “local exato”.

3. **Relação organizacional**
   - organização possui presença aqui e conteúdo está ligado à organização;
   - não deve afirmar presença física individual sem relação adicional.

4. **Relação de acesso**
   - contato remoto, mural, contrato, mensageiro ou rota tornam conteúdo acessível;
   - não equivalem a uma sede ou ficha residente.

5. **Conteúdo regional compatível**
   - criaturas ou arquétipos possuem ocorrência em região, mas não necessariamente
     no settlement atual;
   - deve aparecer como “regional”, não como “aqui”.

6. **Conteúdo global**
   - organização ou conteúdo explicitamente global;
   - deve aparecer com escopo global e não ser duplicado em todas as localidades.

7. **Ambíguo ou inferido**
   - relação derivada de texto, pasta ou associação incompleta;
   - deve ser ocultável no modo padrão ou receber aviso de baixa confiança.

### 11.3. Exemplo Plomos

Com a localização atual:

```text
Mornk -> Plomos -> Plomos
```

O Helper poderia mostrar:

- Guardas C/B/A/S de Plomos, pela nota estadual e pela instituição Guarda de Mornk;
- Winterhold como presença de grande posto em Plomos;
- PDB como rede de dojos em Plomos;
- SDA como sede estadual em Plomos;
- MDA como rede certificada em Plomos;
- organizações locais de Plomos;
- criaturas cuja ocorrência explícita aponta para Plomos;
- NPCs com `state: Plomos` ou `location: Plomos`;
- encounters cujo local foi explicitamente salvo como Plomos.

O Helper não deve mostrar automaticamente:

- toda criatura de Mornk;
- toda ficha com tag `Plomos` sem saber se a tag é canônica;
- todos os membros da Winterhold em qualquer ponto do estado;
- uma criatura regional de outra settlement como se estivesse na cidade;
- seeds de Plomos no modo de oportunidades atuais.

### 11.4. Retorno recomendado

Cada item contextual deveria carregar semanticamente:

```text
content identity
content type
match kind: direct | inherited | organization | access | regional | global | ambiguous
match scope
organization relation, if any
location relation, if any
confidence
lifecycle status
canon scope
provenance
```

A UI pode agrupar por “Aqui”, “No estado”, “Organizações presentes”, “Regional”,
“Global” e “Ambíguo”, em vez de devolver uma lista plana sem explicação.

## 12. Casos reais

### 12.1. Guarda

`Bestiário/Guarda de Mornk/Caçador de Monstros A.md`

Classificação:

- tipo: ficha institucional/NPC;
- organização: Guarda de Mornk;
- escopo mecânico: arquétipo reutilizável em Mornk;
- localização direta: ausente na ficha;
- disponibilidade: obtida de cada `Guarda.md` estadual;
- status: canônico;
- resultado em Plomos: disponível como parte da resposta estadual de Plomos;
- resultado em Feng: não presumir apenas pela existência da ficha; consultar Feng `Guarda.md`.

### 12.2. NPC

`Mundo/Impérios/Mornk/7-Feng/NPCs/Maia Ferradura.md`

Classificação:

- tipo: NPC;
- estado: Feng;
- settlement: Hotead;
- função: horse_trainer;
- organização: rede equestre local, ainda não uma organização formal;
- relação PDB: ausência de filiação confirmada;
- em Hotead: relação direta;
- em Feng cidade: relação herdada do estado/settlement apenas se a UI aceitar NPCs
  relacionados ao estado, não como presença direta;
- em Plomos: não disponível localmente, salvo relação futura de transporte ou missão.

### 12.3. Criatura/homebrew regional

`Bestiário/Homebrew/Enamel Ooze.md`

Classificação:

- tipo: criatura homebrew;
- regiões: Feng, Dortx e Treuz;
- localizações: três headings específicos;
- status narrativo: canônico;
- encontro: planejado, não jogado;
- mecânica: divergente;
- em Feng: regional/local conforme o heading;
- em Plomos: não disponível, mesmo que Feng e Plomos estejam no mesmo império;
- em Treuz: disponível regionalmente, sem garantir qualquer settlement.

### 12.4. Guilda

`Guildas & Grupos/Profusos De Batalha (PDB).md` e
`Mundo/Impérios/Mornk/7-Feng/Guildas.md`

Classificação:

- organização global;
- presenças em estados e settlements diferentes;
- tipo de presença relevante: dojo, escola, posto, rede ou ausência;
- relação com Maia: não confirmada;
- relação com Hotead: proposta/ausência intencional, não presença automática;
- em Plomos: presença de dojos e rede;
- filtro de guilda: deve retornar a organização e seus conteúdos formalmente ligados,
  mas separar conteúdo local de conteúdo global da PDB.

### 12.5. Conteúdo genérico

`Bestiário/Guarda de Mornk/Patrulheiro de Contato C.md`

Classificação:

- arquétipo genérico institucional;
- sem settlement próprio;
- organização formal: Guarda de Mornk;
- localidades possíveis: definidas nas notas estaduais;
- filtro de classe/função: patrulha/resposta C;
- “Disponível aqui”: somente quando a composição da guarda local o inclui ou quando
  o DM escolhe o arquétipo como reforço plausível.

### 12.6. Missão

`Missions/Espantalho em Nagazav.md`

Classificação:

- tipo: mission_seed;
- status: idea;
- canon_scope: seed;
- local: sugestão de ambientação;
- contrato: SDA;
- no modo normal: não aparece como missão disponível;
- no modo “incluir seeds”: pode aparecer com badge de seed, sem ser tratada como
  acontecimento jogado.

## 13. Lacunas atuais

### 13.1. No Obsidian

Ainda faltam padrões universais para:

- `organizationIds` em fichas;
- relação formal ficha ↔ organização;
- tipo da relação organizacional;
- disponibilidade versus associação;
- `presence_scope`;
- `presence_mode`;
- `certainty` e `provenance` de uma associação;
- `active`, `archived`, `dead` e `deprecated` para entidades;
- localização de encounters independentes;
- classificação tipada de tags;
- localização atual versus ocorrência ecológica;
- POI como escopo operacional;
- relacionamento de uma unidade da Guarda com vários estados;
- resolução confiável de links curtos e homônimos.

### 13.2. No Helper

O Helper atualmente não possui:

- CRUD de organizações para o usuário;
- catálogo de guildas/grupos com aliases;
- vinculação formal de fichas a organizações;
- filtros de organização em Homebrew Sheets;
- filtros de organização em Encounters;
- location refs em CreatureSheets;
- location refs em Encounters;
- disponibilidade contextual;
- índice de conteúdo por localização;
- distinção entre relação direta e herdada;
- suporte de POI como current location;
- ciclo de vida geral de fichas além de dados locais específicos;
- uma camada de proveniência de relações.

### 13.3. Limites de uma migração automática

Não é seguro migrar automaticamente todos os dados do Obsidian porque:

- tags não são tipadas;
- algumas fichas são canônicas e outras drafts com estrutura similar;
- `source` pode ser proveniência mecânica e não autoria narrativa;
- organizações aparecem em prosa com negações explícitas;
- folders misturam armazenamento, categoria e proximidade narrativa;
- uma nota regional pode mencionar uma organização para negar uma filiação;
- um NPC pode ter relações diferentes da localização da sua pasta;
- missions têm conteúdo jogado, planejado e seed no mesmo arco.

## 14. Metadata e arquitetura: V1 e direção futura

Esta seção preserva a direção arquitetural encontrada na auditoria, mas não transforma
todos os conceitos abaixo em requisitos desta task. A IA do Helper deve implementar
somente o bloco `Escopo aprovado da V1` mais adiante. Proveniência detalhada,
confiança, taxonomias completas e semântica avançada permanecem como direção futura.

Os nomes abaixo são semânticos, não nomes obrigatórios de interfaces TypeScript.

### 14.1. Registry de organizações

O Helper deve possuir uma lista persistida por workspace, preferencialmente a
coleção `campaignWorld.organizations` já existente.

Campos semânticos:

- ID estável;
- nome;
- aliases;
- tipo organizacional;
- organização pai;
- status de ciclo de vida;
- presenças;
- notas opcionais;
- fonte/proveniência detalhada somente no futuro.

O registry deve ter criação e edição na UI. Sem essa funcionalidade, o filtro de
guilda dependerá de strings livres e não será confiável.

### 14.2. Relações de conteúdo: V1 mínima

Na V1, CreatureSheets e Encounters precisam apenas de relações simples e opcionais:

- `locationRefs[]`;
- `organizationRefs[]`;
- `tags[]`;
- `archived` ou equivalente ativo/arquivado;
- `category` existente em CreatureSheets;
- classe/função somente se puder ser adicionada sem criar uma taxonomia nova.

Uma relação de localização V1 deve transportar apenas o necessário para resolver a
hierarquia do Campaign World:

```text
ContentLocationRelation
  location ref
  scope type: empire | state | settlement
  relation: base | occurrence | habitat | operation | regional | generic
```

```text
ContentOrganizationRelation
  organization id
  relation: member | leader | affiliated | institution | trained_by | associated
```

Não criar dezenas de tipos de relação na V1. O modelo pode ser ampliado depois.

### 14.3. Direção futura de relações e evidências

Os seguintes campos são úteis para uma arquitetura futura, mas não são obrigatórios
agora:

- `classOrRoleRefs[]` como catálogo tipado completo;
- `visibility` e `canonScope` como sistema de publicação;
- `availability` sofisticada;
- `confidence` e classificação de evidência;
- `provenance` detalhada, sourcePath e histórico de revisão;
- relações históricas, remotas, inimigas, contratantes ou inferidas;
- resolução automática de relações a partir de texto do Obsidian.

O objetivo futuro é explicar por que um item apareceu, mas a V1 pode fazer isso com
grupos simples como “Aqui”, “Estado/região”, “Organizações” e “Regional/amplo”.

### 14.4. Classes e tags

Na V1, manter compatibilidade com tags existentes e não bloquear a entrega esperando
um catálogo universal:

- tags livres, para pesquisa e filtros rápidos;
- organização por ID formal;
- localização por ID formal;
- classe/função opcional, somente se for simples.

Uma organização nunca deve depender exclusivamente de uma tag. Um filtro de classe
pode usar tags existentes como fallback. Um catálogo de tags classificadas fica para
o futuro.

### 14.5. Status e visibilidade

Não misturar:

- status operacional;
- escopo narrativo;
- estado mecânico;
- estado de encontro;
- conhecimento dos jogadores;
- disponibilidade no contexto atual.

O resultado de disponibilidade deve ser derivado dessas dimensões, mas não gravado
como verdade fixa se puder mudar com a localização atual.

Na V1, o único ciclo de vida operacional obrigatório é `active`/`archived`. O
conteúdo arquivado fica oculto por padrão, mas pode ser exibido pelos filtros
“Ativos”, “Arquivados” e “Todos”. Não derivar arquivamento, morte ou obsolescência
de texto do Obsidian.

`dm_only`, segredo, rumor e `player_knowledge` não devem esconder conteúdo do DM.
Na V1, podem aparecer como badge ou filtro visual, por exemplo `[DM ONLY]`.

### 14.6. Proveniência futura

Em uma versão futura, cada relação importada ou criada poderia indicar:

- fonte do Obsidian ou sourcePath;
- origem manual no Helper;
- tipo de evidência;
- data de importação/revisão;
- se veio de pasta, frontmatter, wikilink, nota de presença ou decisão manual.

Isso permite corrigir associações sem apagar a ficha mecânica.

## 15. UX e ordem de implementação da V1

A V1 deve ser pequena e útil durante uma sessão. A UI não deve expor ao mestre uma
planilha de `confidence`, `matchKind`, `provenance` e `scope` para cada item. Esses
conceitos podem existir internamente quando forem necessários, mas a apresentação
deve ser simples:

```text
DISPONÍVEL AQUI — Hotead

Aqui
- Maia Ferradura
- Guarda local

No estado de Feng
- criatura X

Organizações presentes
- Winterhold

Regional/amplo
- Enamel Ooze
```

### Task 0 - Estudo curto do código e contrato

Antes de editar o Helper, a IA deve estudar somente os pontos necessários para a V1:

- `campaign-world-model.ts`;
- `campaign-world-service.ts`;
- `campaign-context-service.ts`;
- `creature-sheet-model.ts`;
- `encounter-model.ts`;
- `battle-encounter-model.ts`;
- Homebrew Sheets;
- Encounter Hub e filtros existentes;
- workspace storage;
- `app-backup-service.ts`;
- migrações, import/export e testes.

Deve apresentar um plano curto, confirmar onde os dados ficam persistidos por
workspace e continuar para a implementação. Não transformar esta etapa em uma nova
auditoria do vault.

### Task 1 - Organizations CRUD

Implementar primeiro o registry de organizações, preferencialmente em
`campaignWorld.organizations` se o código confirmar que é o local correto.

Uma organização é uma identidade mundial única. Um posto, filial, academia, agente
ou contato local é uma presença dessa organização, não uma nova organização.

Critérios mínimos:

- criar organização;
- editar nome, aliases e tipo;
- organização pai opcional;
- arquivar/desativar;
- ID estável;
- isolamento entre workspaces;
- compatibilidade com campanhas que não sejam Mornk.

Não hardcodar Winterhold, PDB, Guarda de Mornk ou qualquer guilda específica.

### Task 2 - Organization Presence CRUD

Permitir cadastrar, editar e remover presenças de uma organização em:

- império;
- estado;
- settlement;
- escopo global quando aplicável.

Usar poucos tipos simples de presença, como sede, posto, filial, agente, contato
remoto ou rede. Não construir uma taxonomia extensa na V1.

A presença de uma organização não torna todos os seus membros disponíveis no local.

### Task 3 - Metadata contextual simples de CreatureSheet

Adicionar campos opcionais, sem alterar o stat block mecânico:

- `archived`/ativo;
- `locationRefs[]` usando IDs e hierarquia do Campaign World;
- `organizationRefs[]` por ID;
- tags existentes;
- category existente;
- classe/função apenas se puder ser suportada de forma simples.

Uma relação de localização deve distinguir no mínimo `empire`, `state` e `settlement`
e pode usar `base`, `occurrence`, `habitat`, `operation`, `regional` ou `generic`.
Uma relação organizacional deve usar uma lista pequena, como `member`, `leader`,
`affiliated`, `institution`, `trained_by` ou `associated`.

Fichas antigas sem os campos novos continuam válidas. `groups` e `tags` devem ser
usados como compatibilidade legada quando for seguro, sem exigir migração em massa.

### Task 4 - Filtros de CreatureSheets

Priorizar:

- texto;
- category;
- ativo/arquivado;
- império;
- estado;
- settlement;
- organização;
- tags;
- classe/função se a implementação for limpa.

Por padrão, mostrar ativos. Oferecer `Ativos`, `Arquivados` e `Todos`.

### Task 5 - Metadata contextual simples de Encounter

Adicionar ao Encounter apenas:

- `archived`/ativo;
- `locationRefs[]`;
- `organizationRefs[]`;
- tags.

Não misturar com `BattleEncounter` runtime. Preservar a cadeia:

```text
CreatureSheet -> Encounter snapshot -> BattleEncounter runtime
```

Encounters antigos sem metadata nova continuam válidos.

### Task 6 - Filtros de Encounters

Priorizar:

- texto;
- ativo/arquivado;
- império;
- estado;
- settlement;
- organização;
- tags.

Não criar nesta task um sistema universal de busca semântica.

### Task 7 - Context Resolver

Criar uma camada derivada para resolver a localização atual em:

```text
empire -> state -> settlement
```

Regras mínimas:

- relação direta com o settlement atual aparece em “Aqui”;
- relação apenas com o state aparece em “No estado/região”;
- relação apenas com o empire aparece como contexto mais amplo;
- relação com outro settlement do mesmo state não aparece como “Aqui”;
- organização presente no local aparece como organização presente, não como presença
  física automática de todos os membros;
- conteúdo genérico só aparece quando houver relação contextual que o torne aplicável.

POI pode permanecer fora de `currentLocation` na V1 se incluí-lo exigir refactor
grande. Não expandir o escopo por causa disso.

### Task 8 - “Disponível aqui”

Entregar uma primeira versão para CreatureSheets, Encounters e Organizations,
agrupada de forma simples em:

- Aqui;
- Estado/região;
- Organizações;
- Regional/amplo.

O modo padrão deve excluir drafts, seeds, arquivados e conteúdo explicitamente
inativo. `dm_only`, segredo, rumor e conhecimento do jogador não escondem conteúdo
do DM; aparecem como badge ou filtro visual, por exemplo `[DM ONLY]`.

### Task 9 - Backup, migration, workspace e regressions

Atualizar apenas o necessário para preservar:

- workspaces;
- Campaign World;
- Backup V2;
- CreatureSheets;
- Encounters;
- BattleEncounters e snapshots;
- filtros existentes;
- Bestiary;
- Spells;
- Calendar;
- import/export;
- sync;
- first-run limpo.

Executar os testes existentes e os testes novos antes de encerrar.

### Fora da ordem da V1

Missions não faz parte desta implementação. Não adicionar mission models, import,
filtros ou “Disponível aqui” para missões nesta task. A infraestrutura deve apenas
permitir uma integração futura.

## 16. Regras de compatibilidade e segurança

- Nenhuma organização de Mornk deve ser hardcoded no modelo.
- O Helper deve funcionar para outros workspaces e campanhas.
- IDs devem ser locais ao workspace e estáveis após edição do nome.
- Nome e alias não substituem ID.
- Referências quebradas devem ser preservadas e exibidas como warning, não apagadas.
- A migração deve ser incremental e reversível.
- Fichas e encounters antigos devem continuar válidos sem novas relações.
- `CreatureSheet` continua sem HP atual, condições ou runtime.
- `Encounter` continua sendo preparação; `BattleEncounter` continua sendo runtime.
- Backup V2 deve incluir novas seções formais se o contrato for alterado.
- Não duplicar a mesma informação em `rawLocalStorage` e seções formais.
- Toda nova chave deve ser isolada por workspace.
- A implementação deve ter testes de migração, backup, restauração e isolamento.
- A ausência de relação não deve ser tratada como relação global.
- Uma relação inferida deve ser distinguível de uma relação confirmada.

## 17. Pontos que a IA do Helper precisa decidir lendo o código

> [!note] Itens históricos superseded
> As perguntas abaixo preservam a auditoria original. A decisão semântica atual já
> está fechada no contrato permanente: `dnd/Guildas & Grupos/` é a fonte formal do
> registry; `organizationType` é descritivo e não exclui cultos ou famílias formais;
> entradas apenas locais permanecem contexto ou POI. Não reabra essas decisões ao
> executar uma task técnica.

Antes de implementar, a IA deve responder no repositório:

1. `campaign-world.organizations` é o local correto para o registry ou é necessário
   um registry contextual separado?
2. O modelo atual aceita POI como localização contextual sem quebrar
   `currentLocation`?
3. O tipo de organização atual é uma string descritiva; tipos adicionais só precisam
   de decisão quando uma nova entidade formal for revisada.
4. Como preservar IDs e aliases em múltiplos workspaces?
5. Quais componentes de formulário e serviços de storage já devem ser reutilizados?
6. Como os novos campos entram em `AppBackup`, migração e segurança de restauração?
7. Como um usuário cria uma guilda antes de conseguir filtrá-la?
8. Deve existir criação inline de organização durante a edição da ficha?
9. Como diferenciar classe de personagem, classe de criatura, papel institucional e
   tag livre?
10. Como representar conteúdo global sem copiar referências para todas as localidades?
11. Como exibir conteúdo herdado de estado quando a party está em uma settlement?
12. Como evitar que uma organização presente em um settlement torne todos os seus
    membros disponíveis ali?
13. Como manter os snapshots de encounter/battle imutáveis após editar relações da
    ficha-base?
14. Que estratégia de migração será usada para fichas antigas que só possuem tags?
15. Como testar a resolução com Plomos, Hotead, Feng e uma campanha que não seja Mornk?

## 18. Escopo aprovado da V1

Esta seção é a autoridade de escopo para a task. O restante do documento preserva a
auditoria e possibilidades futuras, mas a IA do Helper **não deve implementar tudo o
que foi estudado**.

### Implementar agora

1. Organizations CRUD no `Campaign World`.
2. Organization Presence CRUD.
3. Metadata contextual simples em CreatureSheets.
4. Metadata contextual simples em Encounters.
5. Estado operacional `active`/`archived`.
6. Filtros de texto, categoria, status, localização, organização e tags.
7. Classe/função somente se puder ser adicionada sem catálogo complexo.
8. Context resolver para império, estado e settlement.
9. “Disponível aqui” para CreatureSheets, Encounters e Organizations.
10. Backup, migration, isolamento por workspace e testes.

### Não implementar agora

- Missions, mission models, mission import e mission filters;
- importação em massa do Bestiário, NPCs, Guardas ou Guildas do Obsidian;
- provenance detalhada;
- confidence engine ou classificação de evidência;
- inferência automática profunda a partir do Obsidian;
- catálogo universal de tags tipadas;
- sistema separado de visibilidade para jogadores;
- regras complexas de availability;
- semântica histórica avançada;
- POI como `currentLocation` se isso exigir um refactor grande;
- dashboard grande ou busca semântica universal.

### Futuro

Podem permanecer documentados para evolução posterior:

- provenance e confidence detalhadas;
- relações históricas, remotas, inimigas e contratantes;
- player knowledge mais complexo;
- integração automática profunda com Obsidian;
- catálogo completo de classes, funções e tags;
- Missions integrada ao contexto;
- resolução automática de inferências;
- POI como escopo contextual completo;
- modos históricos e availability avançada.

### Regras obrigatórias da V1

- O DND Helper é uma ferramenta do mestre. `dm_only`, segredo, rumor e
  `player_knowledge` não escondem conteúdo relevante do DM; use badges e filtros
  visuais.
- Uma organização mundial existe uma vez. Posto, filial, academia, agente ou
  contato são presenças locais vinculadas a ela, não novas organizações.
- Organização presente em um local não significa que todos os membros estão lá.
- CreatureSheets e Encounters antigos continuam válidos sem metadata nova.
- A ficha reutilizável da Guarda de Mornk continua separada da composição local de
  cada estado. Esse é um caso principal de teste.
- Não importar conteúdo do vault nesta task. Os casos do vault são fixtures e testes
  conceituais, não um lote de migração.

## 19. Prompt de implementação para a Luna do dnd-dm-helper

Você é a Luna responsável por implementar uma evolução no repositório
`dnd-dm-helper`.

> [!important] Escopo obrigatório
> Este handoff contém uma arquitetura futura rica. **Não implemente tudo o que foi
> estudado.** Implemente somente a V1 aprovada acima. Não pare no planejamento:
> apresente um plano curto, implemente, execute os testes e corrija os problemas
> encontrados.

### Objetivo da V1

Entregar filtros contextuais úteis para qualquer workspace/campanha, começando por:

```text
Organizations -> CreatureSheets -> Encounters -> Filters -> Disponível aqui
```

Não trate Mornk, Winterhold, Plomos, Feng, PDB ou Guarda de Mornk como dados
hardcoded. Eles são exemplos e fixtures conceituais.

### Organizations e presenças

Estude o código e use preferencialmente `campaignWorld.organizations` como registry.
Se outro local for realmente necessário, explique a decisão e sua relação com
`campaign-world.organizations`.

O Helper já possui parte desse fluxo na página World. Reaproveite e complete o que
existe; não crie um segundo registry paralelo apenas para os filtros.

Uma organização é uma identidade mundial única. Por exemplo:

```text
Winterhold = organização mundial
Instituto Winterhold de Plomos = POI/presença local de Winterhold
Posto da Winterhold em Dortx = outra presença local de Winterhold
```

Não criar uma nova organização para cada posto, filial, academia, agente ou contato.

Implementar na V1:

- criar, editar, arquivar/desativar e listar organizações;
- nome, aliases, tipo, organização pai opcional e ID estável;
- criar, editar e remover presenças em império, estado, settlement e global;
- tipos simples de presença, como sede, posto, filial, agente, contato remoto ou rede;
- referências por ID entre organizações e CreatureSheets/Encounters;
- filtro por organização sem depender somente de tags.

Organização presente em Plomos não significa que todos os NPCs relacionados a ela
estão em Plomos.

### Metadata mínima

Adicionar somente campos opcionais compatíveis:

- CreatureSheet: `archived`, `locationRefs[]`, `organizationRefs[]`, tags e category
  existentes;
- Encounter: `archived`, `locationRefs[]`, `organizationRefs[]` e tags;
- localização por ID/hierarquia de império, estado e settlement;
- relação simples como `base`, `occurrence`, `habitat`, `operation`, `regional`,
  `generic`, `member`, `leader`, `affiliated`, `institution`, `trained_by` ou
  `associated`.

Não implementar agora confidence, provenance detalhada, taxonomia completa de tags,
availability sofisticada, inferência automática do Obsidian ou Missions.

### “Disponível aqui”

Use a localização atual já existente e resolva apenas:

```text
empire -> state -> settlement
```

Regras:

- relação direta com o settlement atual: grupo “Aqui”;
- relação somente com o state: grupo “Estado/região”;
- relação somente com o empire: contexto mais amplo;
- relação com outro settlement do mesmo state: não chamar de “Aqui”;
- organização presente: grupo “Organizações”, sem inventar presença física individual;
- conteúdo genérico: só mostrar quando houver relação contextual aplicável;
- arquivado: oculto por padrão, com filtros `Ativos`, `Arquivados` e `Todos`;
- `dm_only`, segredo, rumor e `player_knowledge`: manter visível para o DM com badge
  ou filtro visual, nunca ocultar automaticamente.

A UI deve ser simples. Não exibir ao mestre um painel burocrático de confidence,
match kind e provenance. Agrupe conceitualmente em “Aqui”, “Estado/região”,
“Organizações” e “Regional/amplo”.

### Guardas como caso de teste

`Patrulheiro de Contato C` deve continuar sendo uma ficha reutilizável ligada à
Guarda de Mornk. A disponibilidade em Plomos, Feng ou Dortx deve vir da composição
ou presença da Guarda naquele estado, sem duplicar a ficha por local.

### Compatibilidade

Preserve:

- workspaces e first-run limpo;
- Campaign World e validador;
- Backup V2;
- CreatureSheet e Homebrew Sheets;
- Encounter e Encounter Hub;
- BattleEncounter e snapshots;
- Bestiary, Spells e Calendar;
- import/export, sync e filtros existentes.

Fichas e encounters antigos sem metadata nova devem continuar abrindo. Não importar
conteúdo do vault nesta task. Não alterar o vault, Campaign State ou Story So Far.
Não implementar Mission models, Mission import, Mission filters ou Missions em
“Disponível aqui”.

### Ordem obrigatória

1. Estudar o código atual e apresentar plano curto de contrato/migração.
2. Implementar Organizations CRUD.
3. Implementar Organization Presence CRUD.
4. Implementar metadata contextual de CreatureSheet.
5. Implementar filtros de CreatureSheets.
6. Implementar metadata contextual de Encounter.
7. Implementar filtros de Encounters.
8. Implementar Context Resolver.
9. Implementar “Disponível aqui”.
10. Atualizar backup/migration/workspace e executar testes/regressions.

Não parar depois do item 1.

### Testes mínimos

Inclua testes para:

- criação, edição, aliases, IDs estáveis e arquivamento de organizações;
- presenças globais, de império, estado e settlement;
- Winterhold mundial com postos locais sem duplicar a organização;
- isolamento entre workspaces;
- fallback de fichas antigas com tags/groups;
- ficha com várias localizações;
- relação organizacional sem disponibilidade física do membro;
- relação direta, herdada do estado e outro settlement não tratado como “Aqui”;
- Guarda genérica com composição estadual;
- filtros de CreatureSheet e Encounter;
- ativo/arquivado e `dm_only` visível para o DM;
- encounters antigos sem metadata;
- snapshot de Encounter/Battle independente da ficha-base;
- backup, restauração, migração e first-run limpo.

### Restrições finais

- Não implementar Missions nesta task.
- Não importar Bestiário, NPCs, Guardas, Guildas ou outras notas do vault.
- Não hardcodar organizações de Mornk.
- Não alterar o vault canônico.
- Não usar pasta ou `tags.includes(location)` como fonte única de localização.
- Não transformar presença organizacional em presença física de todos os membros.
- Não criar uma taxonomia complexa para resolver casos futuros.
- Não quebrar o isolamento de workspace, Backup V2 ou snapshots.

## 20. Conclusão

O Obsidian já contém dados suficientes para justificar uma infraestrutura contextual,
mas não para uma migração automática total. A prioridade correta é criar primeiro a
identidade e o cadastro de organizações, porque filtros de guilda dependem de uma
lista canônica, IDs estáveis, aliases e presenças.

Tags podem continuar alimentando filtros de classe, função e pesquisa, mas relações
de guilda, localização e disponibilidade precisam ser formais ou claramente
classificadas como inferidas.

A primeira versão útil do Helper deve organizar fichas e encounters, explicar por que
um item apareceu em “Disponível aqui” e preservar a diferença entre associação,
presença, acesso, disponibilidade e encontro. Missions pode entrar depois usando o
schema já mais maduro de `locations`, `regions`, `guilds`, `status` e `canon_scope`.
