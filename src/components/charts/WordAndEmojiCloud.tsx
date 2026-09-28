import React from 'react'
import { Smile, FileText } from 'lucide-react'
import type { EmojiStat, WordStat } from '@/types/telegram'
import { formatNumber } from '@/lib/utils'

interface WordAndEmojiCloudProps {
  emojis: EmojiStat[]
  words: WordStat[]
}

export const WordAndEmojiCloud: React.FC<WordAndEmojiCloudProps> = ({
  emojis,
  words,
}) => {
  const maxWordCount = words[0]?.count || 1

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 1. Top Emojis */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <Smile className="w-5 h-5 text-amber-500" />
            <span>Top Emojis</span>
          </h2>
          <span className="text-xs text-muted-foreground">{emojis.length} unique</span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Most frequently used emojis and reactions
        </p>

        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
          {emojis.slice(0, 18).map((item, idx) => (
            <div
              key={idx}
              className="p-2 rounded-xl border border-border/40 bg-secondary/30 hover:bg-secondary/60 hover:scale-105 transition-all text-center group cursor-default"
              title={`${item.emoji} — used ${item.count} times`}
            >
              <div className="text-2xl group-hover:scale-110 transition-transform">
                {item.emoji}
              </div>
              <div className="text-[10px] font-semibold text-muted-foreground mt-1">
                {formatNumber(item.count)}
              </div>
            </div>
          ))}

          {emojis.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6 col-span-full">
              No emojis detected in this chat
            </p>
          )}
        </div>
      </div>

      {/* 2. Top Keywords */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <span>Popular Words</span>
          </h2>
          <span className="text-xs text-muted-foreground">Stop words excluded</span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Most frequent words occurring across messages
        </p>

        <div className="flex flex-wrap gap-2 max-h-[220px] overflow-y-auto pr-1">
          {words.slice(0, 30).map((item, idx) => {
            const ratio = item.count / maxWordCount
            const sizeClass =
              ratio > 0.7
                ? 'text-sm font-bold bg-primary text-primary-foreground border-primary shadow-xs'
                : ratio > 0.4
                ? 'text-xs font-semibold bg-secondary text-foreground border-border'
                : 'text-[11px] font-medium bg-secondary/40 text-muted-foreground border-border/40'

            return (
              <span
                key={idx}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all hover:scale-105 ${sizeClass}`}
                title={`Word "${item.word}": ${item.count} times`}
              >
                <span>{item.word}</span>
                <span className="text-[10px] opacity-75">({item.count})</span>
              </span>
            )
          })}

          {words.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6 w-full">
              Not enough text messages to extract frequent keywords
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
