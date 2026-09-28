import React, { useState, useRef } from 'react'
import {
  Upload,
  FileJson,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Clock,
  Sparkles,
  BarChart3,
  Calendar,
  MessageSquare,
} from 'lucide-react'
import { formatBytes } from '@/lib/utils'

interface FileUploaderProps {
  onFileLoaded: (jsonString: string) => void
  isLoading: boolean
  loadingMessage?: string
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFileLoaded,
  isLoading,
  loadingMessage = 'Processing data...',
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [fileDetails, setFileDetails] = useState<{ name: string; size: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = (file: File) => {
    setErrorMessage(null)

    if (!file.name.endsWith('.json')) {
      setErrorMessage('Please select a JSON format file (usually result.json).')
      return
    }

    setFileDetails({ name: file.name, size: file.size })

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      if (!content) {
        setErrorMessage('Failed to read file content.')
        return
      }
      onFileLoaded(content)
    }

    reader.onerror = () => {
      setErrorMessage('Error reading file. Please try again.')
    }

    reader.readAsText(file, 'utf-8')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0])
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-16">
      {/* Hero Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold mb-4 border border-border shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>Analytics & Visualization for Telegram Chats</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-4">
          Discover insights in your{' '}
          <span className="bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent">
            Telegram Chat
          </span>
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
          Upload your chat export <code className="text-primary font-mono font-semibold">result.json</code> to instantly
          generate an interactive analytics dashboard: hourly activity, conversation starters, media breakdown, and top emojis.
        </p>
      </div>

      {/* Upload Box */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        className={`group relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300 ${
          isDragOver
            ? 'border-primary bg-primary/5 ring-4 ring-primary/20 scale-[1.01]'
            : 'border-border hover:border-primary/50 hover:bg-card/70 bg-card/40'
        } ${isLoading ? 'pointer-events-none opacity-80' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleInputChange}
          className="hidden"
        />

        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-4">
            <div className="relative w-16 h-16">
              <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <FileJson className="w-7 h-7 text-primary absolute inset-0 m-auto" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{loadingMessage}</p>
              {fileDetails && (
                <p className="text-xs text-muted-foreground mt-1">
                  {fileDetails.name} ({formatBytes(fileDetails.size)})
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="py-4 flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-secondary text-primary flex items-center justify-center group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 border border-border shadow-xs">
              <Upload className="w-8 h-8" />
            </div>

            <div>
              <p className="text-lg font-semibold text-foreground">
                Drop your <span className="text-primary font-mono">result.json</span> here
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                or click anywhere in this box to select the file from your computer
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium border border-border">
              <FileJson className="w-4 h-4 text-primary" />
              <span>Supports Telegram Desktop JSON export format</span>
            </div>
          </div>
        )}
      </div>

      {/* Error message if any */}
      {errorMessage && (
        <div className="mt-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Privacy Guarantee */}
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
        <span>
          <strong>100% Private:</strong> Your chat archive is parsed entirely in your browser and never leaves your computer.
        </span>
      </div>

      {/* How to export guide */}
      <div className="mt-14 border border-border rounded-2xl p-6 sm:p-8 bg-card/50 shadow-xs">
        <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2 mb-4">
          <HelpCircle className="w-5 h-5 text-primary" />
          <span>How to export chat history in Telegram Desktop</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm">
          <div className="p-4 rounded-xl bg-secondary/40 border border-border/60 flex flex-col gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center text-xs">
              1
            </span>
            <p className="font-semibold text-foreground">Open chat menu</p>
            <p className="text-muted-foreground">
              In Telegram Desktop, open the desired conversation, group, or channel and click the <strong>three dots (⋮)</strong> in the top-right corner.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-secondary/40 border border-border/60 flex flex-col gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center text-xs">
              2
            </span>
            <p className="font-semibold text-foreground">Choose "Export chat history"</p>
            <p className="text-muted-foreground">
              In the dialog that appears, make sure to change the export format from HTML to <strong>JSON (machine-readable)</strong>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-secondary/40 border border-border/60 flex flex-col gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center text-xs">
              3
            </span>
            <p className="font-semibold text-foreground">Upload result.json</p>
            <p className="text-muted-foreground">
              Once the export completes, open the output folder and drag the <strong>result.json</strong> file into the box above.
            </p>
          </div>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="p-3 rounded-xl border border-border/50 bg-card/30">
          <BarChart3 className="w-5 h-5 mx-auto text-primary mb-1.5" />
          <p className="text-xs font-semibold text-foreground">Activity Timeline</p>
          <p className="text-[11px] text-muted-foreground">By days, weeks & months</p>
        </div>
        <div className="p-3 rounded-xl border border-border/50 bg-card/30">
          <Clock className="w-5 h-5 mx-auto text-emerald-500 mb-1.5" />
          <p className="text-xs font-semibold text-foreground">7×24 Heatmap</p>
          <p className="text-[11px] text-muted-foreground">Peak conversation hours</p>
        </div>
        <div className="p-3 rounded-xl border border-border/50 bg-card/30">
          <MessageSquare className="w-5 h-5 mx-auto text-purple-500 mb-1.5" />
          <p className="text-xs font-semibold text-foreground">Voice & Video Notes</p>
          <p className="text-[11px] text-muted-foreground">Duration & media metrics</p>
        </div>
        <div className="p-3 rounded-xl border border-border/50 bg-card/30">
          <Calendar className="w-5 h-5 mx-auto text-amber-500 mb-1.5" />
          <p className="text-xs font-semibold text-foreground">Conversation Starters</p>
          <p className="text-[11px] text-muted-foreground">Who breaks the silence</p>
        </div>
      </div>
    </div>
  )
}
