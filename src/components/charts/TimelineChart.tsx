import React, { useState, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts'
import { Calendar } from 'lucide-react'
import type { TimelinePoint, ParticipantStats } from '@/types/telegram'
import { formatNumber } from '@/lib/utils'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'

interface TimelineChartProps {
  days: TimelinePoint[]
  weeks: TimelinePoint[]
  months: TimelinePoint[]
  participants: ParticipantStats[]
}

const PARTICIPANT_PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  '#0284c7',
  '#8b5cf6',
  '#10b981',
]

export const TimelineChart: React.FC<TimelineChartProps> = ({
  days,
  weeks,
  months,
  participants,
}) => {
  const [granularity, setGranularity] = useState<'days' | 'weeks' | 'months'>('weeks')
  const [viewMode, setViewMode] = useState<'total' | 'byUser'>('total')

  const currentData =
    granularity === 'days' ? days : granularity === 'weeks' ? weeks : months

  const topParticipants = useMemo(() => participants.slice(0, 5), [participants])

  // Build shadcn ChartConfig
  const chartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {
      total: {
        label: 'Total Messages',
        color: 'var(--primary)',
      },
    }

    topParticipants.forEach((p, idx) => {
      config[p.name] = {
        label: p.name,
        color: PARTICIPANT_PALETTE[idx % PARTICIPANT_PALETTE.length],
      }
    })

    return config
  }, [topParticipants])

  return (
    <Card className="rounded-2xl border-border bg-card shadow-xs">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
        <div>
          <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <span>Message Dynamics Over Time</span>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            {currentData.length} activity periods across chat history
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Total vs By Member Toggle */}
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-secondary/50 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('total')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                viewMode === 'total'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Total
            </button>
            <button
              type="button"
              onClick={() => setViewMode('byUser')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                viewMode === 'byUser'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              By Member
            </button>
          </div>

          {/* Granularity Selector */}
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-secondary/50 text-xs">
            <button
              type="button"
              onClick={() => setGranularity('days')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                granularity === 'days'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Days
            </button>
            <button
              type="button"
              onClick={() => setGranularity('weeks')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                granularity === 'weeks'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Weeks
            </button>
            <button
              type="button"
              onClick={() => setGranularity('months')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                granularity === 'months'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Months
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        <ChartContainer config={chartConfig} className="w-full h-72 sm:h-80 aspect-auto">
          {viewMode === 'total' ? (
            <AreaChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="fillTimelineTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={20}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => formatNumber(val)}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    formatter={(val) => (
                      <span className="font-semibold text-foreground">
                        {formatNumber(Number(val))} msgs
                      </span>
                    )}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="var(--color-total)"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#fillTimelineTotal)"
              />
            </AreaChart>
          ) : (
            <BarChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={20}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => formatNumber(val)}
              />
              <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
              <ChartLegend content={<ChartLegendContent />} />
              {topParticipants.map((p, idx) => (
                <Bar
                  key={p.id}
                  dataKey={p.name}
                  stackId="a"
                  fill={`var(--color-${p.name})`}
                  radius={idx === topParticipants.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          )}
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
