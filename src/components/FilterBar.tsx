import React from 'react'
import { Filter, RotateCcw, User, Calendar as CalendarIcon } from 'lucide-react'
import type { ParticipantStats } from '@/types/telegram'

interface FilterBarProps {
  participants: ParticipantStats[]
  selectedParticipant: string
  onSelectParticipant: (id: string) => void
  startDateStr: string
  endDateStr: string
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  onResetFilters: () => void
  hasActiveFilters: boolean
}

export const FilterBar: React.FC<FilterBarProps> = ({
  participants,
  selectedParticipant,
  onSelectParticipant,
  startDateStr,
  endDateStr,
  onStartDateChange,
  onEndDateChange,
  onResetFilters,
  hasActiveFilters,
}) => {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-xs mb-6">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Title */}
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground shrink-0">
          <Filter className="w-4 h-4 text-primary" />
          <span>Filter data:</span>
        </div>

        {/* Filters Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Participant Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={selectedParticipant}
              onChange={(e) => onSelectParticipant(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-secondary/50 text-foreground text-xs focus:outline-hidden focus:ring-2 focus:ring-ring font-medium"
            >
              <option value="all">All members ({participants.length})</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.messageCount})
                </option>
              ))}
            </select>
          </div>

          {/* Date range filters */}
          <div className="flex items-center gap-1.5 text-xs">
            <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">From:</span>
            <input
              type="date"
              value={startDateStr}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-secondary/50 text-foreground text-xs focus:outline-hidden focus:ring-2 focus:ring-ring"
            />
            <span className="text-muted-foreground">To:</span>
            <input
              type="date"
              value={endDateStr}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-secondary/50 text-foreground text-xs focus:outline-hidden focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Reset button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
