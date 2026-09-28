export interface UserMetric {
  name: string
  warmth_and_support: number // 0-100
  humor_and_banter: number // 0-100
  toxicity_and_manipulation: number // 0-100
  emotional_investment: number // 0-100
}

export interface PerUserMetrics {
  user_1: UserMetric
  user_2: UserMetric
}

export interface ReciprocityBalance {
  ratio_description: string
  primary_drain: string
}

export interface DetectedRedFlag {
  pattern_name: string
  quote: string
  analysis: string
}

export type BoundaryHealth = 'Low' | 'Medium' | 'High'

export interface AiAnalysisResult {
  atmosphere_verdict: string
  per_user_metrics: PerUserMetrics
  reciprocity_balance: ReciprocityBalance
  detected_red_flags: DetectedRedFlag[]
  boundary_health: BoundaryHealth
}
