export type ChartType = 'bar' | 'horizontalBar' | 'line' | 'pie' | 'doughnut' | 'stackedBar'
export type AggFunc = 'sum' | 'count' | 'avg' | 'max' | 'min'
export type AnalysisType = 'general' | 'spatial' | 'trend' | 'comparative' | 'indicator' | 'regression' | 'correlation' | 'descriptive'

export interface ColStat {
  type: 'numeric' | 'categorical'
  count: number
  missing: number
  min?: number; max?: number; mean?: number; std?: number; sum?: number; median?: number
  unique?: number
  topValues?: { value: string; count: number; pct: number }[]
}

export interface ParsedData {
  fileName: string
  fileType: string
  sheetName?: string
  sheets?: string[]
  rowCount: number
  columnCount: number
  headers: string[]
  preview: Record<string, any>[]
  stats: Record<string, ColStat>
  autoInsight: string
  bestCatCol: string
  sampleForAI: Record<string, any>[]
}

export interface ChartConfig {
  type: ChartType
  xCol: string
  yCol: string
  title: string
  color: string
  showLabels: boolean
  sortDir: 'none' | 'asc' | 'desc'
  topN: number
}

export const CHART_COLORS = [
  '#4f8ef7','#a371f7','#3fb950','#f78166','#ffa657',
  '#39d353','#ff7b72','#79c0ff','#d2a8ff','#56d364'
]

export const DEFAULT_CHART_CONFIG: ChartConfig = {
  type: 'bar', xCol: '', yCol: '', title: '',
  color: CHART_COLORS[0], showLabels: true,
  sortDir: 'desc', topN: 20
}
