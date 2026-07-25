# run_pipeline.py — Orquestrador do Fluxo de Conteúdo

## Contexto

Hoje o fluxo de conteúdo (baixar vídeos de uma conta do TikTok → editar/marcar → gerar
título em português → agendar no Postiz) é feito por scripts e chamadas separadas, cada
um disparado manualmente e conectado à mão. Este spec descreve um orquestrador único,
`run_pipeline.py`, que encadeia as quatro etapas numa única execução, configurável por
rodada, disparado manualmente (nunca por cron).

## Objetivo

Rodar um único comando, informar um perfil de origem + quantidade de vídeos, e ao final
ter os vídeos baixados, editados com a marca do cliente, com títulos em português
gerados automaticamente, e agendados no canal de destino no Postiz — sem passos manuais
intermediários.

## Fora de escopo

- Disparo automático/agendado (cron, webhook) — sempre manual.
- Suporte a outras redes além do TikTok (origem) e do Postiz (destino).
- Interface gráfica — é um script de linha de comando.

## Arquitetura

Um único processo Python que executa 4 estágios em sequência, cada um implementado como
função importável (não subprocess), reaproveitando o código já existente em
`tiktokBulkDownloader.py` e `editVideos.py` como módulos:

```
run_pipeline.py --config config.json [--start-date YYYY-MM-DD] [--dry-run]

  1. download  → enumera e baixa os N vídeos mais recentes de um perfil
  2. edit      → remove marca d'água de origem, aplica branding, gera legendas
  3. title_gen → gera título em português por vídeo via API de LLM
  4. schedule  → faz upload + agenda cada vídeo no Postiz
```

Cada estágio recebe a saída do anterior (lista de caminhos de arquivo) e devolve uma
lista atualizada. Se um estágio falhar para um item específico, esse item é marcado e
excluído dos estágios seguintes, mas o restante do lote continua (ver Tratamento de
Erros).

## Estágio 1 — Download

**Descoberta técnica desta sessão:** `yt-dlp` já consegue enumerar os vídeos de um
perfil do TikTok diretamente via `--flat-playlist --playlist-end N`, sem carregar a
página num navegador — testado ao vivo contra `@duduzerayt2` e funcionou sem bloqueio
anti-bot e sem cookies. Isso elimina a etapa manual de coletar links via console do
navegador que era necessária até agora.

**Input (config):**
- `profile_url` — URL do perfil TikTok de origem
- `video_count` — quantos vídeos mais recentes baixar

**Comportamento:**
1. `yt-dlp --flat-playlist --print "%(webpage_url)s" --playlist-end <video_count> <profile_url>`
   para obter a lista de URLs de vídeo.
2. Para cada URL, reaproveita a função de download já existente em
   `tiktokBulkDownloader.py` (baseada em `yt-dlp --dump-json` + download), mantendo o
   preset de nome de arquivo `default` (`YYYYMMDD_creator_titulo.mp4`) já usado em todo
   o histórico do projeto.
3. Vídeos cujo nome de arquivo final já existe no diretório de saída são pulados
   (idempotência entre execuções repetidas).

**Saída:** lista de caminhos dos vídeos baixados em `raw/<profile_handle>/`.

## Estágio 2 — Edição

Reaproveita as funções já existentes em `editVideos.py` (`build_filter_complex`,
`compute_delogo_region`, `transcribe_to_srt`, `process_video`) sem alteração de lógica —
apenas passa a receber os parâmetros de branding do config em vez de constantes fixas no
script.

**Input (config):**
- `logo_path` — caminho do logo a sobrepor
- `icon_path` — caminho do ícone/badge circular
- `watermark_region` — `{x, y, width, height}` da marca d'água de origem a remover
  (varia conforme a conta de origem)
- `captions_enabled` — liga/desliga legenda automática via faster-whisper

**Comportamento:** para cada vídeo da etapa anterior, aplica remoção de marca d'água
(delogo), blur de fundo, overlay do logo/ícone e, se habilitado, gera `.srt` e queima a
legenda — igual ao pipeline manual já validado com os 164 vídeos anteriores.

**Saída:** lista de caminhos dos vídeos editados em `edited/<run_name>/`.

## Estágio 3 — Geração de título

**Input:** nenhum campo novo de config — reaproveita o nome de arquivo já baixado (que
contém data + handle + descrição original em inglês).

