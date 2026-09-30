import React, { useState, useEffect } from 'react'
import {
  ShieldAlert,
  Bot,
  Flame,
  Smile,
  Heart,
  Zap,
  Quote,
  Scale,
  Key,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  ArrowRightLeft,
  Activity,
  CheckCircle2,
  Sparkles,
  Award,
  Crown,
  MessageSquare,
  Repeat,
  Compass,
  Target,
  Lightbulb,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import type { TelegramExport } from '@/types/telegram'
import type { AiAnalysisResult, BoundaryHealth, ParticipantMetrics } from '@/types/ai'
import { prepareChatLogForAI } from '@/lib/prepareChatLog'
import { formatNumber } from '@/lib/utils'
import { SYSTEM_PROMPT } from '@/lib/aiPrompt'
import { parseAiAnalysisJson } from '@/lib/aiParser'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface AiAnalysisTabProps {
  rawExportData: TelegramExport
}

export const GEMINI_MODELS = [
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    badge: 'Recommended',
    description: 'Deep psychological audit, precise coefficients & behavioural quotes',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    badge: 'Fast',
    description: 'Rapid quantitative scan with high throughput',
  },
]

export const AiAnalysisTab: React.FC<AiAnalysisTabProps> = ({ rawExportData }) => {
  const [apiKey, setApiKey] = useState<string>('')
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-pro')
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [loadingStep, setLoadingStep] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [aiResult, setAiResult] = useState<AiAnalysisResult | null>(null)
  const [isCopied, setIsCopied] = useState<boolean>(false)
  const [patternFilter, setPatternFilter] = useState<'all' | 'constructive' | 'warning' | 'destructive'>('all')

  // Load saved key & model from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('tg_gemini_api_key')
    if (saved) {
      setApiKey(saved)
    } else {
      setShowKeyInput(true)
    }

    const savedModel = localStorage.getItem('tg_gemini_model')
    if (savedModel && GEMINI_MODELS.some((m) => m.id === savedModel)) {
      setSelectedModel(savedModel)
    }
  }, [])

  const handleSaveApiKey = (key: string) => {
    setApiKey(key)
    localStorage.setItem('tg_gemini_api_key', key)
  }

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId)
    localStorage.setItem('tg_gemini_model', modelId)
  }

  // Direct client-side call to Google Gemini API (bypasses Vercel 10s Serverless timeout)
  const callGeminiDirect = async (cleanLog: string, keyToUse: string): Promise<AiAnalysisResult> => {
    const fallbackList = ['gemini-2.5-pro', 'gemini-2.5-flash']
    const modelsToTry = [selectedModel, ...fallbackList.filter((m) => m !== selectedModel)]
    let lastError: string | null = null

    for (const model of modelsToTry) {
      // Vertex AI Express Mode endpoint for Google Cloud billing
      const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${keyToUse}`

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${SYSTEM_PROMPT}\n\nCHAT TITLE: ${rawExportData.name || 'Chat'}\n\nCOMPLETE CHAT LOG:\n${cleanLog}` }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7,
            maxOutputTokens: 32768,
          },
        }),
      })

      if (response.status === 503 || response.status === 429) {
        lastError = `Model ${model} is currently busy (${response.status}), retrying...`
        continue
      }

      if (!response.ok) {
        const errText = await response.text()
        lastError = `Gemini API Error (${response.status}): ${errText}`
        continue
      }

      const data = await response.json()
      const parts = data?.candidates?.[0]?.content?.parts
      const nonThought = Array.isArray(parts) ? parts.filter((p: any) => !p.thought && typeof p.text === 'string') : []
      const partsToUse = nonThought.length > 0 ? nonThought : (Array.isArray(parts) ? parts : [])
      const rawText = partsToUse.map((p: any) => p.text || '').join('')

      if (!rawText) {
        lastError = `Model ${model} returned empty content.`
        continue
      }

      return parseAiAnalysisJson(rawText)
    }

    throw new Error(lastError || 'Failed to get a response from Gemini. Please check your API key.')
  }

  // Fallback to Vercel Serverless
  const callServerless = async (cleanLog: string): Promise<AiAnalysisResult> => {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-gemini-key': apiKey } : {}),
      },
      body: JSON.stringify({
        chatName: rawExportData.name || 'Telegram Chat',
        chatLog: cleanLog,
        apiKey: apiKey.trim() || undefined,
        model: selectedModel,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      if (response.status === 504) {
        throw new Error(
          'Vercel function timed out (504). Please provide your Gemini API key in the input field above to analyze directly without server timeout limits!'
        )
      }
      throw new Error(
        errorData.error || `Server error (${response.status}). Please verify your API key.`
      )
    }

    return (await response.json()) as AiAnalysisResult
  }

  const runAnalysis = async () => {
    setIsLoading(true)
    setError(null)
    setLoadingStep('Formatting and packing 100% of messages for audit...')

    try {
      const { logText, exportedMessages } = prepareChatLogForAI(rawExportData)

      let result: AiAnalysisResult
      const trimmedKey = apiKey.trim()
      const currentModelName = GEMINI_MODELS.find((m) => m.id === selectedModel)?.name || selectedModel

      if (trimmedKey) {
        setLoadingStep(`${currentModelName} auditing ${formatNumber(exportedMessages)} messages directly...`)
        result = await callGeminiDirect(logText, trimmedKey)
      } else {
        setLoadingStep(`Auditing with ${currentModelName} via backend...`)
        result = await callServerless(logText)
      }

      setAiResult(result)
    } catch (err: any) {
      console.error('AI Analysis failed:', err)
      setError(err?.message || 'Failed to complete analysis. Check your API key or connection.')
    } finally {
      setIsLoading(false)
      setLoadingStep('')
    }
  }

  const handleCopyReport = () => {
    if (!aiResult) return
    const u1 = aiResult.participants?.user_1 || aiResult.per_user_metrics?.user_1
    const u2 = aiResult.participants?.user_2 || aiResult.per_user_metrics?.user_2
    const coeffs = aiResult.communication_coefficients

    const textToCopy = `📊 COMPREHENSIVE COMMUNICATION AUDIT: "${rawExportData.name || 'Chat'}"
--------------------------------------------------
Atmosphere Verdict: ${aiResult.atmosphere_verdict}
Relationship Vibe: ${aiResult.relationship_vibe || 'N/A'}
Tandem Superpower: ${aiResult.tandem_superpower || 'N/A'}
Boundary Health: ${aiResult.boundary_health}

👤 ${u1.name} — Title: "${u1.badge?.title}"
   • Role: ${u1.badge?.description}
   • Attention ROI: ${u1.attention_roi_multiplier}x
   • Topic Depth Retention: ${u1.topic_retention_replies} replies
   • Topic Hijack Rate: ${u1.topic_hijack_per_10} / 10
   • Validation Index: ${u1.validation_index_percent}%
   • Answer Elaboration: ${u1.elaboration_words_per_answer} words/answer
   • Initiation Share: ${u1.initiation_share_percent}%

👤 ${u2.name} — Title: "${u2.badge?.title}"
   • Role: ${u2.badge?.description}
   • Attention ROI: ${u2.attention_roi_multiplier}x
   • Topic Depth Retention: ${u2.topic_retention_replies} replies
   • Topic Hijack Rate: ${u2.topic_hijack_per_10} / 10
   • Validation Index: ${u2.validation_index_percent}%
   • Answer Elaboration: ${u2.elaboration_words_per_answer} words/answer
   • Initiation Share: ${u2.initiation_share_percent}%

⚖️ COMMUNICATION DYNAMICS:
• Attention Balance: ${coeffs?.attention_balance_summary || ''}
• Topic Reception: ${coeffs?.topic_reception_verdict || ''}
• Dialogue Driver: ${coeffs?.dialogue_driver || ''}
${
  aiResult.recommendations
    ? `
💡 ACTIONABLE RECOMMENDATIONS:
👤 ${u1.name} Focus: "${aiResult.recommendations.participant_1.focus}"
   • Recommended:
     ${aiResult.recommendations.participant_1.dos.map((d) => `+ ${d}`).join('\n     ')}
   • Avoid / Risk zones:
     ${aiResult.recommendations.participant_1.donts.map((d) => `- ${d}`).join('\n     ')}

👤 ${u2.name} Focus: "${aiResult.recommendations.participant_2.focus}"
   • Recommended:
     ${aiResult.recommendations.participant_2.dos.map((d) => `+ ${d}`).join('\n     ')}
   • Avoid / Risk zones:
     ${aiResult.recommendations.participant_2.donts.map((d) => `- ${d}`).join('\n     ')}`
    : ''
}

🔍 DETECTED PATTERNS:
${
  aiResult.detected_patterns?.length > 0
    ? aiResult.detected_patterns
        .map(
          (p, i) =>
            `${i + 1}. [${p.pattern_type.toUpperCase()}] ${p.pattern_name}\n   Quote: "${p.quote}"\n   Analysis: ${p.analysis}`
        )
        .join('\n\n')
    : 'No significant anomalies detected.'
}
`
    navigator.clipboard.writeText(textToCopy)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const getBoundaryHealthBadge = (health: BoundaryHealth) => {
    switch (health) {
      case 'High':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Boundary Health: Resilient (High)</span>
          </span>
        )
      case 'Medium':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-bold border border-amber-500/20">
            <Activity className="w-3.5 h-3.5" />
            <span>Boundary Health: Moderate</span>
          </span>
        )
      case 'Low':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 text-xs font-bold border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Boundary Health: Vulnerable (Low)</span>
          </span>
        )
    }
  }

  const totalRawMessages = rawExportData.messages?.length || 0

  const user1 = aiResult?.participants?.user_1 || aiResult?.per_user_metrics?.user_1
  const user2 = aiResult?.participants?.user_2 || aiResult?.per_user_metrics?.user_2
  const coeffs = aiResult?.communication_coefficients

  const filteredPatterns = (aiResult?.detected_patterns || []).filter((p) => {
    if (patternFilter === 'all') return true
    return p.pattern_type === patternFilter
  })

  const getRoiDescription = (roi: number) => {
    if (roi >= 1.2) return { text: 'Generous Contributor', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' }
    if (roi >= 0.9) return { text: 'Balanced Exchange', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' }
    return { text: 'Energy Saver', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' }
  }

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* 1. Initial State / Not yet analyzed */}
      {!aiResult && (
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-xs relative overflow-hidden">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Multi-Dimensional Communication & Behavioral Audit</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Deep behavioral audit with precise communicative coefficients & archetypes
            </h2>

            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Audits all{' '}
              <strong className="text-foreground font-semibold">{formatNumber(totalRawMessages)} messages</strong> in{' '}
              <strong className="text-foreground">«{rawExportData.name || 'Chat'}»</strong>. Computes Attention ROI, topic
              depth retention, initiation shares, participant titles, and healthy banter dynamics.
            </p>

            {/* Model Selection Dropdown */}
            <div className="max-w-md mx-auto text-left pt-2 pb-1 space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Gemini Model:
                </span>
                <span className="text-[11px] font-normal text-muted-foreground">Vertex AI Express Mode</span>
              </label>

              <Select value={selectedModel} onValueChange={(val) => handleModelChange(val as string)}>
                <SelectTrigger className="w-full h-11 bg-background/80 border-border/80 hover:border-primary/40 focus:ring-primary/20 transition-all rounded-2xl px-3.5">
                  <SelectValue placeholder="Choose a model" />
                </SelectTrigger>
                <SelectContent className="w-[calc(100vw-3rem)] max-w-md">
                  <SelectGroup>
                    <SelectLabel>Select Audit Model</SelectLabel>
                    {GEMINI_MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="py-2.5">
                        <div className="flex flex-col gap-0.5 text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{m.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
                              {m.badge}
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground font-normal">
                            {m.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Custom API Key input toggle */}
            <div className="pt-2 pb-2">
              <button
                type="button"
                onClick={() => setShowKeyInput(!showKeyInput)}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <Key className="w-3.5 h-3.5 text-primary" />
                <span>
                  {apiKey
                    ? `Using API Key (${apiKey.slice(0, 4)}...${apiKey.slice(-4)})`
                    : 'Enter Gemini API Key (runs directly in browser, no timeout)'}
                </span>
              </button>

              {showKeyInput && (
                <div className="mt-3 max-w-md mx-auto p-4 rounded-2xl bg-secondary/50 border border-border text-left space-y-2">
                  <label className="text-xs font-semibold text-foreground block">
                    Google Gemini API Key:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="AIzaSy..."
                      value={apiKey}
                      onChange={(e) => handleSaveApiKey(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Direct Vertex AI Express Mode calls with zero 10s server timeout limits.
                  </p>
                </div>
              )}
            </div>

            {/* Error banner */}
            {error && (
              <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs text-left flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Audit failed:</p>
                  <p className="opacity-90">{error}</p>
                </div>
              </div>
            )}

            {/* Run Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={runAnalysis}
                disabled={isLoading}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:opacity-95 hover:shadow-lg transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:pointer-events-none inline-flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{loadingStep || 'Auditing communications...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Run Comprehensive Communication Audit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Analysis Results View */}
      {aiResult && user1 && user2 && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm sm:text-base flex items-center gap-2">
                  <span>Communication Audit: «{rawExportData.name || 'Chat'}»</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Full data assessment based on {formatNumber(totalRawMessages)} messages
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="w-full sm:w-44">
                <Select value={selectedModel} onValueChange={(val) => handleModelChange(val as string)}>
                  <SelectTrigger className="h-8.5 text-xs bg-secondary/80 text-secondary-foreground rounded-xl border-border px-3 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="min-w-[13rem]">
                    <SelectGroup>
                      <SelectLabel>Switch Model</SelectLabel>
                      {GEMINI_MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-xs py-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold">{m.name}</span>
                            <span className="text-[10px] text-muted-foreground">({m.badge})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <button
                type="button"
                onClick={handleCopyReport}
                className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl border border-border bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Copied!' : 'Copy Audit'}</span>
              </button>

              <button
                type="button"
                onClick={runAnalysis}
                disabled={isLoading}
                className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl border border-border bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Re-Audit</span>
              </button>
            </div>
          </div>

          {/* Verdict and Relationship Chemistry Banner */}
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-7 shadow-xs space-y-4 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Vibe: {aiResult.relationship_vibe}</span>
                </span>
                {getBoundaryHealthBadge(aiResult.boundary_health)}
              </div>
            </div>

            <p className="text-sm sm:text-base text-foreground/95 leading-relaxed font-medium">
              {aiResult.atmosphere_verdict}
            </p>

            {aiResult.tandem_superpower && (
              <div className="p-4 rounded-2xl bg-secondary/40 border border-border/60 flex items-start gap-3">
                <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-xs">
                  <span className="font-bold text-foreground">Tandem Superpower:</span>
                  <p className="text-muted-foreground leading-relaxed">{aiResult.tandem_superpower}</p>
                </div>
              </div>
            )}
          </div>

          {/* Participant Titles & Archetype Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {[
              { u: user1, color: 'border-blue-500/30', badgeBg: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
              { u: user2, color: 'border-rose-500/30', badgeBg: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
            ].map(({ u, color, badgeBg }, idx) => {
              const roiBadge = getRoiDescription(u.attention_roi_multiplier)
              return (
                <div
                  key={idx}
                  className={`rounded-3xl border ${color} bg-card p-6 shadow-xs space-y-5 relative overflow-hidden`}
                >
                  {/* Participant Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-500" />
                        <h4 className="text-lg font-extrabold text-foreground">{u.name}</h4>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badgeBg}`}>
                        <Award className="w-3.5 h-3.5" />
                        <span>«{u.badge?.title}»</span>
                      </span>
                    </div>

                    <div className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border ${roiBadge.color}`}>
                      ROI: {u.attention_roi_multiplier}x
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed italic bg-secondary/30 p-3 rounded-xl border border-border/40">
                    "{u.badge?.description}"
                  </p>

                  {/* Concrete Key Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div className="p-3 rounded-2xl bg-secondary/40 border border-border/50 text-center">
                      <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                        Topic Depth
                      </div>
                      <div className="text-base font-extrabold text-foreground mt-0.5">
                        {u.topic_retention_replies} <span className="text-xs font-normal text-muted-foreground">replies</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Avg Retention</div>
                    </div>

                    <div className="p-3 rounded-2xl bg-secondary/40 border border-border/50 text-center">
                      <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                        Validation
                      </div>
                      <div className="text-base font-extrabold text-emerald-500 mt-0.5">
                        {u.validation_index_percent}%
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Support Rate</div>
                    </div>

                    <div className="p-3 rounded-2xl bg-secondary/40 border border-border/50 text-center col-span-2 sm:col-span-1">
                      <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                        Answer Words
                      </div>
                      <div className="text-base font-extrabold text-foreground mt-0.5">
                        {u.elaboration_words_per_answer} <span className="text-xs font-normal text-muted-foreground">w</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Per Direct Question</div>
                    </div>

                    <div className="p-3 rounded-2xl bg-secondary/40 border border-border/50 text-center">
                      <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                        Initiation
                      </div>
                      <div className="text-base font-extrabold text-primary mt-0.5">
                        {u.initiation_share_percent}%
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Pause Starters</div>
                    </div>

                    <div className="p-3 rounded-2xl bg-secondary/40 border border-border/50 text-center">
                      <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                        Topic Hijack
                      </div>
                      <div className={`text-base font-extrabold mt-0.5 ${u.topic_hijack_per_10 > 2.5 ? 'text-amber-500' : 'text-foreground'}`}>
                        {u.topic_hijack_per_10} <span className="text-xs font-normal text-muted-foreground">/ 10</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Shift to Self</div>
                    </div>

                    <div className="p-3 rounded-2xl bg-secondary/40 border border-border/50 text-center col-span-2 sm:col-span-1">
                      <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                        Energy ROI
                      </div>
                      <div className="text-base font-extrabold text-foreground mt-0.5">
                        {u.attention_roi_multiplier}x
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{roiBadge.text}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Side-by-Side Comparative Progress Bars */}
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-7 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Scale className="w-5 h-5 text-primary" />
                  <span>Head-to-Head Communicative Metric Comparison</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Direct asymmetry comparison across conversational depth, empathy and banter
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-foreground">{user1.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500" />
                  <span className="text-foreground">{user2.name}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 1. Attention ROI Multiplier */}
              <div className="space-y-3 p-4 rounded-2xl bg-secondary/30 border border-border/40">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <ArrowRightLeft className="w-4 h-4 text-primary" /> Attention Return on Investment (ROI)
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal">1.0x = Equal return</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-blue-500">{user1.name}</span>
                      <span className="font-bold text-foreground">{user1.attention_roi_multiplier}x</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, user1.attention_roi_multiplier * 50)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-rose-500">{user2.name}</span>
                      <span className="font-bold text-foreground">{user2.attention_roi_multiplier}x</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, user2.attention_roi_multiplier * 50)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Topic Retention Depth */}
              <div className="space-y-3 p-4 rounded-2xl bg-secondary/30 border border-border/40">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-emerald-500" /> Topic Depth Retention
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal">Average replies / topic</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-blue-500">{user1.name}</span>
                      <span className="font-bold text-foreground">{user1.topic_retention_replies} replies</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, user1.topic_retention_replies * 18)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-rose-500">{user2.name}</span>
                      <span className="font-bold text-foreground">{user2.topic_retention_replies} replies</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, user2.topic_retention_replies * 18)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Validation & Support */}
              <div className="space-y-3 p-4 rounded-2xl bg-secondary/30 border border-border/40">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Heart className="w-4 h-4 text-rose-500" /> Validation & Empathy Rate
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal">0-100%</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-blue-500">{user1.name}</span>
                      <span className="font-bold text-foreground">{user1.validation_index_percent}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${user1.validation_index_percent}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-rose-500">{user2.name}</span>
                      <span className="font-bold text-foreground">{user2.validation_index_percent}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${user2.validation_index_percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Open Humor & Banter */}
              <div className="space-y-3 p-4 rounded-2xl bg-secondary/30 border border-border/40">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Smile className="w-4 h-4 text-amber-500" /> Humor & Friendly Banter
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal">0-100%</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-blue-500">{user1.name}</span>
                      <span className="font-bold text-foreground">{user1.humor_and_banter}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${user1.humor_and_banter}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-rose-500">{user2.name}</span>
                      <span className="font-bold text-foreground">{user2.humor_and_banter}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${user2.humor_and_banter}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Deep Communication Dynamics Synthesis */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4" /> Attention & Reciprocity
              </h4>
              <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed font-normal">
                {coeffs?.attention_balance_summary}
              </p>
            </div>

            <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                <Compass className="w-4 h-4" /> Topic Reception & Listening
              </h4>
              <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed font-normal">
                {coeffs?.topic_reception_verdict}
              </p>
            </div>

            <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-500 flex items-center gap-1.5">
                <Repeat className="w-4 h-4" /> Dialogue Engine
              </h4>
              <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed font-normal">
                {coeffs?.dialogue_driver}
              </p>
            </div>
          </div>

          {/* Actionable Recommendations for Dialogue Balancing */}
          {aiResult.recommendations && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  <span>Dialogue Balancing Recommendations</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Symmetric, constructive growth points tailored to the communicative balance of each participant
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {[
                  { name: user1.name, rec: aiResult.recommendations.participant_1, userColor: 'border-blue-500/30', headerColor: 'text-blue-500' },
                  { name: user2.name, rec: aiResult.recommendations.participant_2, userColor: 'border-rose-500/30', headerColor: 'text-rose-500' },
                ].map(({ name, rec, userColor, headerColor }, idx) => (
                  <div
                    key={idx}
                    className={`rounded-3xl border ${userColor} bg-card p-6 shadow-xs flex flex-col justify-between space-y-5`}
                  >
                    <div className="space-y-4">
                      {/* Participant Header */}
                      <div className="flex items-center justify-between border-b border-border/50 pb-3">
                        <span className={`text-base font-extrabold flex items-center gap-2 ${headerColor}`}>
                          <Crown className="w-4 h-4 text-amber-500" />
                          <span>{name}</span>
                        </span>
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Participant #{idx + 1}
                        </span>
                      </div>

                      {/* Focus Statement */}
                      <div className="p-3.5 rounded-2xl bg-secondary/50 border border-border/60 space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                          <Target className="w-3.5 h-3.5" />
                          <span>Core Growth Focus</span>
                        </div>
                        <p className="text-xs sm:text-sm text-foreground/95 font-medium leading-relaxed">
                          {rec.focus}
                        </p>
                      </div>

                      {/* Recommended (Dos) */}
                      {rec.dos && rec.dos.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-500">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Recommended Actions</span>
                          </div>
                          <ul className="space-y-1.5">
                            {rec.dos.map((item, dIdx) => (
                              <li
                                key={dIdx}
                                className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/15 text-xs sm:text-sm text-foreground/90 leading-relaxed"
                              >
                                <span className="text-emerald-500 font-bold shrink-0 mt-0.5">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Risk Zones (Donts) */}
                      {rec.donts && rec.donts.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-500">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Friction Patterns to Avoid</span>
                          </div>
                          <ul className="space-y-1.5">
                            {rec.donts.map((item, dIdx) => (
                              <li
                                key={dIdx}
                                className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/15 text-xs sm:text-sm text-muted-foreground leading-relaxed"
                              >
                                <span className="text-amber-500 font-bold shrink-0 mt-0.5">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Communicative Patterns & Evidence */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <span>Key Communicative Patterns & Direct Quotes</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Illustrative conversational evidence distinguishing constructive bonding from friction
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-secondary/50 border border-border text-xs">
                {(['all', 'constructive', 'warning', 'destructive'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setPatternFilter(filter)}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all capitalize cursor-pointer ${
                      patternFilter === filter
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredPatterns.map((pattern, idx) => {
                const badgeStyle =
                  pattern.pattern_type === 'constructive'
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : pattern.pattern_type === 'warning'
                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-500 border-rose-500/20'

                return (
                  <div
                    key={idx}
                    className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${badgeStyle}`}>
                          {pattern.pattern_type}
                        </span>
                        <span className="font-bold text-foreground text-sm">
                          {pattern.pattern_name}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono">Evidence #{idx + 1}</span>
                    </div>

                    {pattern.quote && (
                      <div className="p-3.5 rounded-2xl bg-secondary/50 border border-border/60 text-xs italic text-foreground flex items-start gap-2.5">
                        <Quote className="w-4 h-4 text-primary shrink-0 opacity-70 mt-0.5" />
                        <span className="font-medium">«{pattern.quote.replace(/^«|»$/g, '')}»</span>
                      </div>
                    )}

                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">Analysis:</strong> {pattern.analysis}
                    </p>
                  </div>
                )
              })}

              {filteredPatterns.length === 0 && (
                <div className="p-6 text-center text-xs text-muted-foreground rounded-3xl border border-border bg-card flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span>No instances found matching the current filter.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
