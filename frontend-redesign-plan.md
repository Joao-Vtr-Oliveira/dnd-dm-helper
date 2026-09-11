# Plano de Redesign do Frontend

## Status

Fases 0, 1, 2, 3, 4, 5, 6 e 7 concluidas e aprovadas. A Fase 8 esta concluida e aguarda revisao visual. As Fases 9 e 10 estao concluidas e aguardam revisao visual operacional.

Padrao aprovado: interface dark operacional, violeta intencional, densidade sem excesso de cards,
acoes hierarquizadas, responsividade real e preservacao rigorosa da logica.

## Regras de execucao

1. Executar somente uma fase por vez.
2. Ao fim de cada fase, parar para revisao e aprovacao explicita antes de iniciar a proxima.
3. Preservar regras de negocio, persistencia, rotas e fluxos operacionais.
4. Antes de redesenhar uma pagina, inventariar suas acoes, estados, modais, formularios, dependencias e comportamento mobile.
5. Ao fim de cada fase, rodar:
   - `npm test -- --watch=false --browsers=ChromeHeadless`
   - `npm run build`
   - validators relevantes para a area alterada
6. Validar visualmente em aproximadamente 360px, 768px e desktop amplo.
7. Nao redesenhar a composicao principal da pagina Mundo sem uma fase aprovada especificamente para isso.
8. Antes de qualquer alteracao no Battle Tracker, criar e aprovar um subplano proprio.

## Objetivo

Manter a identidade dark, violeta e compativel com RPG do aplicativo, mas amadurecer a interface para parecer uma ferramenta operacional de Mestre de RPG desenhada como um produto unico.

O redesign deve reduzir monocromia, cards aninhados, bordas e raios excessivos, sem reduzir densidade operacional ou remover funcionalidades.

## Diagnostico

### Preservar

- Tema escuro e atmosfera de RPG sem decoracao tematica clichet.
- Violeta como identidade, foco, navegacao ativa e acao primaria.
- Ambar para turno e pendencias temporais.
- Vermelho para perigo e acoes destrutivas.
- Cores semanticas existentes de jogadores, inimigos e estados quando fizerem sentido.
- `dndFont` restrita ao wordmark.
- A composicao mais aberta, com breadcrumbs, divisores e listas da pagina Mundo.

### Problemas atuais

- Superficies roxas sobre roxas e muito uso de `bg-white/*`, `bg-black/*` e cores arbitrarias locais.
- Uso recorrente de `rounded-2xl`, `rounded-3xl`, bordas e sombras para informacoes que poderiam usar tipografia ou divisores.
- Sidebar composta por grupos em cards e itens com caixas proprias.
- Acoes principais e secundarias com peso visual semelhante.
- Raios, espacamentos, sombras e superficies sem uma escala semantica unica.
- Modais visualmente parecidos, mas sem contrato comum de acessibilidade e comportamento.
- Battle Tracker, Encounter Builder e 5etools possuem maior profundidade de superficies aninhadas.

## Inventario de Rotas

| Rota | Pagina | Funcao | Complexidade | Risco visual |
| --- | --- | --- | --- | --- |
| `/` | Redirect | Redireciona para criacao de encounter | Baixa | Baixo |
| `/home` | Home + Encounter Hub | Shell e dashboard de encounters/batalhas | Alta | Alto |
| `/home/world` | WorldPage | Mundo, POIs e posicao da party | Media | Medio |
| `/home/encounter-builder` | EncounterBuilder | Criar encounter | Muito alta | Muito alto |
| `/home/encounter-builder/:id` | EncounterBuilder | Editar encounter | Muito alta | Muito alto |
| `/home/battle-tracker/:battleId` | BattleTrackerPage | Cockpit de batalha | Muito alta | Maximo |
| `/home/homebrew` | HomebrewSheets | Biblioteca de fichas internas | Media-alta | Medio |
| `/home/homebrew-builder` | HomebrewBuilder | Criar ficha | Media-alta | Alto |
| `/home/homebrew-builder/:id` | HomebrewBuilder | Editar ficha | Media-alta | Alto |
| `/home/5etools-homebrew` | FiveEToolsHomebrewPage | Biblioteca, editor e sync 5etools | Muito alta | Maximo |
| `/home/calendar` | Calendar | Calendario e relogio do mundo | Media | Medio |
| `/**` | Redirect | Redireciona para dashboard | Baixa | Baixo |

Componentes ativos fora de rotas proprias:

- `CampaignClock`, montado pelo shell e oculto visualmente no calendario.
- Componentes locais de 5etools: filtros, summaries, cards de entidade, preview, tag helper e pickers de referencia.

## Shell Atual

- `Home` e o shell de todas as rotas em `/home/*`.
- O header e uma grande superficie arredondada independente da sidebar.
- A sidebar desktop e sticky, possui 20 a 22 rem de largura e grupos em cards.
- A navegacao mobile repete toda a arquitetura acima do conteudo como grupos em cards.
- Sync e exportacao aparecem no header desktop e na area Dados da navegacao.
- `CampaignClock` fica fixo no canto inferior direito e usa modal proprio.
- A restauracao remota cria backup de seguranca, mostra preview e recarrega a aplicacao; esse fluxo deve ser preservado.

Arquivos centrais:

- `src/styles.css`
- `src/app/pages/home/home.ts`
- `src/app/pages/home/home.html`
- `src/app/components/campaign-clock/campaign-clock.ts`
- `src/app/components/campaign-clock/campaign-clock.html`

## Sistema Visual Proposto

### Tokens

Usar `src/styles.css` como fonte unica de verdade com `@theme` do Tailwind v4. Nao criar `tailwind.config` nem um design system Angular grande.

Tokens minimos:

- `canvas`, `surface`, `surface-raised`, `inset`
- `border`, `divider`
- `text`, `muted`, `subtle`
- `primary`, `primary-hover`, `primary-muted`
- `accent`, `accent-hover`, `accent-muted`
- `success`, `warning`, `danger`, `info`

As superficies devem ser grafite quase preto com subtom violeta. Violeta deve ficar reservada a selecao, CTA, foco e identidade. Esmeralda deve significar sucesso, pronto, aplicado ou acao operacional positiva.

### Tipografia

- Titulo de pagina sem container obrigatorio.
- Titulo de secao com contraste moderado.
- Titulo de entidade acima de metadata, abaixo de titulo de pagina.
- Metadata preferencialmente agrupada em linha ou grid leve.
- Uppercase pequeno apenas para orientacao, grupos de navegacao e labels compactos.

### Superficies, bordas e raio

- Superficie elevada somente para objeto persistente, tarefa importante, cockpit ou modal.
- Conteudo subordinado deve usar spacing, alinhamento e divisores antes de ganhar um card.
- Controle: raio medio.
- Card de objeto ou tarefa: raio maior.
- Shell e modal: raio mais amplo.
- Badge: pill.
- Remover progressivamente valores arbitrarios concorrentes de raio sem fazer substituicao global massiva.

### Botoes, campos e status

- Variantes: primario, secundario, ghost, perigo e contextual/esmeralda.
- Uma acao primaria por contexto.
- Inputs, selects e textareas com altura, fundo, borda, foco, erro e disabled consistentes.
- Status usam cor semantica e texto/icone; cor nao sera o unico indicador.

### Modais e alertas

- Todo modal novo ou redesenhado usa superficie elevada, backdrop, `role="dialog"`, titulo associado,
  fechamento visivel com `app-modal-close` e `Escape`.
- Confirmacoes destrutivas usam variante vermelha, contexto de irreversibilidade e acao primaria explicita.
- Notificacoes temporarias usam `app-toast`: icone semantico, titulo de estado, mensagem, fechamento e
  `role="status"` com `aria-live="polite"`.
- As receitas de modal e alerta sao obrigatorias em toda pagina redesenhada; telas legadas sao migradas quando
  entrarem em sua fase, sem refatoracao visual global fora do escopo aprovado.

## Reuso Planejado

| Receita ou componente | Motivo | Onde usar |
| --- | --- | --- |
| Tokens e receitas CSS `app-*` | Padronizar sem criar componentes artificiais | Todas as fases |
| Receita de botao | Hierarquia e estados repetidos | Shell, hubs, builders e modais |
| Receita de campo | Formularios e buscas recorrentes | Hub, builders, calendario e 5etools |
| Receita de status | Estados recorrentes | Hub, Battle Tracker, fichas e 5etools |
| Receita de modal | Backdrop, superficie e acoes repetidos | Migracao incremental por familia de modal |
| Receita de alerta | Feedback temporario semantico e escaneavel | Todas as paginas migradas |
| Receita de header de pagina/secao | Titulos, descricao e toolbar recorrentes | Paginas alteradas em fases futuras |

Nao criar inicialmente `Card`, `CardHeader`, `CardBody`, `CardFooter` ou variacoes semelhantes.

## Fases

### Fase 0 - Auditoria e Plano

Status: concluida.

