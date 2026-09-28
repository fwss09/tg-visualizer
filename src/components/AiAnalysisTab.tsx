import React, { useState, useEffect } from 'react'
import {
  Sparkles,
  Bot,
  Flame,
  Smile,
  Heart,
  Trophy,
  Quote,
  MessageSquare,
  Key,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react'
import type { TelegramExport } from '@/types/telegram'
import type { AiAnalysisResult } from '@/types/ai'
import { prepareChatLogForAI } from '@/lib/prepareChatLog'
import { formatNumber } from '@/lib/utils'

interface AiAnalysisTabProps {
  rawExportData: TelegramExport
}

const SYSTEM_PROMPT = `You are an expert conversational psychologist, sociologist, and witty dialogue analyst.
Your goal is to conduct a deep, perceptive, slightly witty, yet friendly analysis of the group dynamics, chat vibe, and key participants based on their entire conversation history.

IMPORTANT LANGUAGE INSTRUCTION:
Write the textual content (archetypes, descriptions, topics, awards) in the primary language used in the chat (e.g., if the participants speak Russian/Ukrainian, write in Russian/Ukrainian with authentic slang and humor; if English, write in English). Keep the JSON keys strictly as specified in the schema.

Return strictly a valid JSON object without any markdown code fences.

JSON format:
{
  "chatVibe": "Concise summary of the overall atmosphere and vibe (2-3 sentences)",
  "vibeScore": {
    "warmth": 85, // warmth, support and bonding from 0 to 100
    "humor": 90, // humor, banter and meme frequency from 0 to 100
    "toxicity": 10 // perceived toxicity, sarcasm or friction from 0 to 100
  },
  "dialogueDynamics": "Description of conversation formats: rapid-fire ping-pong, voice-note exchanges, monologues, who supports whom",
  "humorAndStyle": "Humor style, recurring slang, inside jokes, and linguistic quirks in this group",
  "insideJokesAndTopics": [
    {
      "topic": "Name of recurring topic, event, or inside joke",
      "summary": "Brief explanation of what it was and why it mattered"
    }
  ],
  "participants": [
    {
      "name": "Participant name",
      "archetype": "Catchy, witty title/role (e.g., 'The Night Philosopher', 'The Voice Note Maestro', 'The Drama Queen')",
      "characterAnalysis": "Personality and conversational style summary (2-3 sentences)",
      "favoriteHabit": "Prominent habit (e.g., always sends voice notes, replies with questions, uses CAPS)",
      "sampleQuote": "Characteristic quote or representative catchphrase from the chat"
    }
  ],
  "funAwards": [
    {
      "nomination": "Creative award title (e.g., 'Master of Banter', 'Night Owl of the Year')",
      "winner": "Winner name",
      "reason": "Why this participant deserves this award"
    }
  ]
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

  // Direct client-side call to Google Gemini API (completely eliminates Vercel 10s Serverless timeout!)
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
            temperature: 0.7,
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
    setLoadingStep('Formatting and packing 100% of messages...')

    try {
      // 1. Prepare chat log - 100% of messages
      const { logText, exportedMessages } = prepareChatLogForAI(rawExportData)

      setLoadingStep(`Sending all ${formatNumber(exportedMessages)} messages to Gemini...`)

      let result: AiAnalysisResult

      const trimmedKey = apiKey.trim()
      if (trimmedKey) {
        setLoadingStep(`Gemini is reading all ${formatNumber(exportedMessages)} messages (direct stream)...`)
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
    const textToCopy = `✨ AI ANALYSIS REPORT: "${rawExportData.name || 'Telegram Chat'}"
------------------------------------
Vibe: ${aiResult.chatVibe}

Vibe Score:
❤️ Warmth & Support: ${aiResult.vibeScore.warmth}%
😄 Humor & Banter: ${aiResult.vibeScore.humor}%
🌶️ Toxicity & Sarcasm: ${aiResult.vibeScore.toxicity}%

👥 Participants:
${aiResult.participants
  .map(
    (p) =>
      `• ${p.name} — «${p.archetype}»\n  ${p.characterAnalysis}\n  Habit: ${p.favoriteHabit}\n  Quote: ${p.sampleQuote}`
  )
  .join('\n\n')}

🏆 Fun Awards:
${aiResult.funAwards.map((a) => `• ${a.nomination}: ${a.winner} (${a.reason})`).join('\n')}
`
    navigator.clipboard.writeText(textToCopy)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const totalRawMessages = rawExportData.messages?.length || 0

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* 1. Initial State / Not yet analyzed */}
      {!aiResult && (
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-xs relative overflow-hidden">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Full-History AI Psychoanalysis (Gemini)</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Uncover the real vibe, dynamics & archetypes
            </h2>

            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Gemini will read through all{' '}
              <strong className="text-foreground font-semibold">{formatNumber(totalRawMessages)} messages</strong> in{' '}
              <strong className="text-foreground">«{rawExportData.name || 'Chat'}»</strong> to evaluate toxicity,
              craft witty participant dossiers with iconic quotes, and extract recurring inside jokes.
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
                    : 'Enter your Gemini API Key (runs directly in browser, no timeout)'}
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
                    Get a 100% free key at{' '}
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline hover:opacity-80"
                    >
                      Google AI Studio
                    </a>
                    . Directly queried from your browser with zero 10s server timeout limits.
                  </p>
                </div>
              )}
            </div>

            {/* Error banner */}
            {error && (
              <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs text-left flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Analysis failed:</p>
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
                    <span>{loadingStep || 'Analyzing all messages...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Analyze All Messages with AI</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Analysis Results View */}
      {aiResult && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-xs">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm sm:text-base">
                  Conversational Insights: «{rawExportData.name || 'Chat'}»
                </h3>
                <p className="text-xs text-muted-foreground">
                  Analyzed {formatNumber(totalRawMessages)} messages using Gemini 2.5 Flash
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
                <span>{isCopied ? 'Copied!' : 'Copy Report'}</span>
              </button>

              <button
                type="button"
                onClick={runAnalysis}
                disabled={isLoading}
                className="px-3.5 py-1.5 rounded-xl border border-border bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Vibe Score Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Warmth */}
            <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5 text-rose-500">
                  <Heart className="w-4 h-4 fill-rose-500" /> Warmth & Support
                </span>
                <span className="text-foreground text-base font-extrabold">
                  {aiResult.vibeScore.warmth}%
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all duration-700"
                  style={{ width: `${aiResult.vibeScore.warmth}%` }}
                />
              </div>
            </div>

            {/* Humor */}
            <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5 text-amber-500">
                  <Smile className="w-4 h-4" /> Humor & Banter
                </span>
                <span className="text-foreground text-base font-extrabold">
                  {aiResult.vibeScore.humor}%
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-700"
                  style={{ width: `${aiResult.vibeScore.humor}%` }}
                />
              </div>
            </div>

            {/* Toxicity / Sarcasm */}
            <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5 text-purple-500">
                  <Flame className="w-4 h-4" /> Toxicity & Sarcasm
                </span>
                <span className="text-foreground text-base font-extrabold">
                  {aiResult.vibeScore.toxicity}%
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <div
                  className="bg-purple-500 h-full rounded-full transition-all duration-700"
                  style={{ width: `${aiResult.vibeScore.toxicity}%` }}
                />
              </div>
            </div>
          </div>

          {/* Vibe Overview Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Overall Chat Atmosphere
              </h4>
              <p className="text-sm text-foreground/90 leading-relaxed font-medium">
                {aiResult.chatVibe}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Dialogue Dynamics & Flow
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {aiResult.dialogueDynamics}
              </p>
            </div>
          </div>

          {/* Participant Dossiers */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              <span>Participant Dossiers & Archetypes</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aiResult.participants.map((person, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between space-y-3 hover:border-primary/40 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-extrabold text-foreground text-base">{person.name}</h4>
                      <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
                        {person.archetype}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {person.characterAnalysis}
                    </p>

                    <div className="text-xs text-foreground/80 flex items-start gap-1.5 pt-1">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>
                        <strong>Habit:</strong> {person.favoriteHabit}
                      </span>
                    </div>
                  </div>

                  {person.sampleQuote && (
                    <div className="p-3 rounded-xl bg-secondary/50 border border-border/60 text-xs italic text-foreground/90 flex items-start gap-2">
                      <Quote className="w-4 h-4 text-primary shrink-0 opacity-60" />
                      <span>«{person.sampleQuote.replace(/^«|»$/g, '')}»</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Inside Jokes and Recurring Topics */}
          {aiResult.insideJokesAndTopics && aiResult.insideJokesAndTopics.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Smile className="w-5 h-5 text-amber-500" />
                <span>Inside Jokes & Recurring Topics</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {aiResult.insideJokesAndTopics.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-border bg-card shadow-xs space-y-1.5"
                  >
                    <span className="text-xs font-bold text-primary block">{item.topic}</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fun Awards */}
          {aiResult.funAwards && aiResult.funAwards.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <span>Fun Chat Awards</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {aiResult.funAwards.map((award, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-border/80 bg-gradient-to-br from-card to-secondary/30 shadow-xs flex items-start gap-3"
                  >
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
                      <Trophy className="w-4 h-4" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-foreground">{award.nomination}</span>
                      </div>
                      <div className="text-xs font-semibold text-primary">
                        Winner: {award.winner}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {award.reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
