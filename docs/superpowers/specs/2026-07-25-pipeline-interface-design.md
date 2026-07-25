# Interface Web para o run_pipeline.py

## Contexto

O `run_pipeline.py` (ver
[2026-07-25-run-pipeline-design.md](./2026-07-25-run-pipeline-design.md)) é um CLI que
encadeia download, edição, geração de título e agendamento a partir de um arquivo de
config JSON. Este spec descreve uma interface web local, mais confortável para rodar o
pipeline do dia a dia sem editar JSON à mão nem acompanhar logs de terminal.

## Objetivo

Abrir uma página no navegador, escolher (ou preencher) um preset de configuração,
clicar em "Rodar" e acompanhar o progresso ao vivo até o pipeline terminar — sem tocar
em terminal ou arquivo de config manualmente.

## Fora de escopo

- Acesso remoto/exposição na internet — roda só localmente, sem autenticação.
- Execução simultânea de mais de um pipeline por vez.
- Edição de vídeo dentro da própria interface (preview de frame, ajuste visual de
  `watermark_region` etc.) — esse valor continua sendo definido manualmente e digitado
  no formulário.
- Dashboard de analytics/histórico de posts publicados — a interface só cobre o disparo
  e acompanhamento de uma execução do pipeline.

## Arquitetura

Aplicação Flask local, servida em `localhost:5000`, que atua como uma casca fina em
volta do `run_pipeline.py` já especificado — nenhuma lógica de pipeline é duplicada
aqui. O backend lança o CLI como subprocesso e transmite sua saída ao vivo para o
navegador via Server-Sent Events (SSE).

```
pipeline_ui/
  app.py          — servidor Flask (rotas HTML + rota SSE)
  configs/        — presets salvos, um .json por preset, mesmo formato do config do
                    run_pipeline.py
  runs/           — um arquivo .log por execução (nome com timestamp), espelhando o
                    stdout do subprocesso em disco
  templates/      — form.html (tela inicial) e run.html (tela de execução)
  static/         — JS puro (sem framework/build step) + CSS mínimo
```

Trava de execução única: o backend mantém em memória (processo Flask) se há um
subprocesso ativo; enquanto houver, o botão "Rodar" fica desabilitado em qualquer sessão
de navegador que abrir a tela inicial.

## Telas

**1. Tela inicial (`/`)** — formulário com:
- Dropdown "Preset" (lista os arquivos de `configs/`, ou "Novo preset" — que limpa o
  formulário e revela um campo de texto para o nome do novo preset, usado como nome do
  arquivo `.json` ao salvar)
- Campos do config: `profile_url`, `video_count`, `logo_path`, `icon_path`,
  `watermark_region` (x/y/width/height), `captions_enabled`, `integration_id`,
  `posts_per_day`, `times_utc`
- Campo `start_date` (obrigatório antes de rodar, nunca tem default)
- Checkbox `dry-run`
- Botões "Salvar preset" e "Rodar"

**2. Tela de execução (`/run/<run_id>`)** — aberta automaticamente ao clicar "Rodar":
- Área de log que recebe linhas via SSE e rola automaticamente
- Ao final (processo encerrado), mostra um resumo (total processado, sucesso, falhas —
  extraído das linhas de log no formato já usado pelos scripts existentes, ex.
  `[12] SCHEDULED for ...` / `[12] UPLOAD FAILED`)
- Se reaberta com um run já em andamento (ex. usuário fechou e voltou), carrega o
  conteúdo do arquivo `.log` correspondente do disco e volta a acompanhar a partir daí

## Fluxo de dados

1. Usuário preenche/edita o formulário e clica "Rodar".
2. Backend grava (ou atualiza) `configs/<nome_preset>.json` com os campos do
   formulário.
3. Backend gera um `run_id`, abre `runs/<run_id>.log` e lança
   `run_pipeline.py --config configs/<nome_preset>.json --start-date <data> [--dry-run]`
   como subprocesso, redirecionando stdout/stderr para esse arquivo.
4. Navegador é redirecionado para `/run/<run_id>`, que abre uma conexão SSE em
   `/run/<run_id>/stream`.
5. O backend lê o arquivo de log incrementalmente (tail) e envia cada nova linha como
   evento SSE. Quando o subprocesso termina, envia um evento final com o código de
   saída.

## Formato do preset salvo

Idêntico ao config do `run_pipeline.py` (ver spec anterior) — a interface não introduz
um formato novo, apenas lê/escreve o mesmo JSON:

```json
{
  "run_name": "team_shop_07",
  "download": { "profile_url": "...", "video_count": 50 },
  "edit": { "logo_path": "...", "icon_path": "...", "watermark_region": {...}, "captions_enabled": true },
  "schedule": { "integration_id": "...", "posts_per_day": 2, "times_utc": ["15:00", "20:00"] }
}
```

## Tratamento de erros

- **Campo obrigatório faltando/inválido no formulário** (ex. `start_date` vazio,
  `video_count` não numérico) → validação client-side impede o clique em "Rodar";
  backend revalida antes de lançar o subprocesso e retorna erro se algo escapou.
- **Subprocesso do `run_pipeline.py` encerra com erro** → o stream SSE continua até o
  fim do log e exibe uma mensagem clara de "execução interrompida com erro (código
  N)"; o servidor Flask não cai.
- **Tentativa de iniciar um novo run com outro já ativo** → botão "Rodar" desabilitado
  na tela inicial e endpoint de lançamento retorna erro se chamado mesmo assim.
- **Aba fechada/recarregada durante a execução** → ao reabrir `/run/<run_id>`, o
  backend detecta o subprocesso ainda ativo, envia o conteúdo já acumulado do arquivo
  de log e retoma o streaming ao vivo dali.

## Plano de testes

1. Rodar um preset com `video_count: 2` e `dry-run` marcado; confirmar log ao vivo na
   tela e parada antes do agendamento.
2. Fechar a aba no meio de uma execução real e reabrir `/run/<run_id>`; confirmar que o
   log retoma do ponto certo, sem duplicar nem perder linhas.
3. Tentar iniciar uma segunda execução com uma já ativa; confirmar bloqueio.
4. Salvar um preset, recarregar a tela inicial; confirmar que ele aparece no dropdown
   com os valores corretos previamente salvos.
