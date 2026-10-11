# 🧠 Mind Arena

<p align="center">
  <img src="frontend/src/assets/logo.png" alt="Mind Arena" width="160" />
</p>

**Projeto de faculdade com finalidade acadêmica:** uma arena de quizzes em tempo real para estudar, experimentar e realizar atividades educacionais. Cada pessoa ou instituição pode hospedar sua própria instalação, conforme a [licença de uso acadêmico e não comercial](LICENSE).

Este repositório contém o software e um exemplo genérico. Os quizzes, resultados, credenciais e dados de cada instalação ficam sob responsabilidade de quem a hospeda.

## Como funciona

- O organizador cria quizzes e partidas usando a senha da instalação.
- Participantes entram pelo código ou QR Code, escolhem apelido e avatar e jogam sem cadastro.
- A arena oferece cronômetro sincronizado, pontuação, sequência de acertos, ranking e poderes opcionais.
- O modo telão permite projetar a partida. O organizador pode fechar novas entradas e remover participantes.
- O painel reservado apresenta indicadores agregados da aplicação e da sala.
- Há narração com velocidade ajustável, alto contraste, ampliação de fonte, navegação por teclado e redução de movimento.

A interface usa React e TypeScript; o backend usa Java 17 e Spring Boot. As partidas são persistidas em PostgreSQL e sincronizadas por WebSocket/STOMP.

## Testar no computador com Docker

É necessário instalar Docker e Docker Compose.

1. Copie `env.template` para `.env` na raiz do projeto:

   ```bash
   cp env.template .env
   ```

   No PowerShell: `Copy-Item env.template .env`.

2. Preencha `POSTGRES_PASSWORD`, `ORGANIZER_PASSWORD` e `DEVICE_SECRET` com **três valores diferentes**, gerados aleatoriamente. A senha do organizador aceita 12 a 128 caracteres; a chave de dispositivos exige pelo menos 32 caracteres.

   Para gerar um valor de 64 caracteres no Linux/macOS:

   ```bash
   openssl rand -hex 32
   ```

   No Windows PowerShell:

   ```powershell
   $bytes = New-Object byte[] 32
   $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
   $generator.GetBytes($bytes)
   $generator.Dispose()
   [BitConverter]::ToString($bytes).Replace("-", "").ToLowerInvariant()
   ```

   Execute a geração separadamente para cada segredo. Guarde os valores somente no arquivo privado `.env`.

3. Inicie a aplicação:

   ```bash
   docker compose -f docker-compose.local.yml up -d --build
   ```

4. Abra **http://localhost:8081**. Use a senha de `ORGANIZER_PASSWORD` na área do organizador.

Essa configuração publica somente a interface no próprio computador. Backend e banco ficam na rede Docker. O acesso é HTTP local; para disponibilizar a instalação a outras pessoas pela internet, siga a configuração HTTPS abaixo.

Para parar, use `docker compose -f docker-compose.local.yml down`. Os dados permanecem no volume `pgdata_local`; remover esse volume apaga o banco.

## Hospedar uma instalação própria com HTTPS

1. Prepare uma máquina com Docker e Docker Compose e aponte seu domínio para ela.
2. Crie o arquivo privado `.env` conforme o procedimento anterior. Defina `DOMAIN_NAME` com seu domínio, sem protocolo, porta ou caminho, por exemplo `arena.example.org`. Esse domínio é apenas um exemplo.
3. Obtenha um certificado TLS válido para o domínio. A configuração espera os arquivos `/etc/letsencrypt/live/<DOMAIN_NAME>/fullchain.pem` e `privkey.pem` no servidor. A aplicação não emite nem renova certificados automaticamente: configure a emissão, a renovação e a recarga do Nginx com a ferramenta de sua preferência.
4. Disponibilize as portas 80 e 443 para a interface. Mantenha o acesso administrativo restrito; o banco e a API devem continuar sem portas publicadas.
5. Inicie:

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

6. Acesse `https://<DOMAIN_NAME>`. A mesma instalação atende a interface, a API e o WebSocket. O domínio é aplicado ao Nginx e às origens permitidas do backend, sem endereços de uma instalação particular no código.

O Compose exige os segredos antes de iniciar. O processo do Nginx valida o formato do domínio e a existência dos certificados. A configuração de produção limita recursos e rotaciona os logs.

**Banco existente:** use a senha que já está configurada no PostgreSQL. Alterar `POSTGRES_PASSWORD` em `.env` não troca a senha de um banco já inicializado. Faça backup e uma alteração coordenada do usuário do banco quando precisar rotacioná-la.

Cada configuração usa seu próprio volume: `pgdata_local` no teste local e `pgdata` em produção. Não há importação automática de dados entre instalações.

## Desenvolvimento sem containers para a aplicação

Pré-requisitos: Java JDK 17 ou superior, Node.js 24 e Docker Compose para o banco.

Na raiz, inicie apenas o banco local:

```bash
docker compose up -d db
```

O arquivo `docker-compose.yml` publica o PostgreSQL somente em `127.0.0.1:5432` e usa uma senha de desenvolvimento quando `POSTGRES_PASSWORD` não foi definida. Essa configuração é para desenvolvimento no computador.

