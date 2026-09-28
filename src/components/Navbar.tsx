import React from 'react'
import {
  Send,
  Moon,
  Sun,
  UploadCloud,
  Download,
  Calendar,
  Users,
} from 'lucide-react'
import { format } from 'date-fns'
import { enUS } from 'date-fns/locale'

interface NavbarProps {
  chatName?: string
  dateStart?: Date | null
  dateEnd?: Date | null
  participantsCount?: number
  isDark: boolean
  onToggleTheme: () => void
  onResetData: () => void
  onExportImage: () => void
  isExportingImage?: boolean
}

export const Navbar: React.FC<NavbarProps> = ({
  chatName,
  dateStart,
  dateEnd,
  participantsCount,
  isDark,
  onToggleTheme,
  onResetData,
  onExportImage,
  isExportingImage = false,
}) => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo and Chat Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-foreground truncate">
                {chatName || 'Telegram Visualizer'}
              </h1>
              {chatName && (
                <span className="hidden sm:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium border border-border">
                  <Users className="w-3 h-3" />
                  {participantsCount}
                </span>
              )}
            </div>
            {dateStart && dateEnd && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                <Calendar className="w-3 h-3 shrink-0" />
                <span>
                  {format(dateStart, 'dd MMM yyyy', { locale: enUS })} —{' '}
                  {format(dateEnd, 'dd MMM yyyy', { locale: enUS })}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {chatName && (
            <>
              <button
                type="button"
                onClick={onExportImage}
                disabled={isExportingImage}
                title="Save dashboard screenshot"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-secondary text-foreground transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExportingImage ? 'Saving...' : 'Export PNG'}</span>
              </button>

              <button
                type="button"
                onClick={onResetData}
                title="Upload another file"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-secondary text-foreground transition-colors cursor-pointer shadow-xs"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Change Chat</span>
              </button>
            </>
          )}

          {/* Dark / Light Mode Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-lg border border-border bg-card hover:bg-secondary text-foreground transition-colors cursor-pointer shadow-xs"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>
        </div>
      </div>
    </header>
  )
}
