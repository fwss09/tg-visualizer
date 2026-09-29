export interface ParticipantBadge {
  title: string
  description: string
}

export interface ParticipantMetrics {
  name: string
  badge: ParticipantBadge
  // Concrete communicative coefficients
  attention_roi_multiplier: number // e.g. 1.35x or 0.72x
  topic_retention_replies: number // average replies per started topic, e.g. 3.4
  topic_hijack_per_10: number // e.g. 1.5 out of 10
  validation_index_percent: number // 0-100%
  elaboration_words_per_answer: number // average words in answer to questions, e.g. 24.5
  initiation_share_percent: number // share of conversation awakenings, e.g. 65%
  // Emotional breakdown
  warmth_and_support: number // 0-100
  humor_and_banter: number // 0-100
  toxicity_and_manipulation: number // 0-100
  emotional_investment: number // 0-100
}

export interface CommunicationCoefficients {
  attention_balance_summary: string
  topic_reception_verdict: string
  dialogue_driver: string
}

export interface DetectedPattern {
  pattern_type: 'constructive' | 'warning' | 'destructive'
  pattern_name: string
  quote: string
  analysis: string
}

export type BoundaryHealth = 'Low' | 'Medium' | 'High'

export interface ParticipantRecommendation {
  focus: string
  dos: string[]
  donts: string[]
}

export interface Recommendations {
  participant_1: ParticipantRecommendation
  participant_2: ParticipantRecommendation
}

export interface AiAnalysisResult {
  atmosphere_verdict: string
  relationship_vibe: string
  tandem_superpower: string
  participants: {
    user_1: ParticipantMetrics
    user_2: ParticipantMetrics
  }
  communication_coefficients: CommunicationCoefficients
  detected_patterns: DetectedPattern[]
  boundary_health: BoundaryHealth
  recommendations?: Recommendations
  // Backward compatibility aliases if needed
  per_user_metrics?: {
    user_1: ParticipantMetrics
    user_2: ParticipantMetrics
  }
  reciprocity_balance?: {
    ratio_description: string
    primary_drain: string
  }
  detected_red_flags?: DetectedPattern[]
}