**Comportamento:** para cada vídeo, chama a API da Anthropic (ou OpenAI, conforme
`LLM_PROVIDER` no ambiente) pedindo a tradução/adaptação do texto do nome de arquivo para
um título em português, no mesmo estilo dos 164 títulos já gerados manualmente nesta
sessão (mantendo hashtags do final quando presentes).

**Segredo (env var, fora do config):** `ANTHROPIC_API_KEY` (ou `OPENAI_API_KEY`).

## Estágio 4 — Agendamento

Reaproveita a lógica já validada em `schedule_all.py` (upload via
`/api/public/v1/upload`, agendamento via MCP `integrationSchedulePostTool`, sessão MCP
com auto-refresh).

**Input (config):**
- `integration_id` — ID da integração/canal de destino no Postiz
- `posts_per_day` — quantos posts agendar por dia (1 ou 2)
- `times_utc` — lista de horários UTC para os posts do dia (ex: `["15:00", "20:00"]`)

**Input (CLI, não fica salvo no config):**
- `--start-date` — data de início do agendamento. Se omitido, o pipeline **sempre
  pergunta interativamente** antes de agendar (nunca assume um default).

**Segredos (env var):** `POSTIZ_TOKEN`, `POSTIZ_MCP_URL`, `POSTIZ_UPLOAD_URL`.

**Comportamento:** distribui os vídeos da etapa anterior nos slots de
`posts_per_day` × `times_utc` a partir de `start_date`, faz upload de cada vídeo e agenda
via MCP, na ordem em que foram processados.

## Formato do config

Arquivo JSON por execução, ex. `config_teamshop07.json`:

```json
{
  "run_name": "team_shop_07_2026-08",
  "download": {
    "profile_url": "https://www.tiktok.com/@duduzerayt2",
    "video_count": 50
  },
  "edit": {
    "logo_path": "assets/logo_team_shop.png",
    "icon_path": "assets/icon_ts.png",
    "watermark_region": { "x": 400, "y": 800, "width": 300, "height": 80 },
    "captions_enabled": true
  },
  "schedule": {
    "integration_id": "cms0iohmr004ulm84emglc6kq",
    "posts_per_day": 2,
    "times_utc": ["15:00", "20:00"]
  }
}
```

Segredos (`ANTHROPIC_API_KEY`/`OPENAI_API_KEY`, `POSTIZ_TOKEN`, `POSTIZ_MCP_URL`,
`POSTIZ_UPLOAD_URL`) ficam em variáveis de ambiente (`.env`, não commitado), nunca no
arquivo de config.

## Tratamento de erros

Princípio geral: **uma falha isolada não derruba o lote inteiro**. Cada estágio loga o
item problemático e segue para o próximo; ao final, o pipeline imprime um resumo dos
itens que precisam de atenção manual.

- **Download:** perfil não encontrado / privado / 0 vídeos retornados → aborta a
  execução inteira antes de gastar tempo nas etapas seguintes (não adianta editar nada
  sem vídeo). Vídeo individual que falha ao baixar → pula esse item, loga, segue com os
  demais.
- **Edição:** arquivo corrompido ou falha do ffmpeg num vídeo específico → pula esse
  item, loga, segue com os demais.
- **Geração de título:** falha/timeout da API → até 3 tentativas com backoff; se ainda
  assim falhar, usa como fallback o texto do nome de arquivo já limpo (sem bloquear o
  vídeo, já que title sempre pode ser editado depois no Postiz).
- **Agendamento:** falha de upload ou rate limit → retry com backoff (mesmo padrão já
  usado em `schedule_all.py`); falha ao agendar após upload OK → loga o item como
  pendente no resumo final, sem interromper os demais.

## Plano de testes

1. **Teste ponta a ponta em miniatura:** rodar o pipeline completo com
   `video_count: 2` contra uma conta de teste, validando manualmente cada estágio
   (arquivo baixado → arquivo editado com marca → título plausível → post aparece no
   calendário do Postiz).
2. **`--dry-run`:** executa as etapas 1–3 normalmente, mas para na etapa 4 sem chamar a
   API do Postiz — permite validar vídeos editados e títulos gerados antes de publicar
   de verdade.
3. **Idempotência:** rodar o pipeline duas vezes seguidas com o mesmo config e
   confirmar que vídeos já baixados/editados não são reprocessados, e que não há posts
   duplicados agendados.
4. **Verificação final:** após uma execução real, conferir no calendário do Postiz que
   os posts aparecem nas datas/horários esperados.
