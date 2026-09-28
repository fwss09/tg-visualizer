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
} from 'lucide-react'
import type { TelegramExport } from '@/types/telegram'
import type { AiAnalysisResult, BoundaryHealth } from '@/types/ai'
import { prepareChatLogForAI } from '@/lib/prepareChatLog'
import { formatNumber } from '@/lib/utils'

interface AiAnalysisTabProps {
  rawExportData: TelegramExport
}

const SYSTEM_PROMPT = `Ты — беспристрастный, опытный аналитик межличностной коммуникации и поведенческих данных.
Твоя задача — объективный, глубокий аудит динамики переписки без эвфемизмов и романтизации, но с четким пониманием человеческой дружбы.

КРИТИЧЕСКИ ВАЖНОЕ РАЗГРАНИЧЕНИЕ ДРУЖБЫ И РЕАЛЬНОГО ДЕСТРУКТИВА:
1. Взаимный трэш-ток, сленг, мат и подколы при симметричном участии ОБОИХ участников — это НЕ токсичность, а неформальный дружеский banter (юмор). ЗАПРЕЩЕНО маркировать обоюдный юмор, стеб и самоиронию как "обесценивание" или "токсичность".
2. Доверительные секреты («боюсь, что расскажешь») и обсуждение глубоких личных переживаний — это нормальная близость и уязвимость, а не «манипуляция» или «шантаж».
3. Просьбы о поддержке и бытовые вопросы допустимы между друзьями, если нет систематического одностороннего игнорирования чужого «НЕТ».
4. Реальными Red Flags и манипуляциями считать ТОЛЬКО:
   - Игру в молчанку или демонстративный холод с целью наказать собеседника (stonewalling);
   - Систематическое обесценивание успехов и эмоциональное вымогательство;
   - Перекладывание вины за собственное настроение («ты виноват, что мне грустно», «ты меня не ценишь»);
   - Нарушение прямо высказанного отказа («хватит», «мне некогда», «я занят»).

Правила анализа:
1. Не путай живую дружбу с абьюзом: если оба шутят жестко и продолжают диалог на равных — это высокий banter и доверие, а не токсичность.
2. Метрики рассчитываются отдельно для каждого участника (user_1 = fwss, user_2 = второй участник), отражая реальный баланс вложений.
3. Оценивай эмоциональную цену (Emotional Cost): сколько искренней заботы вкладывает один, и сколько реальной отдачи дает второй.
4. Опирайся строго на факты и точные дословные цитаты. Если реальных Red Flags нет, не высасывай их из пальца — массив detected_red_flags может быть пустым или содержать только реальные инциденты.

Язык ответа:
Пиши текстовые описания (atmosphere_verdict, analysis, ratio_description, pattern_name) на основном языке общения в чате (русский / украинский), сохраняя аутентичный контекст и терминологию, а ключи JSON оставляй строго на английском в соответствии со схемой.

Верни строго валидный JSON-объект без каких-либо markdown-обёрток.

JSON schema:
{
  "atmosphere_verdict": "string (краткий неромантизированный вердикт о реальном характере динамики)",
  "per_user_metrics": {
    "user_1": {
      "name": "fwss",
      "warmth_and_support": 70, // integer 0-100, искренняя забота и интерес к делам
      "humor_and_banter": 85, // integer 0-100, открытый юмор и дружеский стеб
      "toxicity_and_manipulation": 15, // integer 0-100, реальная пассивная агрессия, качели, обиды
      "emotional_investment": 80 // integer 0-100, объем отданной энергии
    },
    "user_2": {
      "name": "string (имя второго участника)",
      "warmth_and_support": 30, // integer 0-100
      "humor_and_banter": 60, // integer 0-100
      "toxicity_and_manipulation": 25, // integer 0-100
      "emotional_investment": 40 // integer 0-100
    }
  },
  "reciprocity_balance": {
    "ratio_description": "string (соотношение отдачи и потребления внимания)",
    "primary_drain": "string (кто выступает донором внимания, а кто потребителем)"
  },
  "detected_red_flags": [
    {
      "pattern_name": "string (только реальные манипуляции: Наказание молчанием, Нарушение границ занятости, Газлайтинг)",
      "quote": "string (дословная цитата из чата)",
      "analysis": "string (почему это реальный деструктивный паттерн, а не дружеский прикол)"
    }
  ],
  "boundary_health": "High" // Low | Medium | High
}`

