import type { AppAPI } from '../electron/preload'

declare global {
  interface Window {
    api: AppAPI
  }
}

export {}
