# Arquitetura do Mind Arena

O **Mind Arena** foi arquitetado seguindo o modelo de *Single Page Application (SPA)* comunicando-se com uma API Restful e WebSockets para tempo real.

## Diagrama Lógico

```text
+-------------------+       REST / WebSocket       +---------------------+
|                   |  <------------------------>  |                     |
|  Frontend (React) |                              | Backend (Spring)    |
|                   |                              |                     |
+-------------------+                              +---------------------+
          |                                                   |
          | Renderiza UI e gerencia                           | Gerencia estado central da partida
          | estado local (Vite/TS)                            | JPA / Hibernate
          |                                                   |
                                                     +---------------------+
                                                     |                     |
                                                     | PostgreSQL (DB)     |
                                                     |                     |
                                                     +---------------------+
```

## 1. Frontend
- **React + Vite:** Escolhido por ser rápido, focado em performance de build e possuir ecossistema rico.
- **Tailwind CSS:** Para estilização rápida e responsiva sem a necessidade de criar grandes arquivos CSS separados.
- **Axios & @stomp/stompjs:** Para chamadas HTTP padrão (criar quiz) e conexões WebSockets persistentes (sincronização do jogo).

## 2. Backend
- **Spring Boot 4.1.1 + Java 17:** Framework e versão Java definidos no `backend/pom.xml`.
- **WebSocket com STOMP:** Utilizado o MessageBroker nativo do Spring. A escolha do STOMP permite trabalhar com tópicos pub/sub sem a complexidade de brokers externos (como RabbitMQ) para este MVP.
- **State Machine Embutida:** A partida transita pelos estados: `WAITING -> STARTING -> QUESTION_ACTIVE -> QUESTION_ENDED -> FINISHED`. O Backend é a única fonte de verdade.

## 3. Persistência
- **PostgreSQL:** Banco de dados relacional. Perfeito para garantir integridade e transacionabilidade nas respostas e pontuações do Quiz.

## 4. Segurança e funcionamento
- Não utilizamos JWT ou Spring Security neste MVP para facilitar o uso (entrar com apelido apenas).
- Tokens individuais de host e jogador autorizam as ações. Jogadores só podem atuar na própria partida; relatórios e revisões exigem seus respectivos tokens.
- O servidor controla a contagem de três segundos e o prazo de cada pergunta. A interface exibe o tempo sincronizado, mantendo a fórmula de pontuação e a tolerância de rede de 400 ms.
- Alterações em uma mesma partida são serializadas por bloqueio de linha no banco; eventos WebSocket são publicados após o commit. Clientes não podem publicar eventos de jogo.
- Ao conectar, reconectar, reativar a aba e a cada dez segundos, a interface recupera o estado atual. Respostas enviadas, dicas e efeitos de cegueira podem ser restaurados.
- Os testes usam H2 em memória no perfil `test`; produção continua utilizando PostgreSQL.

## 5. Acesso e limites operacionais

- A criacao de quizzes e salas exige uma sessao de organizador, aberta com a senha da instalacao. Alunos continuam entrando com codigo, apelido e avatar.
- O catalogo entrega resumos paginados. O estado autenticado entrega a pergunta atual; estatisticas e canais STOMP exigem participacao na mesma arena.
- Um cookie assinado identifica o navegador para evitar entradas duplicadas por descuido. O professor pode fechar novas entradas e remover participantes. Isso nao substitui contas verificadas em avaliacoes de alto rigor.
- Leituras de estado nao bloqueiam a linha da partida nem avancam seu relogio. O relogio tenta adquirir o bloqueio sem esperar por comandos em andamento; tarefas de manutencao usam um agendador separado dos heartbeats.
- Existem limites de salas, quizzes, conexoes, mensagens, corpo de requisicoes e registros de auditoria. As salas abertas expiram apos 12 horas; a retencao de resultados e configuravel.
- A expiracao usa um campo booleano e o estado FINISHED, preservando os cinco estados do banco existente. Datas antigas sem registro de criacao sao inicializadas na primeira execucao da nova versao.
- Tokens de organizador ficam em memoria por ate 12 horas. Esta instalacao usa um unico backend; multiplicar replicas requer compartilhar essas sessoes e o broker.
- Consulte o README.md para configurar as variaveis de ambiente e executar ou implantar o projeto.

## Configuracao de instalacoes independentes

- O frontend usa a mesma origem para REST e WebSocket. Em desenvolvimento, o Vite encaminha /api e /ws ao backend; no Docker, o Nginx faz esse encaminhamento.
- DOMAIN_NAME configura o modelo HTTPS do Nginx e a origem permitida pelo backend em producao. ALLOWED_ORIGINS permite origens HTTP/HTTPS explicitas, sem curingas, para REST e WebSocket ao executar o Java diretamente.
- O modelo Nginx e processado pela imagem oficial com NGINX_ENVSUBST_FILTER restrito a DOMAIN_NAME, preservando variaveis internas como $host e $uri. Os certificados pertencem a cada instalacao e devem ser emitidos e renovados pelo responsavel.
- docker-compose.local.yml publica a interface apenas no proprio computador, em 127.0.0.1:8081. docker-compose.prod.yml publica HTTPS e preserva banco e API na rede interna. Seus volumes de banco sao separados.
- O carregamento inicial cria somente um quiz generico de demonstracao e as estruturas operacionais necessarias. SEED_DEMO_QUIZ=false desativa a criacao do exemplo; conteudo existente nao e removido nem renomeado.

## 6. Diagnostico reservado ao professor

- O menu de opcoes do professor abre um painel fechado por padrao. GET /api/games/{code}/diagnostics exige X-Host-Token da propria arena; jogadores e hosts de outras salas nao podem consultar.
- ArenaDiagnostics e um DTO com lista explicita de campos: faixas de saude do processo e conexoes, contagens de atividade HTTP da sala, novas entradas, conexoes autenticadas e estado de admissao. Nao serializa entidades, logs, IPs, nomes, tokens ou beans do sistema.
- ArenaActivityMonitor guarda somente codigos de sala e contadores agregados em memoria: janela de 60 segundos, no maximo 512 salas. ArenaActivityFilter observa o resultado HTTP sem guardar headers, corpos ou enderecos. O proprio endpoint de diagnostico e os preflights nao alteram suas contagens.
- Novos participantes sao contados apos a confirmacao do cadastro; reconexoes por cookie nao sao novas entradas. A contagem de conexoes considera apenas sessoes autenticadas da propria sala.
- O frontend consulta apenas com o painel aberto e a aba visivel, evita chamadas sobrepostas, cancela consultas ao fechar, sinaliza leituras desatualizadas e mantem foco/teclado. O controle reutiliza lobby-lock; novas entradas continuam permitidas apenas em WAITING.
- O painel usa contadores em memoria e recursos de gerenciamento do Java, sem servicos externos. Seus indicadores descrevem o processo da aplicacao e a atividade da sala; nao substituem o monitoramento da infraestrutura de hospedagem.
