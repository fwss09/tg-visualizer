import React, { useState } from 'react'
import { Clock, Info } from 'lucide-react'
import type { HeatmapCell } from '@/types/telegram'
import { formatNumber } from '@/lib/utils'

interface ActivityHeatmapProps {
  heatmap: HeatmapCell[][]
  maxCount: number
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  heatmap,
  maxCount,
}) => {
  const [hoveredCell, setHoveredCell] = useState<{
    dayName: string
    hour: number
    count: number
  } | null>(null)

  // Color generator based on intensity
  const getCellColor = (count: number) => {
    if (count === 0) return 'bg-secondary/40'
    const ratio = maxCount > 0 ? count / maxCount : 0
    if (ratio < 0.15) return 'bg-primary/20'
    if (ratio < 0.35) return 'bg-primary/40'
    if (ratio < 0.6) return 'bg-primary/65'
    if (ratio < 0.85) return 'bg-primary/85'
    return 'bg-primary text-primary-foreground font-bold'
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <span>Activity Heatmap (7 Days × 24 Hours)</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Message distribution across days of week and hours of day
          </p>
        </div>

        {/* Hovered cell indicator */}
        <div className="text-xs font-medium px-3 py-1 rounded-lg bg-secondary text-foreground min-h-[28px] flex items-center border border-border">
          {hoveredCell ? (
            <span>
              <strong>{hoveredCell.dayName}</strong> at {String(hoveredCell.hour).padStart(2, '0')}:00 —{' '}
              <strong className="text-primary">{formatNumber(hoveredCell.count)}</strong> msgs
            </span>
          ) : (
            <span className="text-muted-foreground flex items-center gap-1">
              <Info className="w-3.5 h-3.5" /> Hover over any cell
            </span>
          )}
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[620px]">
          {/* Hour labels header */}
          <div className="grid grid-cols-[40px_repeat(24,1fr)] gap-1 mb-1 text-[10px] text-muted-foreground text-center">
            <span />
            {HOURS.map((h) => (
              <span key={h} className={h % 3 === 0 ? 'font-semibold text-foreground' : ''}>
                {h % 3 === 0 ? `${h}` : ''}
              </span>
            ))}
          </div>

          {/* 7 Days rows */}
          <div className="space-y-1">
            {heatmap.map((dayRow, dayIdx) => (
              <div key={dayIdx} className="grid grid-cols-[40px_repeat(24,1fr)] gap-1 items-center">
                <span className="text-xs font-semibold text-muted-foreground pr-2 text-right">
                  {dayRow[0]?.dayName}
                </span>

                {dayRow.map((cell) => (
                  <div
                    key={cell.hour}
                    onMouseEnter={() =>
                      setHoveredCell({
                        dayName: cell.dayName,
                        hour: cell.hour,
                        count: cell.count,
                      })
                    }
                    onMouseLeave={() => setHoveredCell(null)}
                    title={`${cell.dayName} ${cell.hour}:00 — ${cell.count} msgs`}
                    className={`h-6 sm:h-7 rounded-md transition-all duration-150 cursor-pointer ${getCellColor(
                      cell.count
                    )} hover:ring-2 hover:ring-primary hover:scale-110 flex items-center justify-center text-[9px]`}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
            <span>Less</span>
            <div className="flex items-center gap-1">
              <div className="w-3.5 h-3.5 rounded-xs bg-secondary/40 border border-border" />
              <div className="w-3.5 h-3.5 rounded-xs bg-primary/20" />
              <div className="w-3.5 h-3.5 rounded-xs bg-primary/40" />
              <div className="w-3.5 h-3.5 rounded-xs bg-primary/65" />
              <div className="w-3.5 h-3.5 rounded-xs bg-primary" />
            </div>
            <span>More active</span>
          </div>
        </div>
      </div>
    </div>
  )
}
