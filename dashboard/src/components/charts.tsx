import type { ReactElement } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { formatTokens } from '@/lib/format'

export interface SeriesPoint {
  d: string
  v: number
}

const tokensConfig = {
  v: { label: 'Tokens', color: 'var(--chart-1)' },
} satisfies ChartConfig

function EmptyChartFrame({ height, label }: { height: number; label: string }): ReactElement {
  return (
    <div
      className="flex w-full items-center justify-center rounded-md border border-dashed border-border font-mono text-xs text-muted-foreground"
      style={{ height }}
      role="img"
      aria-label={label}
    >
      {label}
    </div>
  )
}

const xAxisTickFormatter = (s: string): string => s.slice(5)

export function LineChart({
  data,
  h = 140,
  format = formatTokens,
}: {
  data: SeriesPoint[]
  h?: number
  format?: (n: number | null | undefined) => string
}): ReactElement {
  if (data.length === 0) {
    return <EmptyChartFrame height={h} label="No token usage in this window" />
  }
  const yTickFormatter = (v: number): string => format(v)
  return (
    <ChartContainer
      config={tokensConfig}
      className="w-full"
      style={{ height: h, aspectRatio: 'auto' }}
    >
      <AreaChart data={data} accessibilityLayer margin={{ top: 12, right: 8, bottom: 4, left: 4 }}>
        <CartesianGrid
          vertical={false}
          strokeDasharray="2 3"
          stroke="color-mix(in oklch, var(--color-foreground) 16%, transparent)"
        />
        <XAxis
          dataKey="d"
          tickLine={false}
          axisLine={false}
          tickFormatter={xAxisTickFormatter}
          minTickGap={24}
        />
        <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={yTickFormatter} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
        <Area
          dataKey="v"
          type="monotone"
          stroke="var(--color-v)"
          fill="var(--color-v)"
          fillOpacity={0.35}
          strokeWidth={1.5}
        />
      </AreaChart>
    </ChartContainer>
  )
}
