import type { FastifyInstance } from 'fastify'
import { DEFAULT_MIN_EXCESS, DEFAULT_THRESHOLD } from '../domain/insights.js'

export interface SettingsResponse {
  insights: { threshold: number; minExcess: number }
}

export function registerSettings(app: FastifyInstance): void {
  app.get('/api/settings', async (): Promise<SettingsResponse> => ({
    insights: { threshold: DEFAULT_THRESHOLD, minExcess: DEFAULT_MIN_EXCESS },
  }))
}
