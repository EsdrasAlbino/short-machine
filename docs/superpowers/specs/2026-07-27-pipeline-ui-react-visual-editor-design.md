# pipeline_ui React + Editor Visual de Branding

## Contexto

O `pipeline_ui` atual (Flask + Jinja + JS puro, ver
[2026-07-25-pipeline-interface-design.md](./2026-07-25-pipeline-interface-design.md))
exige digitar coordenadas em texto pra posicionar logo, ícone e região de
remoção de marca d'água. Isso já causou um bug real em produção: um ícone
salvo em resolução nativa (600x600) apareceu gigante em 80 vídeos já
agendados no Postiz, só descoberto ao olhar o resultado depois de pronto.
Este spec reestrutura o `pipeline_ui` com React no frontend e um backend
dedicado (FastAPI), adicionando um editor visual com preview ao vivo pra
essas configurações de branding.

## Objetivo

Configurar visualmente — arrastando livremente sobre um vídeo de exemplo
rodando de verdade — a posição da logo, do ícone e a região de remoção de
marca d'água, com o resultado renderizado ao vivo antes de rodar o lote
inteiro. Elimina a classe de bug "digitei a coordenada errada e só descobri
depois".

## Fora de escopo

- Corte de cena, timeline multi-clipe, ou qualquer edição estilo NLE — o
  editor cobre só posicionamento de branding, não montagem de vídeo.
- Ajuste visual individual por vídeo dentro de um lote — a configuração é
  feita uma vez (num vídeo de exemplo) e aplicada a todos os vídeos do lote,
  igual ao modelo de preset já existente.
- Migração do backend pra Node — o processamento em lote continua em
  Python/FastAPI, reaproveitando `pipeline/*` sem reescrita.

## Arquitetura

```
pipeline_ui/
  backend/                    -- FastAPI, substitui app.py
    main.py                   -- app FastAPI, CORS, serve o build do React em produção
    routes/
      presets.py               -- CRUD de presets (equivalente a /save-preset, /api/presets)
      sample_video.py           -- busca/reaproveita 1 vídeo de exemplo do perfil
      runs.py                    -- inicia o lote, streaming de log (SSE, igual a hoje)
    (importa pipeline/* sem nenhuma mudança de lógica)

  frontend/                   -- React (Vite)
    src/
      components/
        PresetForm.tsx         -- formulário de config (substitui form.html)
        VisualEditor.tsx        -- editor com FFmpeg.wasm e arraste livre
        RunLog.tsx               -- log ao vivo (substitui run.html/run.js)
      lib/
        ffmpegPreview.ts        -- monta o filter_complex e roda via @ffmpeg/ffmpeg
        api.ts                    -- chamadas ao backend
```

Em produção, o FastAPI serve os arquivos estáticos do build do React — um
único processo, uma porta só, mantendo a simplicidade de uso local que a
versão Flask já tinha. Em desenvolvimento, `vite` e `uvicorn --reload` rodam
separados, com CORS liberado do FastAPI pra origem do Vite.

## Editor visual

**Fluxo:**
1. O backend busca (ou reaproveita, se já existir localmente) 1 vídeo de
   exemplo do perfil informado — mesma lógica de amostragem já usada no
   `/preview` atual.
2. O vídeo carrega num elemento `<video>` no navegador. Por cima, duas caixas
   arrastáveis e redimensionáveis representam: (a) a região da marca d'água
   de origem a remover, e (b) a posição da logo/ícone a sobrepor.
3. A cada ajuste (com debounce), o `ffmpegPreview.ts` monta o mesmo
   `filter_complex` que `editVideos.py` já gera (delogo, blur de fundo,
   overlay) e renderiza só os primeiros ~3 segundos do vídeo via
   `@ffmpeg/ffmpeg` (FFmpeg real compilado pra WASM, rodando 100% no
   navegador). O resultado toca ali na hora — sem round-trip pro servidor.
4. Ao confirmar, essas coordenadas (frações 0-1 pra região de marca d'água,
   pixels x/y pra logo/ícone) viram o config do preset, e o backend dispara
   o lote real com as mesmas configurações.

**Mudança necessária no `editVideos.py`:** hoje o overlay de logo/ícone só
aceita 5 posições nomeadas fixas (`top-left`, `bottom-right`, etc. — ver
`POSITIONS` em `editVideos.py`). Para permitir arraste livre de verdade, o
filtro passa a aceitar também coordenada explícita `x,y` em pixels,
preservando as 5 posições nomeadas para compatibilidade com presets
salvos antes desta mudança.

## Formato do config (campos novos)

```json
{
  "edit": {
    "logo_position": {"x": 40, "y": 1600},
    "icon_position": {"x": 900, "y": 60},
    "watermark_region": "0.287,0.674,0.694,0.700"
  }
}
```

`logo_position`/`icon_position` aceitam tanto `{x, y}` explícito quanto uma
string de posição nomeada antiga (`"bottom-right"`), pra manter presets
existentes funcionando sem migração. As coordenadas `x,y` são pixels no
**canvas de saída** (o `canvas_size` do `editVideos.py`, 1080x1920 por
padrão) — o mesmo espaço onde o overlay já é aplicado hoje, não a resolução
do vídeo de origem antes do redimensionamento.

## Tratamento de erros

- **FFmpeg.wasm não carrega** (sem suporte no navegador, ou falha no download
  do WASM) → cai automaticamente pro modo de frame estático já existente
  (equivalente ao `/preview` atual), sem travar o editor.
- **Vídeo de exemplo falha ao baixar** → mesma mensagem de erro clara que o
  `/preview` já usa hoje.
- **Coordenadas inválidas no arraste** (fora do frame, região invertida) →
  validado no navegador antes de renderizar; a caixa fica travada dentro dos
  limites do vídeo.
- **Erros do lote em si** (download/edição/agendamento) → inalterado, mesma
  lógica de retry/skip por item já existente em `pipeline/*`.

## Plano de testes

1. Arrastar livremente a região da marca d'água e a posição da logo/ícone;
   confirmar que o preview ao vivo bate com o resultado de um lote real de 1
   vídeo rodado no backend com as mesmas coordenadas.
2. Simular falha de carregamento do FFmpeg.wasm e confirmar que cai pro modo
   de frame estático sem travar a tela.
3. Carregar um preset salvo antes desta mudança (posição nomeada tipo
   `"bottom-right"`) e confirmar que o editor novo ainda funciona com ele.
4. Rodar um lote completo de ponta a ponta (download → edição → título →
   agendamento) e confirmar que nada regrediu em relação ao fluxo atual.
