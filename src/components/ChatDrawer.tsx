import React, { useState, useEffect, useRef } from 'react'
import {
  Sparkles,
  Bot,
  Send,
  X,
  RotateCcw,
  Copy,
  Check,
  AlertTriangle,
  User,
  Key,
  Flame,
  HelpCircle,
  MessageSquare,
} from 'lucide-react'
import type { TelegramExport } from '@/types/telegram'
import type { AiAnalysisResult } from '@/types/ai'
import { prepareChatLogForAI } from '@/lib/prepareChatLog'
import { GEMINI_MODELS } from '@/components/AiAnalysisTab'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ChatDrawerProps {
  rawExportData: TelegramExport
  aiAuditResult?: AiAnalysisResult | null
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: Date
}

const DEFAULT_SUGGESTIONS = [
  'В какой период общение стало более сухим или напряженным и почему?',
  'Из-за каких тем или поводов чаще всего возникали споры и недопонимания?',
  'Найди 3 самых искренних и теплых момента взаимной поддержки в переписке.',
  'Кто из участников проявляет больше инициативы и эмоциональной отдачи?',
  'Что можно написать собеседнику сейчас, чтобы оживить и утеплить контакт?',
]

export const ChatDrawer: React.FC<ChatDrawerProps> = ({ rawExportData, aiAuditResult }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [selectedModel, setSelectedModel] = useState('gemini-3.8-flash')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showKeyInput, setShowKeyInput] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load API key and model on mount / drawer open
  useEffect(() => {
    const savedKey = localStorage.getItem('tg_gemini_api_key') || ''
    setApiKey(savedKey)

    const savedModel = localStorage.getItem('tg_chat_model') || localStorage.getItem('tg_gemini_model')
    if (savedModel && GEMINI_MODELS.some((m) => m.id === savedModel)) {
      setSelectedModel(savedModel)
    } else {
      setSelectedModel('gemini-3.8-flash')
    }
  }, [isOpen])

  // Scroll to bottom on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading, isOpen])

  // Handle escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleSaveApiKey = (key: string) => {
    setApiKey(key)
    localStorage.setItem('tg_gemini_api_key', key)
  }

  const handleModelChange = (modelId: string | null) => {
    if (!modelId) return
    setSelectedModel(modelId)
    localStorage.setItem('tg_chat_model', modelId)
  }

  const handleClearHistory = () => {
    if (window.confirm('Очистить историю текущего диалога с ИИ?')) {
      setMessages([])
      setError(null)
    }
  }

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const buildSystemPrompt = (cleanLog: string): string => {
    let auditContext = ''
    if (aiAuditResult) {
      const u1 = aiAuditResult.participants?.user_1 || aiAuditResult.per_user_metrics?.user_1
      const u2 = aiAuditResult.participants?.user_2 || aiAuditResult.per_user_metrics?.user_2
      auditContext = `
ПРЕДВАРИТЕЛЬНЫЙ АУДИТ ДИАЛОГА:
- Общий вайб: ${aiAuditResult.relationship_vibe || 'N/A'}
- Вердикт атмосферы: ${aiAuditResult.atmosphere_verdict || 'N/A'}
- Тандем-суперсила: ${aiAuditResult.tandem_superpower || 'N/A'}
- ${u1?.name || 'Участник 1'}: титул «${u1?.badge?.title}», ROI внимания: ${u1?.attention_roi_multiplier}x
- ${u2?.name || 'Участник 2'}: титул «${u2?.badge?.title}», ROI внимания: ${u2?.attention_roi_multiplier}x
- Баланс внимания: ${aiAuditResult.communication_coefficients?.attention_balance_summary || 'N/A'}
`
    }

    return `Ты — высококвалифицированный персональный консультант и аналитик межличностной коммуникации.
У тебя есть доступ к ПОЛНОМУ тексту переписки из Telegram-чата «${rawExportData.name || 'Telegram Chat'}».

${auditContext}

ПРАВИЛА И СТИЛЬ ОТВЕТОВ:
1. Отвечай прямо, точно, глубоко и объективно на основе РЕАЛЬНЫХ фактов и цитат из переписки.
2. При анализе конкретных ситуаций или утверждений ВСЕГДА приводи короткие дословные цитаты с датой/временем и указанием автора: e.g. [2024-03-12] Автор: "цитата".
3. Не придумывай того, чего не было в чате. Если информации о чем-то в переписке нет, прямо скажи об этом.
4. Тон: эмпатичный, уважительный, психологически чуткий, но честный и непредвзятый.
5. Пиши на русском языке с понятным форматированием (абзацы, списки, выделение ключевых мыслей).

ПОЛНЫЙ ЛОГ СООБЩЕНИЙ ЧАТА:
${cleanLog}
`
  }

  const handleSendMessage = async (textToSend?: string) => {
    const question = (textToSend || input).trim()
    if (!question || isLoading) return

    const keyToUse = apiKey.trim()
    if (!keyToUse) {
      setShowKeyInput(true)
      setError('Пожалуйста, введите Gemini API Key для отправки вопросов.')
      return
    }

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: question,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg])
    if (!textToSend) setInput('')
    setIsLoading(true)
    setError(null)

    try {
      const { logText } = prepareChatLogForAI(rawExportData)
      const systemInstruction = buildSystemPrompt(logText)

      // Conversation history for context (last 6 messages)
      const recentHistory = messages.slice(-6).map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }))

      const payloadContents = [
        {
          role: 'user',
          parts: [{ text: systemInstruction }],
        },
        {
          role: 'model',
          parts: [{ text: 'Понял задачу. Я внимательно изучил весь лог переписки и готов ответить на любые вопросы по диалогу.' }],
        },
        ...recentHistory,
        {
          role: 'user',
          parts: [{ text: question }],
        },
      ]

      const fallbackList = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-pro']
      const modelsToTry = [selectedModel, ...fallbackList.filter((m) => m !== selectedModel)]
      let lastError: string | null = null
      let replyText = ''

      for (const model of modelsToTry) {
        const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${keyToUse}`

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: payloadContents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: model.includes('1.5') ? 8192 : 16384,
            },
          }),
        })

        if (response.status === 503 || response.status === 429) {
          lastError = `Модель ${model} временно занята (${response.status}), переключаюсь на резервную...`
          continue
        }

        if (!response.ok) {
          const errBody = await response.text()
          lastError = `Ошибка Gemini API (${response.status}): ${errBody}`
          continue
        }

        const data = await response.json()
        const parts = data?.candidates?.[0]?.content?.parts
        const nonThought = Array.isArray(parts) ? parts.filter((p: any) => !p.thought && typeof p.text === 'string') : []
        const toUse = nonThought.length > 0 ? nonThought : (Array.isArray(parts) ? parts : [])
        replyText = toUse.map((p: any) => p.text || '').join('')

        if (replyText.trim()) {
          break
        }
      }

      if (!replyText.trim()) {
        throw new Error(lastError || 'Не удалось получить ответ от ИИ. Проверьте API ключ или сеть.')
      }

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: replyText.trim(),
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (err: any) {
      console.error('Chat error:', err)
      setError(err?.message || 'Ошибка при отправке вопроса к ИИ.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Render markdown-like text with bold and quotes
  const formatMessageText = (text: string) => {
    return text.split('\n').map((line, idx) => {
      // Quote line
      if (line.startsWith('>')) {
        return (
          <p key={idx} className="border-l-2 border-primary/50 pl-3 py-0.5 my-1 text-xs italic opacity-90">
            {line.replace(/^>\s*/, '')}
          </p>
        )
      }

      // Parse bold **text**
      const parts = line.split(/(\*\*[^*]+\*\*)/g)
      return (
        <p key={idx} className={line.trim() === '' ? 'h-2' : 'min-h-[1.25rem]'}>
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} className="font-semibold text-foreground">
                  {part.slice(2, -2)}
                </strong>
              )
            }
            return part
          })}
        </p>
      )
    })
  }

  const totalRawMessages = rawExportData?.messages?.length || 0

  return (
    <>
      {/* 1. Floating Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 group flex items-center gap-2.5 px-4 py-3 rounded-full bg-primary text-primary-foreground font-bold text-xs sm:text-sm shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border border-primary-foreground/10"
        title="Спросить у ИИ по этой переписке"
      >
        <div className="relative">
          <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
          </span>
        </div>
        <span>Спросить ИИ по чату</span>
      </button>

      {/* 2. Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-background/60 backdrop-blur-xs z-50 transition-opacity animate-fade-in"
        />
      )}

      {/* 3. Sliding Drawer Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[460px] bg-card border-l border-border shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-foreground truncate flex items-center gap-1.5">
                <span>ИИ-Ассистент по чату</span>
              </h3>
              <p className="text-[11px] text-muted-foreground truncate">
                «{rawExportData.name || 'Диалог'}» • {totalRawMessages} сообщений в памяти
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                title="Очистить историю"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
              title="Закрыть"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Model Selector Bar */}
        <div className="px-4 py-2 border-b border-border/60 bg-secondary/30 flex items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium text-[11px]">Модель:</span>
          </div>

          <div className="w-48">
            <Select value={selectedModel} onValueChange={(val) => handleModelChange(val as string)}>
              <SelectTrigger className="h-7 text-[11px] bg-background border-border/80 rounded-lg px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Модели Gemini</SelectLabel>
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
        </div>

        {/* Key Warning / Input */}
        {(!apiKey || showKeyInput) && (
          <div className="p-3 bg-secondary/50 border-b border-border text-xs space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                <Key className="w-3 h-3 text-primary" /> Gemini API Key:
              </span>
              {apiKey && (
                <button
                  type="button"
                  onClick={() => setShowKeyInput(false)}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Скрыть
                </button>
              )}
            </div>
            <input
              type="password"
              placeholder="AIzaSy... или Vertex Express Key"
              value={apiKey}
              onChange={(e) => handleSaveApiKey(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Welcome Screen when empty */}
          {messages.length === 0 && (
            <div className="py-6 px-2 space-y-5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-xs">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>

              <div className="space-y-1.5 max-w-xs mx-auto">
                <h4 className="font-extrabold text-foreground text-sm">
                  Задайте любой вопрос по переписке
                </h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  ИИ держит в памяти всю переписку целиком и ответит на вопросы с точными цитатами и датами.
                </p>
              </div>

              {/* Suggestions */}
              <div className="pt-2 text-left space-y-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block px-1">
                  Быстрые вопросы:
                </span>
                <div className="space-y-1.5">
                  {DEFAULT_SUGGESTIONS.map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(suggestion)}
                      className="w-full text-left p-2.5 rounded-xl bg-secondary/50 hover:bg-secondary border border-border/70 hover:border-primary/40 text-foreground text-[11px] leading-relaxed transition-all cursor-pointer flex items-start gap-2"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{suggestion}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Active messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-1`}
            >
              <div
                className={`max-w-[88%] p-3 rounded-2xl text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tr-xs'
                    : 'bg-secondary/70 border border-border/70 text-foreground rounded-tl-xs space-y-1.5'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                ) : (
                  <div>{formatMessageText(msg.text)}</div>
                )}
              </div>

              {/* Timestamp & actions */}
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
                <span>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.role === 'assistant' && (
                  <button
                    type="button"
                    onClick={() => handleCopyMessage(msg.id, msg.text)}
                    className="p-1 hover:text-foreground transition-colors cursor-pointer"
                    title="Копировать ответ"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Loading bubble */}
          {isLoading && (
            <div className="flex items-start gap-2 text-xs">
              <div className="p-3 rounded-2xl rounded-tl-xs bg-secondary/70 border border-border/70 text-muted-foreground flex items-center gap-2">
                <span className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                </span>
                <span className="text-[11px]">Анализирую переписку...</span>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-[11px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="font-semibold">Не удалось получить ответ:</p>
                <p className="opacity-90">{error}</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <div className="p-3 border-t border-border bg-card shrink-0 space-y-2">
          <div className="relative flex items-end gap-2 bg-secondary/40 border border-border/80 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 rounded-2xl p-1.5 transition-all">
            <textarea
              ref={textareaRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Спросите что-нибудь по переписке... (Enter для отправки)"
              disabled={isLoading}
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/60 text-xs px-2.5 py-1.5 resize-none focus:outline-none max-h-28"
            />
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || isLoading}
              className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
              title="Отправить вопрос"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
            <span>Shift + Enter для переноса строки</span>
            <button
              type="button"
              onClick={() => setShowKeyInput(!showKeyInput)}
              className="hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
            >
              <Key className="w-3 h-3" />
              <span>{apiKey ? 'Ключ сохранен' : 'Ввести ключ API'}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