Defina no terminal do backend a senha do banco que realmente está em uso e uma senha de organizador:

```bash
cd backend
export DATABASE_PASSWORD="valor_da_senha_do_banco_local"
export ORGANIZER_PASSWORD="valor_da_senha_do_organizador"
chmod +x mvnw
./mvnw spring-boot:run
```

No Windows PowerShell:

```powershell
cd backend
$env:DATABASE_PASSWORD="valor_da_senha_do_banco_local"
$env:ORGANIZER_PASSWORD="valor_da_senha_do_organizador"
.\mvnw.cmd spring-boot:run
```

Executar Java diretamente não carrega automaticamente o `.env` da raiz. Se a senha do organizador estiver ausente ou fora dos limites, o login fica indisponível. Sem `DEVICE_SECRET`, o backend local gera uma chave temporária; reiniciar o processo invalida os cookies antigos.

Em outro terminal:

```bash
cd frontend
npm ci
npm run dev
```

Abra http://localhost:5173. O Vite encaminha `/api` e `/ws` ao backend em `127.0.0.1:8080`.

Se mudar a porta do backend, defina `BACKEND_PROXY_URL` no ambiente ou em `frontend/.env`. As opções de `frontend/env.template` permitem configurar endereços separados, quando necessário. Toda variável `VITE_*` pode aparecer no navegador: **nunca coloque senhas ou chaves nessas variáveis**.

## Configuração

| Variável | Finalidade |
| --- | --- |
| `POSTGRES_PASSWORD` | Senha do banco; obrigatória nos Compose local completo e de produção. |
| `ORGANIZER_PASSWORD` | Senha compartilhada dos organizadores, com 12 a 128 caracteres. |
| `DEVICE_SECRET` | Chave aleatória e persistente para cookies assinados, com pelo menos 32 caracteres. |
| `DOMAIN_NAME` | Domínio HTTPS da instalação em produção. |
| `SEED_DEMO_QUIZ` | `true` cria um exemplo genérico, se ele ainda não existir; `false` desativa sua criação. |
| `GAME_RETENTION_DAYS` | Retenção de resultados encerrados; padrão 30 dias, `0` desativa a limpeza. |
| `MAX_ACTIVE_GAMES` | Limite de salas ativas; padrão 20. |
| `MAX_STORED_GAMES` | Limite de partidas armazenadas; padrão 5000. |
| `MAX_QUIZZES` | Limite de quizzes; padrão 500. |
| `ALLOWED_ORIGINS` | Origens completas, separadas por vírgula, ao executar Java diretamente. Padrão: as duas origens locais na porta 5173. No Docker, o Compose configura as origens da instalação. |

O exemplo tem gabarito público no código-fonte e serve para conhecer o jogo. Cadastre conteúdo próprio na área do organizador quando precisar de perguntas cujas respostas não estejam no repositório. Desativar o exemplo não remove quizzes já gravados.

## Segurança e responsabilidade de quem hospeda

O software inclui autorização por sala e por participante, proteção das ações do organizador, cookies assinados, limites de requisições e conexões, validação de entradas e restrições de publicação no WebSocket. O servidor controla tempo, pontuação e respostas corretas. O painel reservado exige autorização do organizador da própria sala e apresenta contagens agregadas, sem expor nomes, IPs, tokens ou configurações internas.

A entrada sem contas individuais é uma decisão de uso: outro navegador, janela privada ou dispositivo pode criar um participante adicional. O organizador pode fechar novas entradas e remover participantes. Considere esse comportamento ao planejar avaliações.

Quem hospeda deve configurar segredos exclusivos, HTTPS, firewall e acesso administrativo, manter dependências e sistema atualizados, fazer backups e acompanhar o funcionamento da aplicação. Limites na aplicação reduzem abusos, mas não garantem resistência a qualquer ataque ou a grandes volumes de tráfego.

O projeto tem finalidade acadêmica. Não há compromisso de suporte, manutenção contínua, disponibilidade ou certificação de segurança. Antes de expor uma instalação à internet, avalie a configuração e os requisitos do seu ambiente.

## Verificação e estrutura

```bash
# Backend (Windows: use mvnw.cmd)
cd backend
./mvnw test

# Frontend, em outro terminal
cd frontend
npm ci
npm run build
npm run lint
```

Os testes do backend usam H2 em memória, sem acessar o banco de uma instalação real.

```text
backend/                  API Java, persistência, WebSocket e testes
frontend/                 Interface React, recursos visuais e Nginx local
env.template              Modelo público; copie para um .env privado
docker-compose.yml        Banco para desenvolvimento local
docker-compose.local.yml  Aplicação completa para teste no computador
docker-compose.prod.yml   Aplicação completa com HTTPS e domínio próprio
nginx.prod.conf           Modelo HTTPS processado pelo container Nginx
ARCHITECTURE.md            Arquitetura e limites da aplicação
LICENSE                   Condições de uso acadêmico e não comercial
```

## Licença

O código original do Mind Arena pode ser utilizado, modificado e compartilhado para fins acadêmicos e não comerciais conforme o arquivo [LICENSE](LICENSE). Bibliotecas, fontes e demais componentes de terceiros mantêm suas respectivas licenças.
