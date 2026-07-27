export interface OverlayPosition {
  x: number
  y: number
}

export type PositionValue = OverlayPosition | string

export interface EditConfig {
  logo_path: string
  icon_path: string
  logo_position?: PositionValue
  icon_position?: PositionValue
  watermark_region: string
  captions_enabled: boolean
  background_blur: boolean
}

export interface DownloadConfig {
  profile_url: string
  video_count: number
}

export interface ScheduleConfig {
  integration_id: string
  posts_per_day: number
  times_utc: string[]
}

export interface PipelineConfig {
  run_name: string
  download: DownloadConfig
  edit: EditConfig
  schedule: ScheduleConfig
}
