import { useState, useEffect, useMemo, useRef } from 'react'
import confetti from 'canvas-confetti'
import { toPng } from 'html-to-image'
import { Navbar } from '@/components/Navbar'
import { FileUploader } from '@/components/FileUploader'
import { OverviewCards } from '@/components/OverviewCards'
import { FilterBar } from '@/components/FilterBar'
import { TimelineChart } from '@/components/charts/TimelineChart'
import { ActivityHeatmap } from '@/components/charts/ActivityHeatmap'
import { MembersLeaderboard } from '@/components/charts/MembersLeaderboard'
import { MediaBreakdownChart } from '@/components/charts/MediaBreakdownChart'
import { ChatDynamics } from '@/components/charts/ChatDynamics'
import { WordAndEmojiCloud } from '@/components/charts/WordAndEmojiCloud'
import { BarChart3, Sparkles } from 'lucide-react'
import { AiAnalysisTab } from '@/components/AiAnalysisTab'
import { ChatDrawer } from '@/components/ChatDrawer'
import { analyzeTelegramData } from '@/lib/analyzer'
import type { TelegramExport } from '@/types/telegram'
import type { AiAnalysisResult } from '@/types/ai'

export function App() {
  const [rawExportData, setRawExportData] = useState<TelegramExport | null>(null)
  const [aiAuditResult, setAiAuditResult] = useState<AiAnalysisResult | null>(null)
  const [activeTab, setActiveTab] = useState<'charts' | 'ai'>('charts')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [isExportingImage, setIsExportingImage] = useState(false)
  const [selectedParticipant, setSelectedParticipant] = useState<string>('all')
  const [startDateStr, setStartDateStr] = useState<string>('')
  const [endDateStr, setEndDateStr] = useState<string>('')

  const dashboardRef = useRef<HTMLDivElement>(null)

  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tg_theme')
      if (saved) return saved === 'dark'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return true
  })

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
      localStorage.setItem('tg_theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('tg_theme', 'light')
    }
  }, [isDark])

  const toggleTheme = () => setIsDark((prev) => !prev)

  // Handle file loaded
  const handleFileLoaded = (jsonString: string) => {
    setIsLoading(true)
    setLoadingMessage('Parsing JSON archive...')

    setTimeout(() => {
      try {
        const parsed = JSON.parse(jsonString) as TelegramExport
        if (!parsed || !Array.isArray(parsed.messages)) {
          alert('The file does not contain a valid Telegram export structure (messages[]).')
          setIsLoading(false)
          return
        }

        setLoadingMessage('Analyzing messages and compiling metrics...')
        setRawExportData(parsed)
        setSelectedParticipant('all')
        setStartDateStr('')
        setEndDateStr('')

        // Trigger celebratory confetti
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
        })
      } catch (err) {
        console.error('JSON parse error:', err)
        alert('Failed to parse JSON file. Please ensure the file is not corrupted.')
      } finally {
        setIsLoading(false)
      }
    }, 100)
  }

  // Analyzed data calculation with active filters
  const analyzedData = useMemo(() => {
    if (!rawExportData) return null

    const filterObj = {
      participantId: selectedParticipant,
      startDate: startDateStr ? new Date(`${startDateStr}T00:00:00`) : null,
      endDate: endDateStr ? new Date(`${endDateStr}T23:59:59`) : null,
    }

    return analyzeTelegramData(rawExportData, filterObj)
  }, [rawExportData, selectedParticipant, startDateStr, endDateStr])

  // Reset filters
  const handleResetFilters = () => {
    setSelectedParticipant('all')
    setStartDateStr('')
    setEndDateStr('')
  }

  const hasActiveFilters =
    selectedParticipant !== 'all' || Boolean(startDateStr) || Boolean(endDateStr)

  // Reset all loaded data
  const handleResetData = () => {
    if (window.confirm('Are you sure you want to close the current report and upload another file?')) {
      setRawExportData(null)
      setSelectedParticipant('all')
      setStartDateStr('')
      setEndDateStr('')
    }
  }

  // Export dashboard image as PNG
  const handleExportImage = async () => {
    if (!dashboardRef.current) return
    setIsExportingImage(true)

    try {
      const dataUrl = await toPng(dashboardRef.current, {
        cacheBust: true,
        backgroundColor: isDark ? '#141416' : '#ffffff',
      })
      const link = document.createElement('a')
      const fileName = `telegram-stats-${(rawExportData?.name || 'chat')
        .toLowerCase()
        .replace(/[^a-z0-9]/gi, '-')}.png`
      link.download = fileName
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Failed to export dashboard image:', err)
      alert('Failed to export dashboard image.')
    } finally {
      setIsExportingImage(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors duration-200">
      <Navbar
        chatName={analyzedData?.summary.chatName}
        dateStart={analyzedData?.summary.dateStart}
        dateEnd={analyzedData?.summary.dateEnd}
        participantsCount={analyzedData?.summary.participantsCount}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onResetData={handleResetData}
        onExportImage={handleExportImage}
        isExportingImage={isExportingImage}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!analyzedData ? (
          <FileUploader
            onFileLoaded={handleFileLoaded}
            isLoading={isLoading}
            loadingMessage={loadingMessage}
          />
        ) : (
          <div className="space-y-6 pb-12">
            {/* Tab Switcher */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="inline-flex p-1 rounded-2xl bg-secondary/50 border border-border">
                <button
                  type="button"
                  onClick={() => setActiveTab('charts')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    activeTab === 'charts'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <span>Metrics & Charts</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('ai')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    activeTab === 'ai'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>AI Insights & Vibe</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-extrabold uppercase tracking-wider">
                    Gemini
                  </span>
                </button>
              </div>
            </div>

            {/* Tab 1: Charts Dashboard */}
            {activeTab === 'charts' ? (
              <div ref={dashboardRef} className="space-y-6">
                {/* Filter Bar */}
                <FilterBar
                  participants={analyzedData.participants}
                  selectedParticipant={selectedParticipant}
                  onSelectParticipant={setSelectedParticipant}
                  startDateStr={startDateStr}
                  endDateStr={endDateStr}
                  onStartDateChange={setStartDateStr}
                  onEndDateChange={setEndDateStr}
                  onResetFilters={handleResetFilters}
                  hasActiveFilters={hasActiveFilters}
                />

                {/* Overview KPI Cards */}
                <OverviewCards summary={analyzedData.summary} />

                {/* Timeline Activity Chart */}
                <TimelineChart
                  days={analyzedData.timelineDays}
                  weeks={analyzedData.timelineWeeks}
                  months={analyzedData.timelineMonths}
                  participants={analyzedData.participants}
                />

                {/* Activity Heatmap 7x24 */}
                <ActivityHeatmap
                  heatmap={analyzedData.heatmap}
                  maxCount={analyzedData.maxHeatmapCount}
                />

                {/* Members Leaderboard and Media Breakdown Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <MembersLeaderboard
                      participants={analyzedData.participants}
                      totalMessages={analyzedData.summary.totalMessages}
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <MediaBreakdownChart
                      data={analyzedData.mediaBreakdown}
                      totalMessages={analyzedData.summary.totalMessages}
                    />
                  </div>
                </div>

                {/* Chat Dynamics: Conversation Starters and Replies */}
                <ChatDynamics
                  conversationStarters={analyzedData.conversationStarters}
                  replyRelationships={analyzedData.replyRelationships}
                />

                {/* Emojis and Words Frequency */}
                <WordAndEmojiCloud
                  emojis={analyzedData.topEmojis}
                  words={analyzedData.topWords}
                />
              </div>
            ) : (
              /* Tab 2: AI Analysis */
              rawExportData && (
                <AiAnalysisTab
                  rawExportData={rawExportData}
                  onAnalysisComplete={setAiAuditResult}
                />
              )
            )}
          </div>
        )}
      </main>

      {/* Floating Interactive Chat Drawer with AI */}
      {rawExportData && (
        <ChatDrawer
          rawExportData={rawExportData}
          aiAuditResult={aiAuditResult}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            Telegram Visualizer • Chat history archive analysis <span className="font-mono bg-white/20">result.json</span>
          </p>
          <p className="flex items-center gap-1 font-mono">
            <span>🔒 All computations are processed locally in your browser</span>
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
