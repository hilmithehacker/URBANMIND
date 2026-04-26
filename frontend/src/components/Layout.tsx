import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  LayoutDashboard, FolderOpen, Files, Map, BookOpen,
  PenTool, FileText, Wrench, Settings, ChevronUp, Check,
  FileCheck2, Share2, NotebookTabs
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects',  icon: FolderOpen,      label: 'Projects' },
  { to: '/files',     icon: Files,           label: 'Files' },
  { to: '/pdf',       icon: FileCheck2,      label: 'PDF Toolkit' },
  { to: '/visual',    icon: Share2,          label: 'Visual Builder' },
  { to: '/notes',     icon: NotebookTabs,    label: 'Smart Notes' },
  { to: '/maps',      icon: Map,             label: 'Maps' },
  { to: '/research',  icon: BookOpen,        label: 'Research' },
  { to: '/planning',  icon: PenTool,         label: 'Planning' },
  { to: '/writing',   icon: FileText,        label: 'Writing' },
  { to: '/utilities', icon: Wrench,          label: 'Utilities' },
  { to: '/settings',  icon: Settings,        label: 'Settings' },
]

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',   '/projects': 'Projects',
  '/files': 'Files',           '/pdf': 'PDF Toolkit',
  '/visual': 'Visual Builder', '/notes': 'Notes',
  '/maps': 'Maps',             '/research': 'Research',
  '/planning': 'Planning',     '/writing': 'Writing',
  '/utilities': 'Utilities',   '/settings': 'Settings',
}

