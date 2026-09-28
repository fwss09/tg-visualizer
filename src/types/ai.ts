export interface AiVibeScore {
  warmth: number
  humor: number
  toxicity: number
}

export interface AiTopic {
  topic: string
  summary: string
}

export interface AiParticipant {
  name: string
  archetype: string
  characterAnalysis: string
  favoriteHabit: string
  sampleQuote: string
}

export interface AiAward {
  nomination: string
  winner: string
  reason: string
}

export interface AiAnalysisResult {
  chatVibe: string
  vibeScore: AiVibeScore
  dialogueDynamics: string
  humorAndStyle: string
  insideJokesAndTopics: AiTopic[]
  participants: AiParticipant[]
  funAwards: AiAward[]
}
