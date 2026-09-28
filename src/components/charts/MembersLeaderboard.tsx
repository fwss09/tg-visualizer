import React, { useState } from 'react'
import {
  Trophy,
  MessageSquare,
  FileText,
  Mic,
  Video,
} from 'lucide-react'
import type { ParticipantStats } from '@/types/telegram'
import { formatNumber, formatDuration } from '@/lib/utils'

interface MembersLeaderboardProps {
  participants: ParticipantStats[]
  totalMessages: number
}

type TabMode = 'messages' | 'characters' | 'audioVideo' | 'avgLength'

export const MembersLeaderboard: React.FC<MembersLeaderboardProps> = ({
  participants,
}) => {
  const [tab, setTab] = useState<TabMode>('messages')

  // Sort participants depending on selected tab
  const sorted = [...participants].sort((a, b) => {
    if (tab === 'messages') return b.messageCount - a.messageCount
    if (tab === 'characters') return b.characterCount - a.characterCount
    if (tab === 'audioVideo') {
      const aTotal = a.voiceDurationSeconds + a.videoNotesDurationSeconds
      const bTotal = b.voiceDurationSeconds + b.videoNotesDurationSeconds
      return bTotal - aTotal
    }
    if (tab === 'avgLength') return b.avgMessageLength - a.avgMessageLength
    return 0
  })

  const topValue =
    tab === 'messages'
      ? sorted[0]?.messageCount || 1
      : tab === 'characters'
      ? sorted[0]?.characterCount || 1
      : tab === 'audioVideo'
      ? (sorted[0]?.voiceDurationSeconds || 0) + (sorted[0]?.videoNotesDurationSeconds || 0) || 1
      : sorted[0]?.avgMessageLength || 1

  const getRankBadge = (index: number) => {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return `${index + 1}`
  }

  // Generates avatar background color based on name string
  const getAvatarColor = (name: string) => {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    const colors = [
      'bg-blue-600',
      'bg-indigo-600',
      'bg-purple-600',
      'bg-rose-600',
      'bg-amber-600',
      'bg-emerald-600',
      'bg-cyan-600',
      'bg-teal-600',
    ]
    return colors[Math.abs(hash) % colors.length]
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
      {/* Header and tab switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span>Members Leaderboard</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Activity ranking of chat participants
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border p-0.5 bg-secondary/50 text-xs">
          <button
            type="button"
            onClick={() => setTab('messages')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              tab === 'messages' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
            }`}
          >
            Messages
          </button>
          <button
            type="button"
            onClick={() => setTab('characters')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              tab === 'characters' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
            }`}
          >
            Characters
          </button>
          <button
            type="button"
            onClick={() => setTab('audioVideo')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              tab === 'audioVideo' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
            }`}
          >
            Voice/Video
          </button>
          <button
            type="button"
            onClick={() => setTab('avgLength')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              tab === 'avgLength' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
            }`}
          >
            Avg Length
          </button>
        </div>
      </div>

      {/* Member rows */}
      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
        {sorted.map((member, index) => {
          const currentVal =
            tab === 'messages'
              ? member.messageCount
              : tab === 'characters'
              ? member.characterCount
              : tab === 'audioVideo'
              ? member.voiceDurationSeconds + member.videoNotesDurationSeconds
              : member.avgMessageLength

          const progressPercent = Math.min(100, Math.round((currentVal / (topValue || 1)) * 100))

          return (
            <div
              key={member.id}
              className="p-3.5 rounded-xl border border-border/50 bg-secondary/20 hover:bg-secondary/40 transition-colors flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-3">
                {/* Left: Avatar, Name, Badges */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 text-center text-sm font-bold shrink-0">
                    {getRankBadge(index)}
                  </span>

                  <div
                    className={`w-9 h-9 rounded-full ${getAvatarColor(
                      member.name
                    )} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs`}
                  >
                    {member.name.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-foreground truncate">{member.name}</p>
                      {member.topEmoji && (
                        <span
                          title={`Favorite emoji: ${member.topEmoji}`}
                          className="text-base select-none shrink-0"
                        >
                          {member.topEmoji}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                      <span>{formatNumber(member.messageCount)} msgs</span>
                      <span>•</span>
                      <span>{member.percentageOfTotal}% of chat</span>
                      {member.voiceNotesCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Mic className="w-3 h-3 text-purple-500" />
                            {member.voiceNotesCount}
                          </span>
                        </>
                      )}
                      {member.videoNotesCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Video className="w-3 h-3 text-emerald-500" />
                            {member.videoNotesCount}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Key metric number */}
                <div className="text-right shrink-0">
                  <p className="text-sm sm:text-base font-extrabold text-foreground">
                    {tab === 'messages' && `${formatNumber(member.messageCount)}`}
                    {tab === 'characters' && `${formatNumber(member.characterCount)} chars`}
                    {tab === 'audioVideo' && formatDuration(currentVal)}
                    {tab === 'avgLength' && `${formatNumber(member.avgMessageLength)} chars`}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {tab === 'messages' && `${member.percentageOfTotal}%`}
                    {tab === 'characters' && `${formatNumber(member.wordCount)} words`}
                    {tab === 'audioVideo' && `${member.voiceNotesCount + member.videoNotesCount} recs`}
                    {tab === 'avgLength' && `per message`}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