export default function Layout() {
  const { activeProject, setActiveProject, projects, isBackendOnline } = useApp()
  const location = useLocation()
  const contentRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)

  // ── Page title per route ───────────────────────────────────────────────────
  useEffect(() => {
    const title = PAGE_TITLES[location.pathname] || 'UrbanMind'
    document.title = `${title} — UrbanMind PWK`
  }, [location.pathname])

  // ── Scroll reset on route change ───────────────────────────────────────────
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])

  // ── Close project dropdown on outside click ────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProjectMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-link">Langsung ke konten utama</a>

      <aside className="sidebar" aria-label="Navigasi utama" style={{ background: 'rgba(3, 5, 12, 0.5)', backdropFilter: 'blur(30px)', borderRight: '1px solid rgba(255,255,255,0.05)', boxShadow: '5px 0 30px rgba(0,0,0,0.5)', zIndex: 50 }}>
        {/* Logo */}
        <div className="sidebar-logo" style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.02)' }}>
          <img src="/logo.png" alt="UM" style={{ width: 34, height: 34, objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(192, 132, 252, 0.4))' }} />
          <div>
            <div className="sidebar-logo-text" style={{ fontSize: 19, fontWeight: 900, letterSpacing: '-0.5px', background: 'var(--gradient-purple)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textShadow: '0 0 20px rgba(192, 132, 252, 0.3)' }}>UrbanMind</div>
            <div className="sidebar-logo-sub" style={{ fontSize: 9, opacity: 0.9, marginTop: 2, color: 'var(--accent)', fontWeight: 700 }}>PWK SUPERAPP</div>
          </div>
        </div>

        {/* Nav */}
        <div className="sidebar-section" style={{ padding: '20px 12px', flex: 1, overflowY: 'auto' }}>
          <div className="sidebar-section-label" style={{ paddingLeft: 12, marginBottom: 12, color: 'var(--text-muted)', fontSize: 11, letterSpacing: '1.5px', fontWeight: 800 }}>MENU UTAMA</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                style={({ isActive }) => ({
                  padding: '12px 16px', borderRadius: 'var(--radius)', transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
                  background: isActive ? 'linear-gradient(90deg, rgba(56, 189, 248, 0.15), rgba(56, 189, 248, 0.05))' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  borderLeft: isActive ? '4px solid var(--accent)' : '4px solid transparent',
                  boxShadow: isActive ? 'inset 20px 0 30px -20px rgba(56, 189, 248, 0.4), 0 5px 15px rgba(0,0,0,0.2)' : 'none',
                  position: 'relative', overflow: 'hidden'
                })}>
                {({ isActive }) => (
                  <>
                    <Icon size={20} style={{ filter: isActive ? 'drop-shadow(0 0 10px var(--accent))' : 'none', color: 'inherit', transition: 'all 0.3s' }} />
                    <span style={{ fontWeight: 700, letterSpacing: '-0.2px', fontSize: 14 }}>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Project quick-switch footer */}
        <div className="sidebar-footer" ref={dropdownRef} style={{ padding: 20, background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Dropdown panel — renders ABOVE the footer */}
          {projectMenuOpen && (
            <div className="glass-panel" style={{
              position: 'absolute', bottom: 'calc(100% + 15px)', left: 16, right: 16,
              borderRadius: 'var(--radius-lg)', boxShadow: '0 -15px 50px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)',
              maxHeight: 300, overflowY: 'auto', zIndex: 100, background: 'rgba(13, 17, 30, 0.95)'
            }}>
              <div style={{ padding: '16px 20px 10px', fontSize: 11, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                Pilih Proyek Aktif
              </div>
              {projects.length === 0 ? (
                <div style={{ padding: '30px 20px', fontSize: 14, color: 'var(--text-muted)', textAlign: 'center' }}>
                  Belum ada proyek
                </div>
              ) : (
                projects.map(p => (
                  <div key={p.id}
                    onClick={() => { setActiveProject(p); setProjectMenuOpen(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 20px', cursor: 'pointer',
                      background: activeProject?.id === p.id ? 'var(--accent-dim)' : 'transparent',
                      color: activeProject?.id === p.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { if (activeProject?.id !== p.id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
                    onMouseLeave={e => { if (activeProject?.id !== p.id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    {activeProject?.id === p.id ? <Check size={18} style={{ color: 'var(--accent)', filter: 'drop-shadow(0 0 5px var(--accent))' }} /> : <div style={{width: 18}}/>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: activeProject?.id === p.id ? '#fff' : 'inherit' }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{p.location}</div>
                    </div>
                  </div>
                ))
              )}
              <div style={{ padding: '12px' }}>
                <NavLink to="/projects"
                  onClick={() => setProjectMenuOpen(false)}
                  style={{ display: 'block', padding: '12px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none', borderRadius: 'var(--radius)', textAlign: 'center', background: 'var(--gradient-accent)', boxShadow: '0 5px 15px rgba(56, 189, 248, 0.3)' }}>
                  Kelola Semua Proyek →
                </NavLink>
              </div>
            </div>
          )}

          {/* Trigger */}
          <div className="project-selector glass-panel"
            onClick={() => setProjectMenuOpen(o => !o)}
            style={{ cursor: 'pointer', userSelect: 'none', position: 'relative', padding: '16px 20px', borderRadius: 'var(--radius-lg)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', transition: 'all 0.3s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="project-selector-label" style={{ fontSize: 11, letterSpacing: '1px', margin: 0, color: 'var(--purple)', fontWeight: 800 }}>PROYEK AKTIF</div>
              <ChevronUp size={16} style={{
                color: 'var(--text-primary)',
                transform: projectMenuOpen ? 'rotate(0deg)' : 'rotate(180deg)',
                transition: 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)'
              }} />
            </div>
            {activeProject
              ? <div className="project-selector-name" title={activeProject.name} style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{activeProject.name}</div>
              : <div className="project-selector-none" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Klik untuk pilih proyek</div>
            }
          </div>
        </div>
      </aside>

      <main id="main-content" className="main-content" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Backend offline banner */}
        {!isBackendOnline && (
          <div role="alert" aria-live="assertive" style={{
            background: 'linear-gradient(90deg, #b91c1c, #dc2626)',
            color: 'white', padding: '8px 20px', fontSize: 12, fontWeight: 500,
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
            boxShadow: '0 2px 8px rgba(220,38,38,0.4)', flexShrink: 0
          }}>
            <span style={{ fontSize: 15 }}>⚠</span>
            <span>Backend server tidak terhubung — sedang mencoba reconnect otomatis...</span>
            <button onClick={() => window.location.reload()} style={{
              background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
              color: 'white', padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
              marginLeft: 6, fontSize: 11, fontWeight: 600
            }}>Muat Ulang</button>
          </div>
        )}

        {/* Page content — key triggers fade-in + scroll reset on route change */}
        <div
          key={location.pathname}
          ref={contentRef}
          className="page-enter"
          style={{ flex: 1, overflow: 'auto' }}
        >
          <Outlet />
        </div>
      </main>
    </div>
  )
}
