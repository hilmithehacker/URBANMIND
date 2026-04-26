import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useWritingStore } from '../store/writingStore';
import { FileText, Plus, Trash2, Copy, BookOpen, FileEdit } from 'lucide-react';

export default function Writing() {
  const { activeProject } = useApp();
  const { citations, outlines, activeOutlineId, addCitation, deleteCitation, addOutline, deleteOutline, setActiveOutline, updateSection, addSection } = useWritingStore();
  
  const projId = activeProject?.id || 'default';
  const projectCitations = citations[projId] || [];
  const projectOutlines = outlines[projId] || [];
  const activeOutline = projectOutlines.find(o => o.id === activeOutlineId);

  const [tab, setTab] = useState<'outline' | 'citation'>('outline');
  
  // Citation form state
  const [citType, setCitType] = useState<'book' | 'article' | 'website'>('book');
  const [citAuthors, setCitAuthors] = useState('');
  const [citTitle, setCitTitle] = useState('');
  const [citYear, setCitYear] = useState('');
  const [citPublisher, setCitPublisher] = useState('');
  const [citUrl, setCitUrl] = useState('');

  const handleGenerateCitation = () => {
    if (!citAuthors || !citTitle || !citYear) return;
    
    // Simple offline APA formatting logic
    let apa = '';
    let mla = '';
    let chicago = '';
    
    if (citType === 'book') {
      apa = `${citAuthors}. (${citYear}). *${citTitle}*. ${citPublisher}.`;
      mla = `${citAuthors}. *${citTitle}*. ${citPublisher}, ${citYear}.`;
      chicago = `${citAuthors}. ${citYear}. *${citTitle}*. ${citPublisher}.`;
    } else if (citType === 'article') {
      apa = `${citAuthors}. (${citYear}). ${citTitle}. *${citPublisher}*.`;
      mla = `${citAuthors}. "${citTitle}." *${citPublisher}* (${citYear}).`;
      chicago = `${citAuthors}. "${citTitle}." *${citPublisher}* (${citYear}).`;
    } else {
      apa = `${citAuthors}. (${citYear}). *${citTitle}*. Retrieved from ${citUrl}`;
      mla = `${citAuthors}. "${citTitle}." ${citYear}. ${citUrl}.`;
      chicago = `${citAuthors}. "${citTitle}." Last modified ${citYear}. ${citUrl}.`;
    }

    addCitation(projId, {
      id: Date.now().toString(),
      type: citType,
      authors: citAuthors,
      title: citTitle,
      year: citYear,
      publisher: citPublisher,
      url: citUrl,
      formatted: { apa, mla, chicago }
    });
    
    // Reset
    setCitAuthors(''); setCitTitle(''); setCitYear(''); setCitPublisher(''); setCitUrl('');
  };

  const handleAddOutline = () => {
    const name = prompt('Nama Dokumen (Contoh: Laporan Pendahuluan)');
    if (name) {
      addOutline(projId, {
        id: Date.now().toString(),
        name,
        sections: [
          { id: 's1', title: 'Bab I Pendahuluan', content: '', status: 'draft' },
          { id: 's2', title: 'Bab II Gambaran Umum', content: '', status: 'draft' },
        ]
      });
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header glass-panel" style={{ margin: '20px 20px 0', borderRadius: 'var(--radius-xl)', borderBottom: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="page-header-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileText size={24} className="text-warning" /> Academic Writing Toolkit
            </div>
            <div className="page-header-sub">Struktur dokumen dan pembuat sitasi otomatis secara lokal.</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className={`btn ${tab === 'outline' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('outline')}>
              <FileEdit size={16} /> Struktur Dokumen
            </button>
            <button className={`btn ${tab === 'citation' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('citation')}>
              <BookOpen size={16} /> Daftar Pustaka
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
        {tab === 'outline' && (
          <div className="grid-2">
            <div className="card glass-panel" style={{ padding: 16 }}>
              <button className="btn btn-primary w-100 glow" onClick={handleAddOutline}><Plus size={16}/> Buat Struktur Baru</button>
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {projectOutlines.map(o => (
                  <div 
                    key={o.id} 
                    onClick={() => setActiveOutline(o.id)}
                    style={{ 
                      padding: 12, borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: activeOutlineId === o.id ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                      border: `1px solid ${activeOutlineId === o.id ? 'var(--accent)' : 'transparent'}`
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{o.name}</span>
                    <button className="btn-icon" onClick={(e) => { e.stopPropagation(); deleteOutline(projId, o.id); }} style={{ color: 'var(--error)' }}><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="card glass-panel" style={{ padding: 20 }}>
              {activeOutline ? (
                <div>
                  <h3 style={{ marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>{activeOutline.name}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {activeOutline.sections.map(s => (
                      <div key={s.id} style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <input 
                            value={s.title} 
                            onChange={(e) => updateSection(projId, activeOutline.id, s.id, { title: e.target.value })}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, outline: 'none', flex: 1 }}
                          />
                          <select 
                            value={s.status} 
                            onChange={(e) => updateSection(projId, activeOutline.id, s.id, { status: e.target.value as any })}
                            style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px', fontSize: 12 }}
                          >
                            <option value="draft">Draft</option>
                            <option value="review">Review</option>
                            <option value="done">Selesai</option>
                          </select>
                        </div>
                        <textarea 
                          value={s.content}
                          onChange={(e) => updateSection(projId, activeOutline.id, s.id, { content: e.target.value })}
                          placeholder="Poin-poin isi bab ini..."
                          style={{ width: '100%', minHeight: 80, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', resize: 'vertical' }}
                        />
                      </div>
                    ))}
                    <button className="btn btn-secondary w-100" onClick={() => addSection(projId, activeOutline.id, 'Bagian Baru')}><Plus size={16}/> Tambah Bagian</button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 40 }}>Pilih struktur dokumen.</div>
              )}
            </div>
          </div>
        )}

        {tab === 'citation' && (
          <div className="grid-2">
            <div className="card glass-panel" style={{ padding: 20 }}>
              <h3 style={{ marginBottom: 16 }}>Tambah Sitasi</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Jenis Sumber</label>
                  <select value={citType} onChange={(e) => setCitType(e.target.value as any)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                    <option value="book">Buku</option>
                    <option value="article">Artikel / Jurnal</option>
                    <option value="website">Website</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Penulis (Format: Nama Belakang, Singkatan Depan.)</label>
                  <input value={citAuthors} onChange={(e) => setCitAuthors(e.target.value)} placeholder="Misal: Doe, J." style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Tahun</label>
                  <input value={citYear} onChange={(e) => setCitYear(e.target.value)} placeholder="Misal: 2024" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Judul</label>
                  <input value={citTitle} onChange={(e) => setCitTitle(e.target.value)} placeholder="Judul tulisan..." style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Penerbit / Jurnal</label>
                  <input value={citPublisher} onChange={(e) => setCitPublisher(e.target.value)} placeholder="Penerbit..." style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
                </div>
                {citType === 'website' && (
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>URL</label>
                    <input value={citUrl} onChange={(e) => setCitUrl(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
                  </div>
                )}
                <button className="btn btn-primary" onClick={handleGenerateCitation} style={{ marginTop: 10 }}>Generate & Simpan</button>
              </div>
            </div>

            <div className="card glass-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3>Daftar Pustaka Tersimpan</h3>
                <span className="badge badge-blue">{projectCitations.length} Sitasi</span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {projectCitations.map(c => (
                  <div key={c.id} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-tertiary)', position: 'relative' }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                      <button className="btn-icon" onClick={() => deleteCitation(projId, c.id)} style={{ color: 'var(--error)' }}><Trash2 size={14}/></button>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                      <span><strong style={{ color: 'var(--text-primary)' }}>APA:</strong> {c.formatted.apa}</span>
                      <button className="btn-icon" onClick={() => copyText(c.formatted.apa)}><Copy size={12}/></button>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                      <span><strong style={{ color: 'var(--text-primary)' }}>MLA:</strong> {c.formatted.mla}</span>
                      <button className="btn-icon" onClick={() => copyText(c.formatted.mla)}><Copy size={12}/></button>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                      <span><strong style={{ color: 'var(--text-primary)' }}>Chicago:</strong> {c.formatted.chicago}</span>
                      <button className="btn-icon" onClick={() => copyText(c.formatted.chicago)}><Copy size={12}/></button>
                    </div>
                  </div>
                ))}
                {projectCitations.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 20 }}>Belum ada sitasi.</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
