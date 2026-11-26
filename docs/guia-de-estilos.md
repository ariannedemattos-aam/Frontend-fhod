# Guia de estilos e reconstrução no Figma

A implementação usa a paleta hospitalar existente. Os tokens foram extraídos de `src/styles.css`; valores por estado podem ser conferidos no código. As PNGs do pacote são referências da versão publicada. SVGs de ícones e diagramas são reutilizáveis; o protótipo editável ainda deve ser montado no Figma.

| Elemento | Valor ou comportamento de implementação |
| --- | --- |
| Paleta principal | Azul `#175A85`, azul escuro `#123B56`, azul claro `#EAF4FA`, verde `#23845B`. |
| Texto e superfícies | Texto `#344054`, auxiliar `#526174`, linhas `#D9E2E8`, fundo `#F4F6F8`, superfícies brancas. |
| Erros e foco | Erro `#9E271D` sobre `#FFF1F0` e foco geral de 3 px em `#F1B434`. Na pesquisa, foco azul de 3 px. Status inclui palavras e, quando pertinente, contadores. |
| Tipografia | Pilha Inter, Segoe UI, Arial, sans-serif, com fallback local. Linha base 1,5. Título público de 1,7 a 2,5 rem, lead 1,13 rem e linha 1,6. Labels com peso 650, marca 800 e botões 700. |
| Grid público e administrativo | Container público até 760 px e laterais adaptativas. Desktop usa sidebar de 240 px e conteúdo até 1400 px. Cards de indicadores usam `repeat(auto-fit,minmax(180px,1fr))`, gap de 16 px. |
| Cartões | Fundo branco, linha 1 px, raio 16 px, padding 24 px, sombra `0 4px 14px #123b5610`. Cards de métricas usam raio 14 px. |
| Campos | Layout de label em grid com gap 7 px. Altura mínima 45 px, padding 10 px e raio 8 px. Campos inválidos ganham borda semântica e mensagem associada quando disponível. |
| Botões | Primário preenchido, secundário contornado, 52 px mínimos na base, padding 12 × 20 px, raio 10 px. Radio cards e opções públicas têm área de toque própria. |
| Tabelas | Células da base com padding 14 px, separadores de 1 px, região rolável rotulada e navegação de paginação. |
| Menus e navegação | Sidebar azul escura e rota corrente em branco. Menu pode quebrar em linhas no móvel. Link “Ir ao conteúdo” aparece quando focado. |
| Modais/confirmações | A aplicação usa painéis de confirmação, abertura de contato sob demanda e diálogo nativo para desistência. Preserve foco e retorno à ação de origem quando reproduzir. |
| Gráficos | Barras semânticas `progress`, texto de valor, legenda do grupo e escala explícita. Agregados de equipe insuficientes exibem “Sem nota”. |
| Ícones | Lucide React com `aria-hidden` quando o texto já dá o nome; ícones de ação têm rótulo acessível. Ativos vetoriais reutilizáveis no pacote acadêmico. |
| Estados | Hover muda borda ou superfície. Foco é destacado mesmo sem mouse. Desabilitado usa opacidade 0,64 e cursor próprio. Carregamento, vazio e falha usam texto. |
| Quebras | Até 700 px, controles públicos passam a coluna ou grid reduzido e shell administrativo passa a uma coluna. Até 420 px há ajuste de botões de tabela e padding do conteúdo. |

## Frames e relações

| Grupo | Frames representativos | Componentes e estados |
| --- | --- | --- |
| Paciente | 390 × 844 e 820 × 1024 | Início → setor/serviço/turno → etapas → perguntas → feedback → retorno → nota → confirmação. Adicione variação de QR direto, convite usado/expirado, sem pergunta elegível, nota vazia, envio, falha e desistência. |
| Gestão | 1280 × 900, também 390 e 820 px | Login, shell protegido, dashboard, escalas, avaliações, feedbacks, perguntas, cadastros, retornos, convites, notificações e relatórios. Crie variantes de permissão, carregamento e lista vazia. |
| Ouvidoria | 1280 × 900 | Filtros e fila, detalhes, histórico, registro de providência e retorno. Contato aparece apenas após ação protegida. |
| TV | 1920 × 1080 | Cabeçalho, métrica grande, grupos e estado de volume insuficiente. |
| Swagger | 1280 × 900 | Interface externa ao tema de aplicação. Use captura técnica como referência, mantendo componentes Swagger. |

1. Importe tokens em uma coleção e crie componentes para campo, seletor de nota, botão, card, linha de tabela, filtro e aviso.
2. Modele variantes de foco, seleção, desabilitado e erro. Aplique auto layout com quebras de linha no menu e áreas de toque conforme o CSS.
3. Use o [índice de capturas](capturas/) e os [diagramas](https://github.com/ariannedemattos-aam/backend-sah/tree/main/docs/diagramas) para conectar telas, preencher estados e preservar ordem.
4. Use as capturas como referência visual. Um arquivo de Figma editável depende de montagem posterior e autorização da conta proprietária.
