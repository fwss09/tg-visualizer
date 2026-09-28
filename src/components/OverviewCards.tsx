import React from 'react'
import {
  MessageSquare,
  Users,
  Mic,
  Video,
  FileText,
  Clock,
  Image,
  Flame,
  Share2,
} from 'lucide-react'
import type { ChatSummary } from '@/types/telegram'
import { formatNumber, formatDuration } from '@/lib/utils'

interface OverviewCardsProps {
  summary: ChatSummary
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({ summary }) => {
  const totalAudioVideoDuration = summary.totalVoiceDuration + summary.totalVideoNotesDuration

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Messages */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Total Messages</span>
          <div className="p-2 rounded-xl bg-secondary text-primary">
            <MessageSquare className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            {formatNumber(summary.totalMessages)}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              ~{formatNumber(summary.avgMessagesPerDay)}
            </span>
            <span>msgs / day ({summary.daysDuration} days)</span>
          </div>
        </div>
        <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full bg-primary/5 blur-xl pointer-events-none" />
      </div>

      {/* 2. Participants */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Active Members</span>
          <div className="p-2 rounded-xl bg-secondary text-primary">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            {formatNumber(summary.participantsCount)}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Share2 className="w-3.5 h-3.5" />
            <span>{formatNumber(summary.totalReplies)} replies exchanged</span>
          </div>
        </div>
        <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full bg-primary/5 blur-xl pointer-events-none" />
      </div>

      {/* 3. Voice & Video Notes */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Voice & Video Notes</span>
          <div className="p-2 rounded-xl bg-secondary text-primary flex items-center gap-1">
            <Mic className="w-3.5 h-3.5" />
            <Video className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            {formatDuration(totalAudioVideoDuration)}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{summary.totalVoiceNotes} voice</span>
            <span>•</span>
            <span>{summary.totalVideoNotes} video notes</span>
          </div>
        </div>
        <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full bg-primary/5 blur-xl pointer-events-none" />
      </div>

      {/* 4. Peak Activity */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Peak Activity</span>
          <div className="p-2 rounded-xl bg-secondary text-amber-500">
            <Flame className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            {summary.mostActiveDayOfWeek}, {summary.mostActiveHour}:00
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Busiest chatting time</span>
          </div>
        </div>
        <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full bg-amber-500/5 blur-xl pointer-events-none" />
      </div>

      {/* 5. Words and characters */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs sm:col-span-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FileText className="w-4 h-4 text-emerald-500" />
            <span>Text Volume</span>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-foreground border border-border">
            {formatNumber(summary.totalWords)} words
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <p className="text-xl sm:text-2xl font-bold text-foreground">
            {formatNumber(summary.totalCharacters)}{' '}
            <span className="text-sm font-normal text-muted-foreground">characters</span>
          </p>
          <p className="text-xs text-muted-foreground">
            ~{summary.totalMessages > 0 ? Math.round(summary.totalCharacters / summary.totalMessages) : 0} chars / msg
          </p>
        </div>
      </div>

      {/* 6. Media summary */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs sm:col-span-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Image className="w-4 h-4 text-rose-500" />
            <span>Media & Attachments</span>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-foreground border border-border">
            {formatNumber(summary.totalMedia)} items
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-xs mt-1">
          <div className="p-1.5 rounded-lg bg-secondary/50">
            <p className="font-bold text-foreground">{formatNumber(summary.totalPhotos)}</p>
            <p className="text-[11px] text-muted-foreground">Photos</p>
          </div>
          <div className="p-1.5 rounded-lg bg-secondary/50">
            <p className="font-bold text-foreground">{formatNumber(summary.totalStickers)}</p>
            <p className="text-[11px] text-muted-foreground">Stickers</p>
          </div>
          <div className="p-1.5 rounded-lg bg-secondary/50">
            <p className="font-bold text-foreground">{formatNumber(summary.totalVideos)}</p>
            <p className="text-[11px] text-muted-foreground">Videos</p>
          </div>
          <div className="p-1.5 rounded-lg bg-secondary/50">
            <p className="font-bold text-foreground">{formatNumber(summary.totalFiles)}</p>
            <p className="text-[11px] text-muted-foreground">Files</p>
          </div>
        </div>
      </div>
    </div>
  )
}