export const AiAnalysisTab: React.FC<AiAnalysisTabProps> = ({ rawExportData }) => {
  const [apiKey, setApiKey] = useState<string>('')
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [loadingStep, setLoadingStep] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [aiResult, setAiResult] = useState<AiAnalysisResult | null>(null)
  const [isCopied, setIsCopied] = useState<boolean>(false)

  // Load saved key from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('tg_gemini_api_key')
    if (saved) {
      setApiKey(saved)
    } else {
      setShowKeyInput(true)
    }
  }, [])

  const handleSaveApiKey = (key: string) => {
    setApiKey(key)
    localStorage.setItem('tg_gemini_api_key', key)
  }

  // Direct client-side call to Google Gemini API (bypasses Vercel 10s Serverless timeout)
  const callGeminiDirect = async (cleanLog: string, keyToUse: string): Promise<AiAnalysisResult> => {
    const modelsToTry = ['gemini-2.5-flash', 'gemini-3.8-flash']
    let lastError: string | null = null

    for (const model of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyToUse}`

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
            temperature: 0.3,
            maxOutputTokens: 8192,
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
      let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text

      if (!rawText) {
        lastError = `Model ${model} returned empty content.`
        continue
      }

      rawText = rawText.trim()
      if (rawText.startsWith('```json')) rawText = rawText.slice(7)
      if (rawText.startsWith('```')) rawText = rawText.slice(3)
      if (rawText.endsWith('```')) rawText = rawText.slice(0, -3)

      return JSON.parse(rawText) as AiAnalysisResult
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

      setLoadingStep(`Performing calibrated behavioral audit on ${formatNumber(exportedMessages)} messages...`)

      let result: AiAnalysisResult
      const trimmedKey = apiKey.trim()
      if (trimmedKey) {
        setLoadingStep(`Gemini 2.5 Flash auditing ${formatNumber(exportedMessages)} messages directly...`)
        result = await callGeminiDirect(logText, trimmedKey)
      } else {
        setLoadingStep('Calling backend analyzer...')
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
    const u1 = aiResult.per_user_metrics.user_1
    const u2 = aiResult.per_user_metrics.user_2

    const textToCopy = `📋 CALIBRATED COMMUNICATION & BEHAVIORAL AUDIT: "${rawExportData.name || 'Chat'}"
--------------------------------------------------
Verdict: ${aiResult.atmosphere_verdict}
Boundary Health: ${aiResult.boundary_health}

⚖️ RECIPROCITY BALANCE:
Ratio: ${aiResult.reciprocity_balance.ratio_description}
Dynamics: ${aiResult.reciprocity_balance.primary_drain}

📊 COMPARATIVE METRICS (${u1.name} vs ${u2.name}):
• Warmth & Support: ${u1.name} (${u1.warmth_and_support}%) vs ${u2.name} (${u2.warmth_and_support}%)
• Humor & Banter: ${u1.name} (${u1.humor_and_banter}%) vs ${u2.name} (${u2.humor_and_banter}%)
• Toxicity & Manipulation: ${u1.name} (${u1.toxicity_and_manipulation}%) vs ${u2.name} (${u2.toxicity_and_manipulation}%)
• Emotional Investment: ${u1.name} (${u1.emotional_investment}%) vs ${u2.name} (${u2.emotional_investment}%)

🚩 DETECTED RED FLAGS & FRICTION POINTS:
${aiResult.detected_red_flags.length > 0
  ? aiResult.detected_red_flags
      .map(
        (flag, idx) =>
          `${idx + 1}. [${flag.pattern_name}]\n   Quote: «${flag.quote}»\n   Analysis: ${flag.analysis}`
      )
      .join('\n\n')
  : 'None detected (Healthy boundaries & banter)'}
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

  const user1 = aiResult?.per_user_metrics?.user_1
  const user2 = aiResult?.per_user_metrics?.user_2

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* 1. Initial State / Not yet analyzed */}
      {!aiResult && (
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-xs relative overflow-hidden">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Calibrated Behavioral & Communication Audit</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Objective audit distinguishing healthy banter from real manipulation
            </h2>

            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Audits all{' '}
              <strong className="text-foreground font-semibold">{formatNumber(totalRawMessages)} messages</strong> in{' '}
              <strong className="text-foreground">«{rawExportData.name || 'Chat'}»</strong>. Distinguishes consensual
              humor, swearing, and teasing from genuine red flags (stonewalling, emotional drain, broken boundaries).
            </p>

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
                    Get a free key at{' '}
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline hover:opacity-80"
                    >
                      Google AI Studio
                    </a>
                    . Queried directly from your browser with zero 10s server timeout limits.
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
                    <ShieldAlert className="w-4 h-4" />
                    <span>Run Calibrated Communication Audit</span>
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
                  Calibrated behavioral assessment based on {formatNumber(totalRawMessages)} messages
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
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
                className="px-3.5 py-1.5 rounded-xl border border-border bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Re-Audit</span>
              </button>
            </div>
          </div>

          {/* Verdict and Boundary Health Banner */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" /> Dynamics & Atmosphere Verdict
              </h4>
              {getBoundaryHealthBadge(aiResult.boundary_health)}
            </div>

            <p className="text-sm sm:text-base text-foreground/95 leading-relaxed font-medium">
              {aiResult.atmosphere_verdict}
            </p>
          </div>

          {/* Reciprocity Balance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4" /> Attention Ratio & Reciprocity
              </h4>
              <p className="text-sm text-foreground/90 leading-relaxed">
                {aiResult.reciprocity_balance.ratio_description}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                <Zap className="w-4 h-4" /> Energy Drain & Donor Dynamics
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {aiResult.reciprocity_balance.primary_drain}
              </p>
            </div>
          </div>

          {/* Side-by-Side Comparative Metrics */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Scale className="w-5 h-5 text-primary" />
                  <span>Side-by-Side Behavioral Metrics</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Direct asymmetry comparison distinguishing friendly banter from real friction
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
              {/* 1. Warmth & Support */}
              <div className="space-y-3 p-4 rounded-xl bg-secondary/30 border border-border/40">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Heart className="w-4 h-4 text-emerald-500" /> Sincere Warmth & Support
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-blue-500">{user1.name}</span>
                      <span className="font-bold text-foreground">{user1.warmth_and_support}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${user1.warmth_and_support}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-rose-500">{user2.name}</span>
                      <span className="font-bold text-foreground">{user2.warmth_and_support}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${user2.warmth_and_support}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Humor & Banter */}
              <div className="space-y-3 p-4 rounded-xl bg-secondary/30 border border-border/40">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Smile className="w-4 h-4 text-amber-500" /> Open Humor & Friendly Banter
                  </span>
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

              {/* 3. Toxicity & Manipulation */}
              <div className="space-y-3 p-4 rounded-xl bg-secondary/30 border border-border/40">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-rose-500" /> Real Toxicity & Manipulation (Not Banter)
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-blue-500">{user1.name}</span>
                      <span className="font-bold text-foreground">{user1.toxicity_and_manipulation}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${user1.toxicity_and_manipulation}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-rose-500">{user2.name}</span>
                      <span className="font-bold text-foreground">{user2.toxicity_and_manipulation}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${user2.toxicity_and_manipulation}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Emotional Investment */}
              <div className="space-y-3 p-4 rounded-xl bg-secondary/30 border border-border/40">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-purple-500" /> Emotional Investment & Energy
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-blue-500">{user1.name}</span>
                      <span className="font-bold text-foreground">{user1.emotional_investment}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${user1.emotional_investment}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-rose-500">{user2.name}</span>
                      <span className="font-bold text-foreground">{user2.emotional_investment}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${user2.emotional_investment}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Detected Red Flags & Friction Points */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                <span>Detected Red Flags & Friction Points ({aiResult.detected_red_flags.length})</span>
              </h3>
            </div>

            <div className="space-y-3">
              {aiResult.detected_red_flags.map((flag, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-rose-500/20 bg-card p-5 shadow-xs space-y-3 hover:border-rose-500/40 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 font-bold text-xs border border-rose-500/20">
                      {flag.pattern_name}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">Case #{idx + 1}</span>
                  </div>

                  {flag.quote && (
                    <div className="p-3 rounded-xl bg-secondary/50 border border-border/60 text-xs italic text-foreground flex items-start gap-2.5">
                      <Quote className="w-4 h-4 text-rose-500 shrink-0 opacity-70 mt-0.5" />
                      <span className="font-medium">«{flag.quote.replace(/^«|»$/g, '')}»</span>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Analysis:</strong> {flag.analysis}
                  </p>
                </div>
              ))}

              {aiResult.detected_red_flags.length === 0 && (
                <div className="p-6 text-center text-xs text-muted-foreground rounded-2xl border border-border bg-card flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span>No manipulative red flags detected. Conversation dynamics remain within consensual friendly banter and mutual trust.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