Resultado:

- Rotas, shell, estilos globais, paginas, modais e areas de maior risco foram mapeados.
- A pagina Mundo foi definida como referencia de maturidade visual, nao como template universal.

### Fase 1 - Foundation, Header, Shell e Sidebar

Status: concluida e aprovada.

Objetivo:

- Definir tokens, superficies, tipografia, divisores, raio, botoes, campos e status.
- Redesenhar header, sidebar desktop, navegacao mobile e CampaignClock sem redesenhar paginas internas.

Arquivos provaveis:

- `src/styles.css`
- `src/app/pages/home/home.html`
- `src/app/pages/home/home.ts`
- `src/app/pages/home/home.spec.ts`
- `src/app/components/campaign-clock/campaign-clock.html`
- `src/app/components/campaign-clock/campaign-clock.spec.ts`

Direcao da sidebar:

- Area de navegacao continua e mais estreita, sem card por grupo.
- Grupos definidos por label e espacamento.
- Links leves, sem poço de icone permanente.
- Item ativo com faixa lateral e wash violeta discreto.
- Area Dados continua acessivel, mas sem competir com navegacao.
- Manter sticky scroll, `routerLinkActive`, grupos, rotas e acoes.

Direcao do header e mobile:

- Header mais leve e integrado ao shell.
- Manter wordmark, atalho para dashboard, sync e exportacao.
- Eliminar duplicacao visual de sync/export entre header e sidebar, sem remover os fluxos.
- Navegacao mobile mais plana e compacta, sem pilha de grupos em cards.
- Preservar teclado, alvo de toque, links e acoes.

Fora do escopo:

- Composicao das paginas internas.
- Services, models, regras de negocio e persistencia.
- Mudanca do redirect inicial `/`.
- Refatoracao global de comportamento de modais.

Preservar:

- Backup remoto, preview, confirmacao, backup de seguranca e reload.
- Exportacao completa.
- Comportamento do CampaignClock, calendario condicional e posicao fixa do widget.
- Layout responsivo e scroll da sidebar.

Testes:

- `home.spec.ts`
- `campaign-clock.spec.ts`
- suite completa
- build
- revisao manual em 360px, 768px e desktop amplo

### Fase 2 - Dashboard / Encounter Hub

Status: concluida e aprovada.

Objetivo: reduzir nested cards e definir hierarquia entre continuar/iniciar batalha, acoes secundarias e acoes destrutivas.

Preservar: busca, filtros, sort, grupos, batalhas preparadas/ativas/pausadas/concluidas, setup, tie-breakers, import/export, duplicacao, exclusao e confirmacoes.

Risco e testes: manter setup de batalha e relacoes encounter/batalha; atualizar e executar `encounter-hub.spec.ts`, suite completa e build.

### Fase 3 - Biblioteca de Fichas

Status: concluida e aprovada.

Objetivo: transformar a area em biblioteca escaneavel, com acoes de ficha hierarquizadas e metadata mais densa.

Preservar: busca, filtros, tags, fontes, import preview, conflitos, exportacao, duplicacao, exclusao e conversao para 5etools.

Risco e testes: preservar escolhas de conflito e IDs externos; executar `homebrew-sheets.spec.ts`, suite completa e build.

### Fase 4 - Homebrew Builder

Status: concluida e aprovada.

Objetivo: estabelecer padrao de editor com sections, fieldsets visuais, divisores e acoes de salvamento claras.

Preservar: carregamento por rota, sincronizacao titulo/nome, stats, spells, slots, habilidades, recarga e retorno para biblioteca.

Risco e testes: comportamentos automaticos de nome e HP precisam permanecer claros; executar `homebrew-builder.spec.ts`, suite completa e build.

### Fase 5 - Encounter Builder

Status: concluida e aprovada.

Objetivo: aplicar padrao de editor no fluxo mais complexo antes do Battle Tracker.

Preservar: drafts, imports internos/API/legado/5etools, quantidade, criaturas, traps, lair actions, notas, spells, habilidades, save e save/start battle.

Risco e testes: alto risco de regressao de importacao e persistencia; executar `encounter-builder.spec.ts`, suite completa, build e validacao manual dos imports.

### Fase 6 - Calendario

Status: concluida e aprovada.

Objetivo: manter a personalidade tematica do mundo, priorizando leitura de data, tempo, eventos e controles frequentes.

Preservar: data, hora, estacao, navegacao, reset, eventos, fases da lua e ocultacao do CampaignClock nesta rota.

