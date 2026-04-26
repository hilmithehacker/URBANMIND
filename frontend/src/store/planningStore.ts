import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type PlanningTool = 'potensi_masalah' | 'isu' | 'tujuan' | 'cascading' | 'program' | 'logframe' | 'consistency'

interface PlanningState {
  activeTool: PlanningTool
  setActiveTool: (tool: PlanningTool) => void
  results: Record<PlanningTool, any>
  setResult: (tool: PlanningTool, data: any) => void
  loading: Record<PlanningTool, boolean>
  setLoading: (tool: PlanningTool, isLoading: boolean) => void
  contextData: string
  setContextData: (data: string) => void
}

export const usePlanningStore = create<PlanningState>()(
  persist(
    (set) => ({
      activeTool: 'potensi_masalah',
      setActiveTool: (tool) => set({ activeTool: tool }),
      results: {
        potensi_masalah: null,
        isu: null,
        tujuan: null,
        cascading: null,
        program: null,
        logframe: null,
        consistency: null
      },
      setResult: (tool, data) =>
        set((state) => ({
          results: { ...state.results, [tool]: data }
        })),
      loading: {
        potensi_masalah: false,
        isu: false,
        tujuan: false,
        cascading: false,
        program: false,
        logframe: false,
        consistency: false
      },
      setLoading: (tool, isLoading) =>
        set((state) => ({
          loading: { ...state.loading, [tool]: isLoading }
        })),
      contextData: '',
      setContextData: (data) => set({ contextData: data })
    }),
    {
      name: 'urbanmind-planning-store'
    }
  )
)
