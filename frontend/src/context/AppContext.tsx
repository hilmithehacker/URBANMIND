import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react'
import { apiGet } from '../services/api'

export interface Project {
  id: string
  name: string
  description: string
  location: string
  type: string
  createdAt: string
  updatedAt: string
  status: 'active' | 'archived'
}

// Parsed data file — shared across all Data sub-tabs and persists across navigation
export interface DataFile {
  fileName: string; fileType: string; sheetName?: string; sheets?: string[]
  rowCount: number; columnCount: number
  headers: string[]; preview: Record<string, any>[]
  stats: Record<string, any>; autoInsight: string; bestCatCol: string
  sampleForAI: Record<string, any>[]
}

interface AppContextType {
  projects: Project[]
  activeProject: Project | null
  setActiveProject: (p: Project | null) => void
  refreshProjects: () => Promise<void>
  loading: boolean
  isBackendOnline: boolean
  dataFile: DataFile | null
  setDataFile: (d: DataFile | null) => void
}

const AppContext = createContext<AppContextType | null>(null)

const HEALTH_INTERVAL_MS = 8000
const FAIL_THRESHOLD = 2
const LOCAL_PROJECTS_KEY = 'urbanmind_projects_v1'
const LOCAL_ACTIVE_PROJECT_KEY = 'urbanmind_active_project_v1'
const LOCAL_DATAFILE_KEY = 'urbanmind_datafile_v1'

export function AppProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_PROJECTS_KEY)
      return raw ? (JSON.parse(raw) as Project[]) : []
    } catch {
      return []
    }
  })
  const [activeProject, setActiveProjectState] = useState<Project | null>(() => {
    try {
      const savedId = localStorage.getItem(LOCAL_ACTIVE_PROJECT_KEY)
      if (!savedId) return null
      const raw = localStorage.getItem(LOCAL_PROJECTS_KEY)
      if (!raw) return null
      const stored = JSON.parse(raw) as Project[]
      return stored.find((p) => p.id === savedId) || null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)
  const [isBackendOnline, setIsBackendOnline] = useState(true)
  const [dataFile, setDataFile] = useState<DataFile | null>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_DATAFILE_KEY)
      return raw ? (JSON.parse(raw) as DataFile) : null
    } catch {
      return null
    }
  })

  const failCountRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const checkHealth = async () => {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4000)
      const res = await fetch('/api/health', { signal: controller.signal })
      clearTimeout(timer)
      const payload = await res.json()
      const ok = res.ok && payload?.data?.status === 'ok'
      if (ok) {
        failCountRef.current = 0
        setIsBackendOnline(true)
      } else {
        failCountRef.current += 1
        if (failCountRef.current >= FAIL_THRESHOLD) setIsBackendOnline(false)
      }
    } catch {
      failCountRef.current += 1
      if (failCountRef.current >= FAIL_THRESHOLD) setIsBackendOnline(false)
    }
  }

  useEffect(() => {
    const initial = setTimeout(checkHealth, 500)
    intervalRef.current = setInterval(checkHealth, HEALTH_INTERVAL_MS)
    return () => {
      clearTimeout(initial)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const refreshProjects = async () => {
    try {
      const remoteProjects = await apiGet<Project[]>('/projects')
      setProjects(remoteProjects || [])
      localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(remoteProjects || []))
      setIsBackendOnline(true)
      failCountRef.current = 0
    } catch {
      const cached = localStorage.getItem(LOCAL_PROJECTS_KEY)
      if (cached) {
        try {
          setProjects(JSON.parse(cached) as Project[])
        } catch {
          setProjects([])
        }
      } else {
        setProjects([])
      }
    } finally {
      setLoading(false)
    }
  }

  const setActiveProject = (project: Project | null) => {
    setActiveProjectState(project)
    if (project) localStorage.setItem(LOCAL_ACTIVE_PROJECT_KEY, project.id)
    else localStorage.removeItem(LOCAL_ACTIVE_PROJECT_KEY)
  }

  useEffect(() => {
    refreshProjects()
  }, [])

  useEffect(() => {
    if (!activeProject && projects.length > 0) {
      const savedId = localStorage.getItem(LOCAL_ACTIVE_PROJECT_KEY)
      if (savedId) {
        const found = projects.find((p) => p.id === savedId)
        if (found) setActiveProjectState(found)
      }
    }
  }, [projects, activeProject])

  useEffect(() => {
    try {
      if (dataFile) {
        localStorage.setItem(LOCAL_DATAFILE_KEY, JSON.stringify(dataFile))
      } else {
        localStorage.removeItem(LOCAL_DATAFILE_KEY)
      }
    } catch {
      // ignore storage errors
    }
  }, [dataFile])

  return (
    <AppContext.Provider value={{ projects, activeProject, setActiveProject, refreshProjects, loading, isBackendOnline, dataFile, setDataFile }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
