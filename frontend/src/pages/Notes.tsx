import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { NotebookTabs, Plus, Trash2, Save, Download } from 'lucide-react';
import { useNoteStore } from '../store/noteStore';
import ReactMarkdown from 'react-markdown';

export default function Notes() {
  const { activeProject } = useApp();
  const { notes, activeNoteId, addNote, updateNote, deleteNote, setActiveNote } = useNoteStore();
  
  const projId = activeProject?.id || 'default';
  const projectNotes = notes[projId] || [];
  const activeNote = projectNotes.find(n => n.id === activeNoteId);

  const [title, setTitle] = useState(activeNote?.title || '');
  const [content, setContent] = useState(activeNote?.content || '');
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    if (activeNote) {
      setTitle(activeNote.title);
      setContent(activeNote.content);
    }
  }, [activeNoteId, activeNote]);

  const handleSave = () => {
    if (!activeNoteId) {
      addNote(projId, { title: title || 'Catatan Baru', content });
    } else {
      updateNote(projId, activeNoteId, { title, content });
    }
  };

  const handleCreate = () => {
    addNote(projId, { title: 'Catatan Baru', content: '' });
  };

  const handleExport = () => {
    if (!activeNote) return;
    const blob = new Blob([activeNote.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeNote.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header glass-panel" style={{ margin: '20px 20px 0', borderRadius: 'var(--radius-xl)', borderBottom: 'none' }}>
        <div>
          <div className="page-header-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NotebookTabs size={24} className="text-accent" /> Smart Notes System
          </div>
          <div className="page-header-sub">Catatan berbasis markdown, disimpan secara lokal di browser.</div>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, margin: '20px', gap: 20 }}>
        {/* Sidebar */}
        <div className="card glass-panel" style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}>
          <button className="btn btn-primary w-100 glow" onClick={handleCreate}>
            <Plus size={16} /> Catatan Baru
          </button>
          
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {projectNotes.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 20 }}>Belum ada catatan.</div>}
            {projectNotes.map(note => (
              <div 
                key={note.id} 
                className={`note-item ${activeNoteId === note.id ? 'active' : ''}`}
                onClick={() => setActiveNote(note.id)}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius)',
                  background: activeNoteId === note.id ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                  border: `1px solid ${activeNoteId === note.id ? 'var(--accent)' : 'transparent'}`,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14, fontWeight: 600 }}>{note.title}</div>
                <button 
                  className="btn-icon" 
                  onClick={(e) => { e.stopPropagation(); deleteNote(projId, note.id); }}
                  style={{ color: 'var(--error)' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Editor Area */}
        <div className="card glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
          {activeNote ? (
            <>
              <div style={{ display: 'flex', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', gap: 10, alignItems: 'center' }}>
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Judul Catatan"
                  style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, outline: 'none' }}
                />
                <button className="btn btn-ghost btn-sm" onClick={() => setIsPreview(!isPreview)}>
                  {isPreview ? 'Edit' : 'Preview MD'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={handleExport}><Download size={14}/></button>
                <button className="btn btn-secondary btn-sm" onClick={handleSave}><Save size={14}/> Simpan</button>
              </div>
              
              <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
                {isPreview ? (
                  <div className="markdown-output" style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
                    <ReactMarkdown>{content}</ReactMarkdown>
                  </div>
                ) : (
                  <textarea 
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Mulai mengetik dalam format markdown..."
                    style={{ 
                      flex: 1, width: '100%', padding: 20, background: 'transparent', 
                      border: 'none', color: 'var(--text-primary)', fontSize: 15, 
                      fontFamily: 'monospace', outline: 'none', resize: 'none'
                    }}
                  />
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Pilih atau buat catatan baru.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
