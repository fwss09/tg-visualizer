import React, { useMemo } from 'react'
import { PieChart, Pie, Cell } from 'recharts'
import { PieChart as PieIcon } from 'lucide-react'
import type { MediaBreakdownItem } from '@/types/telegram'
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
  type ChartConfig,
} from '@/components/ui/chart'

interface MediaBreakdownChartProps {
  data: MediaBreakdownItem[]
  totalMessages: number
}

export const MediaBreakdownChart: React.FC<MediaBreakdownChartProps> = ({
  data,
  totalMessages,
}) => {
  const chartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {}
    data.forEach((item) => {
      config[item.name] = {
        label: item.name,
        color: item.color,
      }
    })
    return config
  }, [data])

  return (
    <Card className="rounded-2xl border-border bg-card shadow-xs flex flex-col justify-between h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
          <PieIcon className="w-5 h-5 text-primary" />
          <span>Content Structure</span>
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground mt-0.5">
          Ratio of text, photos, video, voice and stickers
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-2 my-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4 py-2">
          {/* Donut Chart with shadcn ChartContainer */}
          <div className="h-52 w-full flex items-center justify-center">
            <ChartContainer config={chartConfig} className="h-52 w-full aspect-square">
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(val, name) => (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {formatNumber(Number(val))}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            ({((Number(val) / (totalMessages || 1)) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </div>

          {/* Legend list */}
          <div className="space-y-2">
            {data.map((item) => {
              const percent = ((item.count / (totalMessages || 1)) * 100).toFixed(1)
              return (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-medium text-foreground">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {formatNumber(item.count)}
                    </span>
                    <span className="text-muted-foreground text-[11px] w-12 text-right">
                      {percent}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
