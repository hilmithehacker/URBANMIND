import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { Plus, Trash2, FolderOpen, CheckCircle, X, Search } from 'lucide-react'
import axios from 'axios'

const PROJECT_TYPES = [
  'Perencanaan Umum', 'RDTR', 'RTRW', 'Kawasan Strategis',
  'Perencanaan Transportasi', 'Perumahan & Permukiman',
  'Perencanaan Pesisir', 'Revitalisasi Kawasan', 'Studi Kelayakan',
  'Penelitian/Skripsi', 'Laporan Kerja Praktik'
]

export default function Projects() {
  const { projects, activeProject, setActiveProject, refreshProjects } = useApp()
  const { success, error: toastError, confirm } = useToast()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', location: '', type: 'Perencanaan Umum' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.location.toLowerCase().includes(search.toLowerCase()) ||
    p.type.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('Nama proyek wajib diisi'); return }
    setLoading(true); setError('')
    try {
      await axios.post('/api/projects', form)
      await refreshProjects()
      setForm({ name: '', description: '', location: '', type: 'Perencanaan Umum' })
      setShowModal(false)
      success('Proyek dibuat!', `"${form.name}" berhasil ditambahkan`)
    } catch (e: any) {
      setError(e.response?.data?.error || 'Gagal membuat proyek')
    } finally { setLoading(false) }
  }

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm(
      `Hapus proyek "${name}"?`,
      'Semua data yang terkait dengan proyek ini (file, analisis) tidak akan terhapus dari server, namun proyek tidak akan bisa diakses lagi. Tindakan ini tidak dapat dibatalkan.'
    )
    if (!ok) return
    try {
      await axios.delete(`/api/projects/${id}`)
      if (activeProject?.id === id) setActiveProject(null)
      await refreshProjects()
      success('Proyek dihapus', `"${name}" berhasil dihapus`)
    } catch {
      toastError('Gagal menghapus proyek', 'Coba lagi atau restart backend')
    }
  }

  return (
    <div>
      <div className="page-header glass-panel" style={{ margin: '20px 20px 0', borderRadius: 'var(--radius-xl)', borderBottom: 'none', background: 'var(--bg-card)' }}>
        <div>
          <div className="page-header-title" style={{ 
            fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px',
            background: 'var(--gradient-accent)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            display: 'flex', alignItems: 'center', gap: 12 
          }}>
            <FolderOpen size={28} style={{ color: 'var(--accent)' }} />
            Projects Workspace
          </div>
          <div className="page-header-sub" style={{ fontSize: 14, marginTop: 4 }}>Kelola dan organisir proyek perencanaan tata ruang Anda</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ background: 'var(--gradient-accent)', padding: '10px 20px', fontSize: 14, border: 'none', boxShadow: '0 4px 15px rgba(56, 189, 248, 0.4)' }}>
          <Plus size={18} /> Buat Proyek Baru
        </button>
      </div>

      <div className="page-content">
        {projects.length > 0 && (
          <div className="glass-panel" style={{ position: 'relative', marginBottom: 24, borderRadius: 'var(--radius-lg)', padding: '4px' }}>
            <Search size={18} style={{
              position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--accent)'
            }} />
            <input
              className="form-input"
              style={{ 
                paddingLeft: 48, height: 50, fontSize: 15, border: 'none', background: 'transparent',
                boxShadow: 'none'
              }}
              placeholder="Cari proyek berdasarkan nama, lokasi, atau jenis..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Cari proyek"
            />
          </div>
        )}

        {filteredProjects.length === 0 ? (
          <div className="empty-state glass-panel" style={{ padding: '80px 20px', borderRadius: 'var(--radius-xl)' }}>
            <div className="empty-state-icon" style={{ 
              fontSize: 72, marginBottom: 24, filter: 'drop-shadow(0 0 20px var(--accent-dim))',
              background: 'var(--gradient-purple)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>{search ? '🔍' : '✨'}</div>
            <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{search ? `Tidak ada proyek untuk "${search}"` : 'Belum ada proyek yang dibuat'}</h3>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)' }}>{search ? 'Coba gunakan kata kunci pencarian yang lain.' : 'Mulailah dengan membuat proyek pertama untuk mengorganisir pekerjaan Anda secara profesional.'}</p>
            {!search && (
              <button className="btn btn-primary" style={{ marginTop: 30, padding: '14px 28px', fontSize: 15, background: 'var(--gradient-accent)', border: 'none', boxShadow: '0 8px 25px rgba(56, 189, 248, 0.4)' }} onClick={() => setShowModal(true)}>
                <Plus size={18} /> Buat Proyek Pertama
              </button>
            )}
          </div>
        ) : (
          <div className="grid-3" style={{ gap: 24 }}>
            {filteredProjects.map(p => {
              const isActive = activeProject?.id === p.id;
              return (
              <div key={p.id} className="card glass-panel" style={{
                position: 'relative', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                border: isActive ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                boxShadow: isActive ? 'var(--shadow-glow)' : 'var(--shadow)',
                background: isActive ? 'linear-gradient(180deg, rgba(56,189,248,0.1) 0%, rgba(15,23,42,0.4) 100%)' : 'var(--bg-card)'
              }}>
                {isActive && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'var(--gradient-accent)' }} />
                )}
                {isActive && (
                  <div style={{ position: 'absolute', top: 16, right: 16 }}>
                    <span className="badge" style={{ background: 'var(--accent)', color: '#03050c', fontWeight: 800, padding: '4px 10px', boxShadow: '0 0 10px var(--accent)' }}>AKTIF</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16, marginTop: isActive ? 8 : 0 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 16,
                    background: isActive ? 'var(--accent)' : 'var(--bg-tertiary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    boxShadow: isActive ? '0 8px 20px rgba(56,189,248,0.4)' : 'none'
                  }}>
                    <FolderOpen size={24} style={{ color: isActive ? '#03050c' : 'var(--accent)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6, paddingRight: isActive ? 50 : 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <span className="badge" style={{ fontSize: 11, padding: '3px 10px', background: 'var(--bg-secondary)', color: 'var(--purple)', border: '1px solid var(--border)' }}>{p.type}</span>
                  </div>
                </div>

                {p.description && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6, flex: 1 }}>
                    {p.description.slice(0, 100)}{p.description.length > 100 ? '…' : ''}
                  </p>
                )}
                {!p.description && <div style={{ flex: 1 }}></div>}

                <div style={{ padding: '12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius)', marginBottom: 20 }}>
                  {p.location && (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--warning)', filter: 'drop-shadow(0 0 5px var(--warning))' }}>📍</span> {p.location}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--success)', filter: 'drop-shadow(0 0 5px var(--success))' }}>🗓</span> {new Date(p.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
                  <button
                    className={`btn ${isActive ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={(e) => { e.stopPropagation(); setActiveProject(isActive ? null : p); }}
                    style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius)', justifyContent: 'center', background: !isActive ? 'var(--gradient-accent)' : undefined, border: !isActive ? 'none' : undefined }}
                  >
                    <CheckCircle size={16} />
                    <span style={{ fontWeight: 700 }}>{isActive ? 'Lepaskan' : 'Buka Proyek'}</span>
                  </button>
                  <button
                    className="btn btn-danger glass-panel"
                    onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.name); }}
                    aria-label={`Hapus proyek ${p.name}`}
                    style={{ padding: '10px 14px', borderRadius: 'var(--radius)', background: 'rgba(251, 113, 133, 0.05)' }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-create-title" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title" id="modal-create-title">Buat Proyek Baru</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)} aria-label="Tutup modal"><X size={16} /></button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error" role="alert"><span>⚠</span>{error}</div>}
              <div className="form-group">
                <label className="form-label" htmlFor="proj-name">Nama Proyek *</label>
                <input id="proj-name" className="form-input" placeholder="Contoh: RDTR Kecamatan Cibadak 2024" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="proj-loc">Lokasi</label>
                <input id="proj-loc" className="form-input" placeholder="Contoh: Kecamatan Cibadak, Kab. Sukabumi" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="proj-type">Jenis Proyek</label>
                <select id="proj-type" className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="proj-desc">Deskripsi</label>
                <textarea id="proj-desc" className="form-textarea" placeholder="Deskripsi singkat proyek, tujuan, dan ruang lingkup..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
                {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Menyimpan...</> : <><Plus size={14} /> Buat Proyek</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
