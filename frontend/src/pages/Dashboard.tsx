import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { FolderOpen, Files, Map, PenTool, FileText, ArrowRight, Plus } from 'lucide-react'
import axios from 'axios'

interface HealthStatus {
  status: string
  geminiConfigured: boolean
  version: string
  activeProvider?: string
  ensemble?: boolean
}

export default function Dashboard() {
  const { projects, activeProject, setActiveProject } = useApp()
  const navigate = useNavigate()
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [fileCount, setFileCount] = useState(0)

  useEffect(() => {
    axios.get('/api/health').then(r => setHealth(r.data)).catch(() => {})
    if (activeProject) {
      axios.get(`/api/files/project/${activeProject.id}`)
        .then(r => setFileCount(r.data.data?.length || 0))
        .catch(() => {})
    }
  }, [activeProject])

  const quickActions = [
    { label: 'Buat Proyek', icon: Plus, to: '/projects', color: '#4f8ef7' },
    { label: 'Upload File', icon: Files, to: '/files', color: '#a371f7' },
    { label: 'Planning Tools', icon: PenTool, to: '/planning', color: '#3fb950' },
    { label: 'AI Writing', icon: FileText, to: '/writing', color: '#d29922' },
    { label: 'Maps', icon: Map, to: '/maps', color: '#39d353' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">Dashboard</div>
          <div className="page-header-sub">Selamat datang di UrbanMind — Platform Riset & Perencanaan PWK</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {health && (
            <span className={`badge ${health.geminiConfigured ? 'badge-green' : 'badge-yellow'}`}>
              {health.geminiConfigured ? '✓ AI Aktif' : '⚠ AI Belum Dikonfigurasi'}
            </span>
          )}
        </div>
      </div>

      <div className="page-content">
        {/* Hero */}
        <div className="glass-panel" style={{ marginBottom: 24, padding: 32, borderRadius: 'var(--radius-xl)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, background: 'var(--accent)', filter: 'blur(100px)', opacity: 0.1, borderRadius: '50%' }}></div>
          <div style={{ position: 'absolute', bottom: -50, left: -50, width: 200, height: 200, background: 'var(--purple)', filter: 'blur(100px)', opacity: 0.1, borderRadius: '50%' }}></div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, position: 'relative', zIndex: 1 }}>
            <div style={{ width: 80, height: 80, borderRadius: 20, background: 'linear-gradient(135deg, var(--accent), var(--purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 900, color: '#0B0F19', flexShrink: 0, boxShadow: '0 0 30px rgba(147, 197, 253, 0.3)' }}>U</div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>UrbanMind v2.0</div>
              <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6, maxWidth: 600 }}>
                Platform Superapp untuk perencanaan wilayah dan akademik PWK. Diperkuat dengan Orkestrasi AI paralel untuk performa secepat kilat.
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: 24 }}>
          <div className="stat-card glass-panel" style={{ borderTop: '2px solid var(--accent)' }}>
            <div className="stat-label text-accent">Total Proyek</div>
            <div className="stat-value">{projects.length}</div>
            <div className="stat-desc">Semua proyek tersimpan</div>
          </div>
          <div className="stat-card glass-panel" style={{ borderTop: '2px solid var(--purple)' }}>
            <div className="stat-label text-purple">File Aktif</div>
            <div className="stat-value">{fileCount}</div>
            <div className="stat-desc">{activeProject ? `di ${activeProject.name}` : 'Pilih proyek aktif'}</div>
          </div>
          <div className="stat-card glass-panel" style={{ borderTop: '2px solid var(--success)' }}>
            <div className="stat-label text-success">Proyek Aktif</div>
            <div className="stat-value" style={{ fontSize: 16, fontWeight: 600, paddingTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeProject?.name || '—'}</div>
            <div className="stat-desc">{activeProject ? activeProject.type : 'Belum dipilih'}</div>
          </div>
          <div className="stat-card glass-panel" style={{ borderTop: '2px solid var(--warning)' }}>
            <div className="stat-label text-warning">AI Orchestrator</div>
            <div className="stat-value" style={{ fontSize: 18, paddingTop: 6 }}>{health?.activeProvider || 'Offline'}</div>
            <div className="stat-desc">Ensemble: {health?.ensemble ? 'Aktif' : 'Standby'}</div>
          </div>
        </div>

        <div className="grid-2" style={{ gap: 24 }}>
          {/* Quick Actions */}
          <div className="glass-panel" style={{ padding: 24, borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              Akses Cepat Toolkit
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {quickActions.map(({ label, icon: Icon, to, color }) => (
                <button key={to} className="btn btn-secondary glass-panel" style={{ justifyContent: 'flex-start', padding: '16px', gap: 12, height: 'auto', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)' }} onClick={() => navigate(to)}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={18} style={{ color }} />
                  </div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Active Project + Projects list */}
          <div className="glass-panel" style={{ padding: 24, borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Proyek Saya</span>
              <button className="btn btn-sm btn-primary" onClick={() => navigate('/projects')} style={{ borderRadius: 20 }}>
                <Plus size={14} /> Baru
              </button>
            </div>
            {projects.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 0', flex: 1 }}>
                <div className="empty-state-icon" style={{ fontSize: 56, marginBottom: 20 }}>📁</div>
                <h3 style={{ fontSize: 18 }}>Belum ada proyek</h3>
                <p style={{ fontSize: 14 }}>Buat proyek pertama untuk mulai bekerja</p>
                <button className="btn btn-primary" style={{ marginTop: 20, padding: '10px 24px' }} onClick={() => navigate('/projects')}>
                  <Plus size={16} /> Buat Proyek
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {projects.slice(0, 5).map(p => (
                  <div
                    key={p.id}
                    onClick={() => setActiveProject(p)}
                    style={{
                      padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                      border: `1px solid ${activeProject?.id === p.id ? 'var(--accent)' : 'var(--border-subtle)'}`,
                      background: activeProject?.id === p.id ? 'var(--accent-dim)' : 'rgba(0,0,0,0.3)',
                      boxShadow: activeProject?.id === p.id ? 'var(--shadow-glow)' : 'none',
                      transition: 'var(--transition)',
                      display: 'flex', alignItems: 'center', gap: 12
                    }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: activeProject?.id === p.id ? 'var(--accent)' : 'var(--bg-tertiary)', color: activeProject?.id === p.id ? '#0B0F19' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FolderOpen size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{p.location} · {p.type}</div>
                    </div>
                    {activeProject?.id === p.id && <span className="badge badge-blue" style={{ background: 'var(--accent)', color: '#0B0F19' }}>Aktif</span>}
                  </div>
                ))}
                {projects.length > 5 && (
                  <button className="btn btn-ghost" style={{ marginTop: 'auto', padding: 12 }} onClick={() => navigate('/projects')}>
                    Lihat {projects.length - 5} proyek lainnya <ArrowRight size={14} style={{ marginLeft: 8 }} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Backend not connected warning */}
        {!health && (
          <div className="alert alert-warning glass-panel" style={{ marginTop: 24, border: '1px solid var(--warning)' }}>
            <span style={{ fontSize: 18 }}>⚠</span>
            <div>
              <strong style={{ color: 'var(--warning)' }}>Backend belum terhubung.</strong> Pastikan server backend berjalan di port 3001.
              Jalankan: <code>cd backend && npm run dev</code>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
