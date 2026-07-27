import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

const CORE_BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'

export class FFmpegLoadError extends Error {}

/**
 * Loads FFmpeg.wasm. Rejects with FFmpegLoadError on any failure (no
 * WebAssembly/SharedArrayBuffer support, network failure fetching the core,
 * etc.) so VisualEditor can catch it and fall back to the static-frame
 * preview mode instead of leaving the editor unusable.
 */
export async function loadFFmpeg(): Promise<FFmpeg> {
  try {
    const ffmpeg = new FFmpeg()
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    return ffmpeg
  } catch (err) {
    throw new FFmpegLoadError(err instanceof Error ? err.message : 'Failed to load FFmpeg.wasm')
  }
}
