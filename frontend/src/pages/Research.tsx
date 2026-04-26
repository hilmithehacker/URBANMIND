import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import {
  Search, Loader2, Send, Sparkles, Save, ExternalLink, FileText, BookOpen,
  Copy, Download, Filter, ArrowUpDown, CheckSquare, Square, FlaskConical, Brain,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'

type ReadingStatus = 'to-read' | 'reading' | 'reviewed' | 'used'
type TabKey = 'search' | 'saved' | 'matrix' | 'gap' | 'draft' | 'evidence'
type CitationStyle = 'APA' | 'IEEE' | 'Chicago'
type ViewMode = 'compact' | 'detailed'
type ResultSort = 'relevance' | 'year-desc' | 'year-asc'

type Paper = {
  id: string
  title: string
  authors: string[]
  year: number | null
  journal: string
  abstract: string
  url: string
  pdfUrl: string
  isOpenAccess: boolean
  doi?: string
  method?: string
  sampleSize?: string
  outcome?: string
}

type ChatMsg = {
  id: string
  role: 'user' | 'assistant'
  content: string
  paperId?: string
  tag?: string
}

type GapCard = {
  id: string
  title: string
  gap: string
  novelty: string
  rq: string
  hypothesis: string
  priority: number
}

type PaperInsight = {
  method: string
  gap: string
  weakness: string
  bestPractice: string
}

const api = axios.create({ baseURL: '/api/literature' })
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function normalizeResults(payload: any): Paper[] {
  const arr =
    payload?.data?.data ||
    payload?.data?.items ||
    payload?.data?.results ||
    payload?.items ||
    payload?.results ||
    []
  return Array.isArray(arr) ? arr : []
}

function parseMethodFromAbstract(a = ''): string {
  const x = a.toLowerCase()
  if (x.includes('regression')) return 'Regression'
  if (x.includes('survey')) return 'Survey'
  if (x.includes('case study')) return 'Case Study'
  if (x.includes('machine learning')) return 'Machine Learning'
  if (x.includes('qualitative')) return 'Qualitative'
  return 'Not specified'
}

function heuristicInsightFromPaper(p: Paper): PaperInsight {
  const method = p.method || parseMethodFromAbstract(p.abstract)
  const abs = (p.abstract || '').toLowerCase()
  const hasLimit = abs.includes('limit') || abs.includes('keterbatasan') || abs.includes('however') || abs.includes('namun')
  const hasPolicy = abs.includes('policy') || abs.includes('kebijakan')
  const hasSpatial = abs.includes('spatial') || abs.includes('wilayah') || abs.includes('urban')
  const hasTime = abs.includes('longitudinal') || abs.includes('time series') || abs.includes('temporal')

  return {
    method,
    gap: hasTime ? 'Perlu validasi lintas wilayah/kelompok untuk memperkuat generalisasi.' : 'Belum terlihat evaluasi longitudinal yang kuat pada konteks berbeda.',
    weakness: hasLimit ? 'Studi menyebutkan keterbatasan; perlu kontrol confounding dan validasi eksternal.' : 'Potensi bias sampel/variabel belum dijelaskan lengkap.',
    bestPractice: `${hasPolicy ? 'Integrasi kebijakan lokal' : 'Integrasi variabel konteks'}${hasSpatial ? ' + analisis spasial' : ' + indikator berbasis lokasi'} untuk keputusan yang lebih robust.`,
  }
}

function toAPA(p: Paper) {
  const first = p.authors?.[0] || 'Unknown'
  return `${first}${p.authors?.length > 1 ? ' et al.' : ''} (${p.year || 'n.d.'}). ${p.title}. ${p.journal || ''}. ${p.doi ? `https://doi.org/${p.doi}` : p.url || ''}`
}
function toIEEE(p: Paper) {
  const names = p.authors?.join(', ') || 'Unknown'
  return `${names}, "${p.title}," ${p.journal || ''}, ${p.year || 'n.d.'}. ${p.doi ? `doi: ${p.doi}` : p.url || ''}`
}
function toChicago(p: Paper) {
  const names = p.authors?.join(', ') || 'Unknown'
  return `${names}. "${p.title}." ${p.journal || ''} (${p.year || 'n.d.'}). ${p.doi ? `https://doi.org/${p.doi}` : p.url || ''}`
}
function toBibtex(p: Paper) {
  const key = `${(p.authors?.[0] || 'unknown').split(' ')[0]}${p.year || 'nd'}`
  return `@article{${key},
  title={${p.title || ''}},
  author={${(p.authors || []).join(' and ')}},
  journal={${p.journal || ''}},
  year={${p.year || ''}},
  doi={${p.doi || ''}},
  url={${p.url || ''}}
}`
}
function toRIS(p: Paper) {
  return `TY  - JOUR
TI  - ${p.title || ''}
AU  - ${(p.authors || []).join('\nAU  - ')}
JO  - ${p.journal || ''}
PY  - ${p.year || ''}
DO  - ${p.doi || ''}
UR  - ${p.url || ''}
ER  -`
}

export default function LiteratureResearchHubFinal() {
  const { activeProject } = useApp()
  const toast = useToast()
  const projectId = activeProject?.id || 'default'

  const [activeTab, setActiveTab] = useState<TabKey>('search')

  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState('20')
  const [openAccessOnly, setOpenAccessOnly] = useState(false)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<Paper[]>([])

  const [savedPapers, setSavedPapers] = useState<{ id: string; paper: Paper }[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [readingMap, setReadingMap] = useState<Record<string, ReadingStatus>>({})
  const [notesMap, setNotesMap] = useState<Record<string, string>>({})

  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chat, setChat] = useState<ChatMsg[]>([
    { id: uid(), role: 'assistant', content: 'Halo! Saya siap bantu cari jurnal, membandingkan paper, cek bias, dan menulis draft.', tag: 'system' },
  ])
  const [chatThreadPaperId, setChatThreadPaperId] = useState<string>('all')

  const [citationStyle, setCitationStyle] = useState<CitationStyle>('APA')

  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<string>('')

  const [gapCards, setGapCards] = useState<GapCard[]>([])
  const [draggingGapId, setDraggingGapId] = useState<string | null>(null)

  const [matrixFilter, setMatrixFilter] = useState('')
  const [matrixSort, setMatrixSort] = useState<'year' | 'method' | 'relevance'>('year')

  const [qbTopic, setQbTopic] = useState('')
  const [qbRegion, setQbRegion] = useState('')
  const [qbMethod, setQbMethod] = useState('')
  const [qbYearFrom, setQbYearFrom] = useState('')
  const [qbYearTo, setQbYearTo] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('compact')
  const [resultSort, setResultSort] = useState<ResultSort>('relevance')
  const [insightMap, setInsightMap] = useState<Record<string, PaperInsight>>({})
  const [insightLoadingId, setInsightLoadingId] = useState<string | null>(null)

  useEffect(() => {
    ; (async () => {
      try {
        const res = await api.get(`/saved/${projectId}`)
        const list = res?.data?.data || []
        setSavedPapers(Array.isArray(list) ? list : [])
      } catch {
        // ignore
      }
    })()
  }, [projectId])

  const resultCount = results.length
  const displayedResults = useMemo(() => {
    const cloned = [...results]
    if (resultSort === 'year-desc') {
      cloned.sort((a, b) => (b.year || 0) - (a.year || 0))
      return cloned
    }
    if (resultSort === 'year-asc') {
      cloned.sort((a, b) => (a.year || 0) - (b.year || 0))
      return cloned
    }
    cloned.sort((a, b) => {
      const ar = a.abstract?.length || 0
      const br = b.abstract?.length || 0
      return br - ar
    })
    return cloned
  }, [results, resultSort])
  const selectedPapers = useMemo(
    () => savedPapers.filter((s) => selectedIds.includes(s.paper.id)).map((s) => s.paper),
    [savedPapers, selectedIds]
  )

  const evidenceRows = useMemo(() => {
    const src = selectedPapers.length ? selectedPapers : savedPapers.map((s) => s.paper)
    let rows = src.map((p) => ({
      id: p.id,
      title: p.title,
      year: p.year || 0,
      method: p.method || parseMethodFromAbstract(p.abstract),
      sample: p.sampleSize || '-',
      outcome: p.outcome || (p.abstract?.slice(0, 80) || '-'),
      relevance: p.abstract ? Math.min(100, Math.max(40, 100 - Math.floor(p.abstract.length / 20))) : 50,
    }))
    if (matrixFilter.trim()) {
      const q = matrixFilter.toLowerCase()
      rows = rows.filter((r) =>
        `${r.title} ${r.method} ${r.outcome}`.toLowerCase().includes(q)
      )
    }
    rows.sort((a, b) => {
      if (matrixSort === 'year') return b.year - a.year
      if (matrixSort === 'method') return a.method.localeCompare(b.method)
      return b.relevance - a.relevance
    })
    return rows
  }, [savedPapers, selectedPapers, matrixFilter, matrixSort])

  const filteredChat = useMemo(() => {
    if (chatThreadPaperId === 'all') return chat
    return chat.filter((m) => m.paperId === chatThreadPaperId || m.tag === 'system')
  }, [chat, chatThreadPaperId])

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) return toast.error('Masukkan query dulu')
    setSearching(true)
    try {
      const res = await api.get('/search', { params: { query, limit, openAccessOnly } })
      const list = normalizeResults(res)
      setResults(list)
      if (!list.length) toast.info('Tidak ada hasil')
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Search gagal')
    } finally {
      setSearching(false)
    }
  }

  const handleSmartQueryBuild = () => {
    const terms = [qbTopic, qbRegion, qbMethod].filter(Boolean).join(' ')
    const years = qbYearFrom || qbYearTo ? ` year:${qbYearFrom || '*'}-${qbYearTo || '*'}` : ''
    const synonyms = qbTopic ? ` ("${qbTopic}" OR "${qbTopic} planning" OR "${qbTopic} urban")` : ''
    const q = `${terms}${synonyms}${years}`.trim()
    setQuery(q)
    toast.success('Query builder diterapkan')
  }

  const toggleSelect = (paperId: string) => {
    setSelectedIds((prev) => (prev.includes(paperId) ? prev.filter((x) => x !== paperId) : [...prev, paperId]))
  }

  const savePaper = async (paper: Paper) => {
    try {
      await api.post('/save', { projectId, paper })
      toast.success('Paper disimpan')
      const res = await api.get(`/saved/${projectId}`)
      setSavedPapers(Array.isArray(res?.data?.data) ? res.data.data : [])
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Gagal simpan')
    }
  }

  const appendToChatThread = (paper: Paper, tag: string, content: string) => {
    setChat((prev) => [
      ...prev,
      { id: uid(), role: 'assistant', content: `### ${tag} - ${paper.title}\n\n${content}`, paperId: paper.id, tag },
    ])
    setChatThreadPaperId(paper.id)
  }

  const runCopilot = async (paper: Paper, action: 'Ringkas' | 'Kritik Metode' | 'Ekstrak Variabel' | 'Buat Sitasi' | 'Quality & Bias') => {
    try {
      let prompt = ''
      if (action === 'Ringkas') prompt = `Ringkas paper berikut dalam 5 poin: ${paper.title}\n\n${paper.abstract}`
      if (action === 'Kritik Metode') prompt = `Kritik metode penelitian paper ini (validitas, keterbatasan, risiko bias): ${paper.title}\n\n${paper.abstract}`
      if (action === 'Ekstrak Variabel') prompt = `Ekstrak variabel utama, dependen, independen, indikator dari paper ini:\n${paper.title}\n\n${paper.abstract}`
      if (action === 'Quality & Bias') prompt = `Cek potensi bias: sampel, confounding, validitas eksternal/internal, publication bias.\n${paper.title}\n\n${paper.abstract}`
      if (action === 'Buat Sitasi') {
        const text = `APA:\n${toAPA(paper)}\n\nIEEE:\n${toIEEE(paper)}\n\nChicago:\n${toChicago(paper)}`
        appendToChatThread(paper, 'Citation', text)
        return
      }

      const res = await axios.post('/api/ai/chat', {
        messages: [{ role: 'user', content: prompt }],
        projectContext: activeProject ? `${activeProject.name} (${activeProject.location})` : undefined,
        literatureContext: { paper },
      })
      appendToChatThread(paper, action, res?.data?.data?.text || 'Tidak ada output.')
    } catch {
      appendToChatThread(paper, action, 'Gagal mengambil output AI. Coba ulang lagi.')
    }
  }

  const runAutoReview = async (paper: Paper) => {
    if (insightLoadingId) return
    setInsightLoadingId(paper.id)
    try {
      const prompt = `Analisis paper berikut secara ringkas dalam JSON valid:
{
  "method":"...",
  "gap":"...",
  "weakness":"...",
  "bestPractice":"..."
}
Paper:
Title: ${paper.title}
Year: ${paper.year || 'N/A'}
Journal: ${paper.journal || 'N/A'}
Abstract: ${paper.abstract || 'N/A'}
`
      const res = await axios.post('/api/ai/chat', {
        messages: [{ role: 'user', content: prompt }],
        projectContext: activeProject ? `${activeProject.name} (${activeProject.location})` : undefined,
        literatureContext: { paper }
      })
      const txt = String(res?.data?.data?.text || '').trim()
      const m = txt.match(/\{[\s\S]*\}/)
      let parsed: PaperInsight | null = null
      if (m) {
        try {
          const obj = JSON.parse(m[0])
          if (obj?.method && obj?.gap && obj?.weakness && obj?.bestPractice) parsed = obj
        } catch {
          // fallback below
        }
      }
      const insight = parsed || heuristicInsightFromPaper(paper)
      setInsightMap((prev) => ({ ...prev, [paper.id]: insight }))
      appendToChatThread(
        paper,
        'Auto Review',
        `**Method**: ${insight.method}\n\n**Gap**: ${insight.gap}\n\n**Weakness**: ${insight.weakness}\n\n**Best Practice**: ${insight.bestPractice}`
      )
    } catch {
      const fallback = heuristicInsightFromPaper(paper)
      setInsightMap((prev) => ({ ...prev, [paper.id]: fallback }))
      appendToChatThread(
        paper,
        'Auto Review',
        `**Method**: ${fallback.method}\n\n**Gap**: ${fallback.gap}\n\n**Weakness**: ${fallback.weakness}\n\n**Best Practice**: ${fallback.bestPractice}`
      )
    } finally {
      setInsightLoadingId(null)
    }
  }

  const runCompare = async () => {
    if (selectedPapers.length < 2 || selectedPapers.length > 3) return toast.error('Pilih 2-3 paper')
    setAiLoading(true)
    setActiveTab('matrix')
    try {
      const res = await api.post('/compare', { papers: selectedPapers })
      setAiResult(res?.data?.data?.comparison || 'Tidak ada output compare')
    } catch {
      const fallback = selectedPapers.map((p, i) => `| Paper ${i + 1} | ${p.title} | ${p.method || parseMethodFromAbstract(p.abstract)} |`).join('\n')
      setAiResult(`| Paper | Judul | Metode |\n|---|---|---|\n${fallback}`)
    } finally {
      setAiLoading(false)
    }
  }

  const generateGapBoard = async () => {
    if (!selectedPapers.length) return toast.error('Pilih paper dulu')
    setAiLoading(true)
    setActiveTab('gap')
    try {
      const res = await api.post('/gap-board', { papers: selectedPapers })
      const cards = res?.data?.data?.cards
      if (Array.isArray(cards) && cards.length) {
        setGapCards(cards.map((c: any, i: number) => ({ ...c, id: c.id || uid(), priority: i + 1 })))
      } else {
        throw new Error()
      }
    } catch {
      setGapCards(
        selectedPapers.slice(0, 4).map((p, i) => ({
          id: uid(),
          title: p.title,
          gap: 'Belum ada penelitian lintas wilayah dengan data panel jangka panjang.',
          novelty: 'Menggabungkan dimensi spasial + temporal + kebijakan.',
          rq: 'Bagaimana pengaruh intervensi X terhadap outcome Y di wilayah Z?',
          hypothesis: 'Intervensi X berasosiasi positif dengan peningkatan outcome Y.',
          priority: i + 1,
        }))
      )
    } finally {
      setAiLoading(false)
    }
  }

  const onGapDrop = (targetId: string) => {
    if (!draggingGapId || draggingGapId === targetId) return
    const copy = [...gapCards]
    const from = copy.findIndex((c) => c.id === draggingGapId)
    const to = copy.findIndex((c) => c.id === targetId)
    const [moved] = copy.splice(from, 1)
    copy.splice(to, 0, moved)
    setGapCards(copy.map((c, i) => ({ ...c, priority: i + 1 })))
    setDraggingGapId(null)
  }

  const runDraft = async () => {
    if (!selectedPapers.length) return toast.error('Pilih paper dulu')
    setAiLoading(true)
    setActiveTab('draft')
    try {
      const res = await api.post('/draft', { papers: selectedPapers })
      setAiResult(res?.data?.data?.draft || 'Tidak ada draft')
    } catch {
      const refs = selectedPapers.map((p) => `- ${toAPA(p)}`).join('\n')
      setAiResult(
        `## Latar Belakang
Topik ini penting karena gap kebijakan, metode, dan data lintas wilayah masih terbuka.

## State of the Art
Literatur menunjukkan tren positif, namun masih terbatas pada desain cross-sectional.

## Research Gap
Belum banyak studi komparatif longitudinal dengan kontrol confounding yang kuat.

## Kontribusi
Studi ini menawarkan kerangka evaluasi yang lebih robust.

## Referensi
${refs}`)
    } finally {
      setAiLoading(false)
    }
  }

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const msg: ChatMsg = { id: uid(), role: 'user', content: chatInput.trim(), paperId: chatThreadPaperId === 'all' ? undefined : chatThreadPaperId }
    const next = [...chat, msg]
    setChat(next)
    setChatInput('')
    setChatLoading(true)

    try {
      const projectContext = activeProject ? `${activeProject.name} - ${activeProject.location} (${activeProject.type})` : undefined
      const savedLite = savedPapers.slice(0, 15).map((s) => ({
        id: s.paper.id,
        title: s.paper.title,
        year: s.paper.year,
        method: s.paper.method || parseMethodFromAbstract(s.paper.abstract),
      }))
      const res = await axios.post('/api/ai/chat', {
        messages: next.map((m) => ({ role: m.role, content: m.content })),
        projectContext,
        literatureContext: { papers: savedLite, threadPaperId: chatThreadPaperId },
      })
      const text = res?.data?.data?.text || 'Tidak ada respons.'
      setChat([...next, { id: uid(), role: 'assistant', content: text, paperId: msg.paperId }])
    } catch {
      setChat([...next, { id: uid(), role: 'assistant', content: 'Koneksi chatbot bermasalah. Coba lagi.' }])
    } finally {
      setChatLoading(false)
    }
  }

  const removeSaved = async (savedId: string) => {
    try {
      await api.delete(`/saved/${savedId}`)
      setSavedPapers((prev) => prev.filter((x) => x.id !== savedId))
      toast.success('Paper dihapus')
    } catch {
      toast.error('Gagal hapus')
    }
  }

  const exportCSV = () => {
    const header = ['title', 'year', 'method', 'sample', 'outcome', 'relevance']
    const rows = evidenceRows.map((r) => [r.title, r.year, r.method, r.sample, r.outcome, r.relevance])
    const csv = [header, ...rows].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `evidence-matrix-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const exportBib = () => {
    const picks = selectedPapers.length ? selectedPapers : savedPapers.map((s) => s.paper)
    if (!picks.length) return toast.error('Belum ada paper')
    const text = picks.map(toBibtex).join('\n\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `references.bib`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const exportRIS = () => {
    const picks = selectedPapers.length ? selectedPapers : savedPapers.map((s) => s.paper)
    if (!picks.length) return toast.error('Belum ada paper')
    const text = picks.map(toRIS).join('\n\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `references.ris`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const copyCitation = async (paper: Paper) => {
    const text = citationStyle === 'APA' ? toAPA(paper) : citationStyle === 'IEEE' ? toIEEE(paper) : toChicago(paper)
    await navigator.clipboard.writeText(text)
    toast.success('Sitasi disalin')
  }

  return (
    <div className="lit-page">
      <header className="lit-header glass">
        <div className="lit-title">
          <div className="icon"><BookOpen size={18} /></div>
          <div>
            <h1>Research & Literature Copilot</h1>
            <p>Cari jurnal + copilot AI + workspace review literatur</p>
          </div>
        </div>
        <div className="tabs" role="tablist" aria-label="Literature tabs">
          {(['search', 'saved', 'matrix', 'gap', 'draft', 'evidence'] as TabKey[]).map((t) => (
            <button key={t} role="tab" aria-selected={activeTab === t} onClick={() => setActiveTab(t)} className={activeTab === t ? 'tab active' : 'tab'}>
              {t}
            </button>
          ))}
        </div>
      </header>

      <div className="lit-grid">
        <section className="panel glass">
          {activeTab === 'search' && (
            <>
              <div className="panel-head">
                <h2>Cari Jurnal</h2>
                <div className="row">
                  <span className="badge">{resultCount} hasil</span>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => setViewMode((v) => (v === 'compact' ? 'detailed' : 'compact'))}>
                    Mode: {viewMode === 'compact' ? 'Compact' : 'Detailed'}
                  </button>
                </div>
              </div>

              <form onSubmit={handleSearch} className="search-row">
                <div className="search-input">
                  <Search size={15} />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Contoh: transit oriented development jakarta" />
                </div>
                <select value={limit} onChange={(e) => setLimit(e.target.value)}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select>
                <select value={resultSort} onChange={(e) => setResultSort(e.target.value as ResultSort)}><option value="relevance">Relevance</option><option value="year-desc">Year Desc</option><option value="year-asc">Year Asc</option></select>
                <label className="oa"><input type="checkbox" checked={openAccessOnly} onChange={(e) => setOpenAccessOnly(e.target.checked)} />OA only</label>
                <button className="btn btn-primary" type="submit">{searching ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}Search</button>
              </form>

              <div className="query-builder">
                <strong>Smart Query Builder</strong>
                <div className="qb-grid">
                  <input placeholder="Topik" value={qbTopic} onChange={(e) => setQbTopic(e.target.value)} />
                  <input placeholder="Wilayah" value={qbRegion} onChange={(e) => setQbRegion(e.target.value)} />
                  <input placeholder="Metode" value={qbMethod} onChange={(e) => setQbMethod(e.target.value)} />
                  <input placeholder="Tahun dari" value={qbYearFrom} onChange={(e) => setQbYearFrom(e.target.value)} />
                  <input placeholder="Tahun ke" value={qbYearTo} onChange={(e) => setQbYearTo(e.target.value)} />
                  <button className="btn btn-ghost btn-sm" type="button" onClick={handleSmartQueryBuild}>Generate Query</button>
                </div>
              </div>

              <div className={`list ${viewMode === 'compact' ? 'compact' : 'detailed'}`}>
                {displayedResults.length === 0 ? <div className="empty">Belum ada hasil jurnal.</div> : displayedResults.map((p) => {
                  const insight = insightMap[p.id] || heuristicInsightFromPaper(p)
                  return (
                    <article className="card" key={p.id}>
                      <h3>{p.title || 'Untitled'}</h3>
                      <p className="meta">{(p.authors?.length ? p.authors.join(', ') : 'Unknown')} • {p.year || 'N/A'} {p.journal ? `• ${p.journal}` : ''}</p>
                      <p className="abs">{viewMode === 'compact' ? (p.abstract || 'Abstract tidak tersedia.').slice(0, 280) + ((p.abstract || '').length > 280 ? '...' : '') : (p.abstract || 'Abstract tidak tersedia.')}</p>
                      <div className="insight-mini">
                        <span><strong>Metode:</strong> {insight.method}</span>
                        <span><strong>Gap:</strong> {insight.gap}</span>
                      </div>
                      <div className="actions">
                        {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><ExternalLink size={13} />Source</a>}
                        {p.pdfUrl && <a href={p.pdfUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><FileText size={13} />PDF</a>}
                        <button className="btn btn-primary btn-sm" onClick={() => savePaper(p)}><Save size={13} />Save</button>
                      </div>
                      <div className="copilot-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => runCopilot(p, 'Ringkas')}>Ringkas</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => runCopilot(p, 'Kritik Metode')}>Kritik Metode</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => runCopilot(p, 'Ekstrak Variabel')}>Ekstrak Variabel</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => runCopilot(p, 'Quality & Bias')}><FlaskConical size={13} />Bias Check</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => runCopilot(p, 'Buat Sitasi')}>Buat Sitasi</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => runAutoReview(p)} disabled={insightLoadingId === p.id}>
                          {insightLoadingId === p.id ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />} Auto Review
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          )}

          {activeTab === 'saved' && (
            <>
              <div className="panel-head">
                <h2>Saved Papers ({savedPapers.length})</h2>
                <div className="row">
                  <button className="btn btn-ghost btn-sm" onClick={runCompare}>Compare 2-3</button>
                  <button className="btn btn-ghost btn-sm" onClick={generateGapBoard}>Gap Board</button>
                  <button className="btn btn-ghost btn-sm" onClick={runDraft}>One-Click Draft</button>
                </div>
              </div>

              <div className="row" style={{ padding: '8px 12px' }}>
                <select value={citationStyle} onChange={(e) => setCitationStyle(e.target.value as CitationStyle)}>
                  <option>APA</option><option>IEEE</option><option>Chicago</option>
                </select>
                <button className="btn btn-ghost btn-sm" onClick={exportBib}><Download size={13} />.bib</button>
                <button className="btn btn-ghost btn-sm" onClick={exportRIS}><Download size={13} />.ris</button>
              </div>

              <div className="list">
                {savedPapers.length === 0 ? <div className="empty">Belum ada paper tersimpan.</div> : savedPapers.map((s) => (
                  <article className="card" key={s.id}>
                    <div className="row between">
                      <h3>{s.paper.title}</h3>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleSelect(s.paper.id)}>
                        {selectedIds.includes(s.paper.id) ? <CheckSquare size={14} /> : <Square size={14} />} Select
                      </button>
                    </div>
                    <p className="meta">{(s.paper.authors?.length ? s.paper.authors.join(', ') : 'Unknown')} • {s.paper.year || 'N/A'}</p>

                    <div className="row">
                      <select
                        value={readingMap[s.paper.id] || 'to-read'}
                        onChange={(e) => setReadingMap((prev) => ({ ...prev, [s.paper.id]: e.target.value as ReadingStatus }))}
                      >
                        <option value="to-read">To Read</option>
                        <option value="reading">Reading</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="used">Used in Report</option>
                      </select>
                      <button className="btn btn-ghost btn-sm" onClick={() => copyCitation(s.paper)}><Copy size={13} />Copy Citation</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => removeSaved(s.id)}>Remove</button>
                    </div>

                    <textarea
                      placeholder="Notes / highlight..."
                      value={notesMap[s.paper.id] || ''}
                      onChange={(e) => setNotesMap((prev) => ({ ...prev, [s.paper.id]: e.target.value }))}
                    />
                  </article>
                ))}</div>
            </>
          )}

          {activeTab === 'matrix' && (
            <>
              <div className="panel-head"><h2>Compare 2-3 Paper</h2>{aiLoading && <Loader2 className="spin" size={16} />}</div>
              <div className="md-wrap"><ReactMarkdown>{aiResult || 'Klik "Compare 2-3" di tab Saved.'}</ReactMarkdown></div>
            </>
          )}

          {activeTab === 'gap' && (
            <>
              <div className="panel-head"><h2>Research Gap Board</h2>{aiLoading && <Loader2 className="spin" size={16} />}</div>
              <div className="gap-board">
                {gapCards.length === 0 ? <div className="empty">Belum ada gap board. Klik "Gap Board" dari tab Saved.</div> : gapCards.map((g) => (
                  <div
                    key={g.id}
                    className="gap-card"
                    draggable
                    onDragStart={() => setDraggingGapId(g.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onGapDrop(g.id)}
                  >
                    <div className="row between"><strong>Priority #{g.priority}</strong><span className="badge">{g.title.slice(0, 30)}...</span></div>
                    <input value={g.gap} onChange={(e) => setGapCards((prev) => prev.map((x) => x.id === g.id ? { ...x, gap: e.target.value } : x))} />
                    <input value={g.novelty} onChange={(e) => setGapCards((prev) => prev.map((x) => x.id === g.id ? { ...x, novelty: e.target.value } : x))} />
                    <input value={g.rq} onChange={(e) => setGapCards((prev) => prev.map((x) => x.id === g.id ? { ...x, rq: e.target.value } : x))} />
                    <input value={g.hypothesis} onChange={(e) => setGapCards((prev) => prev.map((x) => x.id === g.id ? { ...x, hypothesis: e.target.value } : x))} />
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'draft' && (
            <>
              <div className="panel-head"><h2>One-Click Draft</h2>{aiLoading && <Loader2 className="spin" size={16} />}</div>
              <div className="md-wrap"><ReactMarkdown>{aiResult || 'Klik "One-Click Draft" dari tab Saved.'}</ReactMarkdown></div>
            </>
          )}

          {activeTab === 'evidence' && (
            <>
              <div className="panel-head">
                <h2>Evidence Matrix Interaktif</h2>
                <button className="btn btn-ghost btn-sm" onClick={exportCSV}><Download size={13} />CSV</button>
              </div>
              <div className="row" style={{ padding: '8px 12px' }}>
                <div className="search-mini"><Filter size={13} /><input placeholder="Filter..." value={matrixFilter} onChange={(e) => setMatrixFilter(e.target.value)} /></div>
                <button className="btn btn-ghost btn-sm" onClick={() => setMatrixSort((s) => s === 'year' ? 'method' : s === 'method' ? 'relevance' : 'year')}>
                  <ArrowUpDown size={13} />Sort: {matrixSort}
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Judul</th><th>Tahun</th><th>Metode</th><th>Sample</th><th>Outcome</th><th>Relevance</th></tr></thead>
                  <tbody>
                    {evidenceRows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.title}</td><td>{r.year}</td><td>{r.method}</td><td>{r.sample}</td><td>{r.outcome}</td><td>{r.relevance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <aside className="panel glass chat-panel">
          <div className="panel-head">
            <h2>Project-Aware Chat</h2>
            <div className="row">
              <Brain size={14} />
              <select value={chatThreadPaperId} onChange={(e) => setChatThreadPaperId(e.target.value)}>
                <option value="all">All Threads</option>
                {savedPapers.map((s) => <option key={s.paper.id} value={s.paper.id}>{s.paper.title.slice(0, 28)}</option>)}
              </select>
            </div>
          </div>

          <div className="chat-log">
            {filteredChat.map((m) => (
              <div key={m.id} className={`bubble ${m.role}`}>
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            ))}
            {chatLoading && <div className="loading-row"><Loader2 className="spin" size={14} />AI sedang menulis...</div>}
          </div>

          <div className="chat-input">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder='Contoh: "buat landasan teori bab 2 dari paper terpilih"'
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendChat()
                }
              }}
            />
            <button className="btn btn-primary" onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>
              <Send size={14} />
            </button>
          </div>
        </aside>
      </div>

      <style>{`
        .lit-page{
          height:100%;display:flex;flex-direction:column;
          background:
            radial-gradient(900px 500px at 0% 0%, rgba(56,189,248,.10), transparent 50%),
            radial-gradient(900px 500px at 100% 0%, rgba(129,140,248,.09), transparent 50%),
            var(--bg-primary);
          color:var(--text-primary);
        }
        .glass{
          background: color-mix(in srgb, var(--bg-secondary) 84%, #93c5fd 16%);
          backdrop-filter: blur(10px);
          border:1px solid color-mix(in srgb, var(--border) 75%, #cbd5e1 25%);
          box-shadow:0 10px 26px rgba(15,23,42,.14);
        }
        .lit-header{padding:12px 16px;border-bottom:1px solid var(--border);display:grid;gap:8px}
        .lit-title{display:flex;gap:10px;align-items:center}
        .lit-title .icon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 20%,transparent);color:var(--accent)}
        .lit-title h1{font-size:18px;font-weight:700}
        .lit-title p{font-size:12px;color:var(--text-muted)}
        .tabs{display:flex;gap:6px;flex-wrap:wrap}
        .tab{border:1px solid var(--border);background:var(--bg-primary);border-radius:8px;padding:6px 10px;font-size:12px}
        .tab.active{background:color-mix(in srgb,var(--accent) 18%,var(--bg-primary));border-color:color-mix(in srgb,var(--accent) 45%,var(--border))}
        .lit-grid{flex:1;min-height:0;padding:12px;display:grid;grid-template-columns:1.25fr .85fr;gap:12px}
        .panel{min-height:0;display:flex;flex-direction:column;border-radius:14px;overflow:hidden;border:1px solid var(--border);background:var(--bg-secondary)}
        .panel-head{padding:10px 12px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:8px}
        .panel-head h2{font-size:14px;font-weight:700}
        .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        .between{justify-content:space-between}
        .search-row{padding:10px 12px;border-bottom:1px solid var(--border);display:grid;grid-template-columns:1fr 82px 120px 92px 110px;gap:8px}
        .search-input{display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:10px;padding:0 10px;background:var(--bg-primary)}
        .search-input input,.search-row select,.qb-grid input,.chat-input textarea,.search-mini input,.gap-card input,.card textarea,.row select{
          background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:8px;padding:8px;outline:none
        }
        .search-input input{border:none;padding:0;height:36px;width:100%}
        .oa{display:flex;align-items:center;gap:6px;border:1px solid var(--border);border-radius:10px;padding:0 8px;background:var(--bg-primary)}
        .query-builder{padding:10px 12px;border-bottom:1px solid var(--border);display:grid;gap:8px}
        .qb-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
        .list{flex:1;min-height:0;overflow:auto;padding:10px;display:grid;gap:10px}
        .list.compact .card{padding:9px}
        .list.compact .abs{font-size:12.5px}
        .list.detailed .card{padding:12px}
        .insight-mini{display:grid;gap:4px;padding:8px;border:1px dashed var(--border);border-radius:8px;background:color-mix(in srgb,var(--bg-secondary) 82%,transparent)}
        .insight-mini span{font-size:12px;color:var(--text-secondary)}
        .card{border:1px solid var(--border);border-radius:12px;padding:10px;background:var(--bg-primary);display:grid;gap:8px}
        .card h3{font-size:14px;font-weight:700}
        .meta{font-size:12px;color:var(--text-muted)}
        .abs{font-size:13px;color:var(--text-secondary);line-height:1.55}
        .actions,.copilot-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
        .copilot-actions{justify-content:flex-start;padding-top:4px;border-top:1px dashed var(--border)}
        .badge{font-size:11px;padding:2px 6px;border:1px solid var(--border);border-radius:999px}
        .empty{border:1px dashed var(--border);border-radius:12px;padding:20px;text-align:center;color:var(--text-muted);background:var(--bg-primary)}
        .md-wrap{padding:12px;overflow:auto;flex:1}
        .gap-board{padding:10px;display:grid;gap:10px;overflow:auto;flex:1}
        .gap-card{border:1px solid var(--border);border-radius:10px;padding:8px;display:grid;gap:6px;background:var(--bg-primary);cursor:grab}
        .table-wrap{padding:8px 12px 12px;overflow:auto;flex:1}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid var(--border);padding:8px;text-align:left;vertical-align:top}
        th{background:var(--bg-primary);font-weight:700}
        .search-mini{display:flex;gap:6px;align-items:center;border:1px solid var(--border);border-radius:8px;padding:0 8px;background:var(--bg-primary)}
        .search-mini input{border:none;padding:7px 0}
        .chat-panel .chat-log{
          flex:1;min-height:0;overflow:auto;padding:10px;display:grid;gap:8px;
          background:linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 94%, #7dd3fc 6%), var(--bg-secondary));
        }
        .bubble{max-width:92%;border:1px solid var(--border);border-radius:12px;padding:8px 10px;font-size:13px;line-height:1.5}
        .bubble.assistant{background:var(--bg-primary)}
        .bubble.user{margin-left:auto;background:color-mix(in srgb,var(--accent) 18%,var(--bg-primary))}
        .chat-input{border-top:1px solid var(--border);padding:10px;display:grid;grid-template-columns:1fr auto;gap:8px}
        .chat-input textarea{min-height:46px;max-height:120px;resize:vertical}
        .loading-row{font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px}
        .spin{animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media (max-width: 1280px){.lit-grid{grid-template-columns:1fr}.search-row{grid-template-columns:1fr 82px 1fr 92px 110px}}
        @media (max-width: 860px){.search-row{grid-template-columns:1fr}.qb-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </div>
  )
}