Risco e testes: mudancas diretas no relogio do mundo; reset de data/hora exige confirmacao. Executar `calendar.spec.ts`, `campaign-clock.spec.ts`, suite completa e build.

### Fase 7 - 5etools Browse

Status: concluida e aprovada.

Objetivo: melhorar densidade, filtros, cards de entidade, preview e hierarquia de acoes sem tocar ainda nos editores profundos.

Preservar: busca, filtros, tabs, preview, criar, duplicar, exportar, remover, templates, grupos lendarios e navegacao para Encounter Builder.

Risco e testes: manter handoffs e filtros; executar `fiveetools-homebrew.spec.ts`, suite completa, build e revisao manual.

### Fase 8 - 5etools Editors e Modais

Status: concluida, aguardando aprovacao visual.

Objetivo: reduzir profundidade visual dos editores e modais sem perder suporte ao formato real do 5etools.

Preservar: JSON fallback, estruturas desconhecidas, referencias, tags, import/merge, conflitos, sync, avisos, backups e metadata de source.

Risco e testes: risco maximo de compatibilidade de dados; executar validacoes manuais de import/export/sync, suite completa e build.

### Fase 9 - Subplano do Battle Tracker

Status: concluida e aprovada.

Resultado: acoes inventariadas e classificadas como criticas, frequentes ou secundarias. A composicao aprovada definiu cockpit de turno, iniciativa compacta, inspector contextual, pendencias, recursos, eventos, undo e modais acessiveis.

### Fase 10 - Battle Tracker

Status: concluida, aguardando revisao visual operacional.

Objetivo: reduzir niveis de superficie sem reduzir informacao, rapidez ou redundancia util durante a mesa.

Preservar: turno, round, timer, HP, temp HP, dano/cura, condicoes, concentracao, death saves, recarga manual, pendencias, undo, eventos, initiative, recursos, notas, pause/resume/complete e modais.

Risco e testes: risco funcional maximo; executar `battle-tracker.spec.ts`, suite completa, build e revisao manual de batalha em desktop e mobile.

### Fase 11 - Polimento Cross-app

Objetivo: consolidar tokens, responsividade, modais, toasts, estados vazios e inconsistencias restantes.

Preservar: todos os fluxos ja aprovados e a composicao principal de Mundo.

Testes: suite completa, build, validators aplicaveis e matriz visual completa.

## Ordem Recomendada

Foundation e shell primeiro validam a linguagem em todo o aplicativo. O Hub valida hierarquia de acoes. Biblioteca e Homebrew Builder validam catalogo e editor em menor risco antes de Encounter Builder. Calendario recebe identidade propria apos a foundation. 5etools e dividido entre browse e editor por risco de dados. Battle Tracker fica por ultimo e exige aprovacao separada. O polimento final corrige apenas inconsistencias remanescentes.

## Riscos e Mitigacoes

| Risco | Mitigacao |
| --- | --- |
| Tokens globais afetarem telas nao redesenhadas | Usar receitas opt-in e migrar por fase |
| Contraste insuficiente | Validar texto, bordas, disabled e focus-visible em todos os breakpoints |
| Tailwind local continuar divergente | Migracao gradual, sem substituicao global cega |
| Navegacao mobile perder acessibilidade | Manter links reais, foco, teclado e alvos de toque adequados |
| Modal quebrar fluxo especifico | Migrar comportamento por familia de modal, nao em massa |
| Clock sobrepor conteudo ou modais | Preservar e revisar hierarquia de `z-index` |
| Sync parecer uma acao simples | Manter preview, backup de seguranca e confirmacao |
| 5etools perder dados desconhecidos | Nao tocar serializacao ou JSON fallback sem testes especificos |
| Battle Tracker perder velocidade | Subplano, fases finas e revisao operacional antes de qualquer codigo |
| Redirect inicial conflitar com Dashboard | Nao alterar sem decisao explicita de produto |

## Criterios Globais de Sucesso

- Funcionalidades, dados e persistencia preservados.
- Sem nested cards desnecessarios.
- Superficies neutras e contraste alem de violeta.
- Violeta, esmeralda, ambar e vermelho com significado semantico.
- Sidebar percebida como navegacao, nao como colecao de cards.
- Header, sidebar, conteudo e clock percebidos como um produto unico.
- Acoes principais evidentes e acoes secundarias discretas.
- Mundo continua sendo uma referencia visual positiva.
- Battle Tracker continua rapido e operacional.
- Desktop, tablet e mobile funcionam.
- Testes, build e validators relevantes passam ao fim de cada fase.
