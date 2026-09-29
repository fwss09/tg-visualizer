import type {
  AiAnalysisResult,
  ParticipantMetrics,
  ParticipantBadge,
  DetectedPattern,
  BoundaryHealth,
} from '@/types/ai'

function sanitizeNumber(val: any, fallback = 0, isFloat = false): number {
  if (typeof val === 'number' && !isNaN(val)) {
    return isFloat ? Math.round(val * 100) / 100 : Math.round(val)
  }
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.-]/g, '')
    const parsed = isFloat ? parseFloat(cleaned) : parseInt(cleaned, 10)
    if (!isNaN(parsed)) return isFloat ? Math.round(parsed * 100) / 100 : Math.round(parsed)
  }
  return fallback
}

function normalizeBadge(raw: any, defaultTitle = 'Собеседник'): ParticipantBadge {
  if (typeof raw === 'string') {
    return { title: raw, description: '' }
  }
  return {
    title: raw?.title || defaultTitle,
    description: raw?.description || '',
  }
}

function normalizeParticipant(raw: any, defaultName: string): ParticipantMetrics {
  return {
    name: raw?.name || defaultName,
    badge: normalizeBadge(raw?.badge, 'Участник диалога'),
    attention_roi_multiplier: sanitizeNumber(raw?.attention_roi_multiplier, 1.0, true),
    topic_retention_replies: sanitizeNumber(raw?.topic_retention_replies, 2.5, true),
    topic_hijack_per_10: sanitizeNumber(raw?.topic_hijack_per_10, 1.0, true),
    validation_index_percent: sanitizeNumber(raw?.validation_index_percent, 50),
    elaboration_words_per_answer: sanitizeNumber(raw?.elaboration_words_per_answer, 15.0, true),
    initiation_share_percent: sanitizeNumber(raw?.initiation_share_percent, 50),
    warmth_and_support: sanitizeNumber(raw?.warmth_and_support, 60),
    humor_and_banter: sanitizeNumber(raw?.humor_and_banter, 50),
    toxicity_and_manipulation: sanitizeNumber(raw?.toxicity_and_manipulation, 10),
    emotional_investment: sanitizeNumber(raw?.emotional_investment, 50),
  }
}

export function parseAiAnalysisJson(rawJsonText: string): AiAnalysisResult {
  let cleaned = rawJsonText.trim()
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7)
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3)
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3)
  cleaned = cleaned.trim()

  let parsed: any
  try {
    parsed = JSON.parse(cleaned)
  } catch (err: any) {
    // Attempt relaxed trailing comma cleanup
    try {
      const fixed = cleaned
        .replace(/,\s*([\]}])/g, '$1')
        .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
      parsed = JSON.parse(fixed)
    } catch {
      throw new Error(`Failed to parse AI response as JSON: ${err?.message || 'Syntax error'}`)
    }
  }

  const rawUser1 = parsed?.participants?.user_1 || parsed?.per_user_metrics?.user_1 || {}
  const rawUser2 = parsed?.participants?.user_2 || parsed?.per_user_metrics?.user_2 || {}

  const user1 = normalizeParticipant(rawUser1, 'fwss')
  const user2 = normalizeParticipant(rawUser2, 'Собеседник')

  // Communication coefficients
  const commCoeffs = {
    attention_balance_summary:
      parsed?.communication_coefficients?.attention_balance_summary ||
      parsed?.reciprocity_balance?.ratio_description ||
      'Сбалансированное распределение внимания.',
    topic_reception_verdict:
      parsed?.communication_coefficients?.topic_reception_verdict ||
      'Участники взаимно поддерживают и развивают темы.',
    dialogue_driver:
      parsed?.communication_coefficients?.dialogue_driver ||
      parsed?.reciprocity_balance?.primary_drain ||
      'Оба участника поддерживают ритм диалога.',
  }

  // Patterns
  const rawPatterns = Array.isArray(parsed?.detected_patterns)
    ? parsed.detected_patterns
    : Array.isArray(parsed?.detected_red_flags)
      ? parsed.detected_red_flags.map((rf: any) => ({
          pattern_type: 'warning' as const,
          pattern_name: rf?.pattern_name || 'Паттерн общения',
          quote: rf?.quote || '',
          analysis: rf?.analysis || '',
        }))
      : []

  const detected_patterns: DetectedPattern[] = rawPatterns.map((p: any) => ({
    pattern_type: ['constructive', 'warning', 'destructive'].includes(p?.pattern_type)
      ? p.pattern_type
      : 'warning',
    pattern_name: p?.pattern_name || 'Паттерн',
    quote: p?.quote || '',
    analysis: p?.analysis || '',
  }))

  const rawHealth = String(parsed?.boundary_health || '').toLowerCase()
  let boundary_health: BoundaryHealth = 'Medium'
  if (rawHealth.includes('high') || rawHealth.includes('высок')) boundary_health = 'High'
  else if (rawHealth.includes('low') || rawHealth.includes('низк')) boundary_health = 'Low'

  return {
    atmosphere_verdict:
      parsed?.atmosphere_verdict ||
      'Анализ коммуникации успешно сформирован.',
    relationship_vibe:
      parsed?.relationship_vibe ||
      'Динамичный диалог с живым обменом мыслями',
    tandem_superpower:
      parsed?.tandem_superpower ||
      'Взаимный интерес и готовность оставаться на связи',
    participants: {
      user_1: user1,
      user_2: user2,
    },
    per_user_metrics: {
      user_1: user1,
      user_2: user2,
    },
    communication_coefficients: commCoeffs,
    reciprocity_balance: {
      ratio_description: commCoeffs.attention_balance_summary,
      primary_drain: commCoeffs.dialogue_driver,
    },
    detected_patterns,
    detected_red_flags: detected_patterns,
    boundary_health,
  }
}
