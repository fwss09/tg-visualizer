import React from 'react'
import { MessageSquareShare, MessageCircle, ArrowRight } from 'lucide-react'
import type { ReplyRelationship } from '@/types/telegram'
import { formatNumber } from '@/lib/utils'

interface ChatDynamicsProps {
  conversationStarters: { name: string; count: number; percentage: number }[]
  replyRelationships: ReplyRelationship[]
}

export const ChatDynamics: React.FC<ChatDynamicsProps> = ({
  conversationStarters,
  replyRelationships,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 1. Conversation Starters */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-emerald-500" />
              <span>Conversation Starters</span>
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium border border-border">
              Gap &gt; 4h
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Who breaks the silence most frequently and starts a new conversation
          </p>

          <div className="space-y-3">
            {conversationStarters.slice(0, 5).map((starter, idx) => (
              <div key={starter.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-4 text-center font-bold text-muted-foreground text-[11px]">
                      {idx + 1}.
                    </span>
                    <span className="font-semibold text-foreground truncate max-w-[180px]">
                      {starter.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-foreground">{starter.count} times</span>
                    <span className="text-muted-foreground text-[11px]">({starter.percentage}%)</span>
                  </div>
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${starter.percentage}%` }}
                  />
                </div>
              </div>
            ))}

            {conversationStarters.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                Not enough inactivity gaps to detect conversation starters
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 2. Reply Relationships */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2 mb-1">
            <MessageSquareShare className="w-5 h-5 text-primary" />
            <span>Reply Network</span>
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Direct replies exchanged between conversation participants
          </p>

          <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
            {replyRelationships.map((pair, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl border border-border/40 bg-secondary/30 flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-foreground truncate max-w-[100px] sm:max-w-[130px]">
                    {pair.from}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="font-semibold text-foreground truncate max-w-[100px] sm:max-w-[130px]">
                    {pair.to}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-secondary text-primary font-bold shrink-0 border border-border">
                  {formatNumber(pair.count)}
                </span>
              </div>
            ))}

            {replyRelationships.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                No direct replies found in the selected range
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
