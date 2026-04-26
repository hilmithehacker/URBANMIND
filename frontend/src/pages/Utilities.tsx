import { useState } from 'react';
import { Wrench, Copy, Trash2, Check } from 'lucide-react';

export default function Utilities() {
  const [textInput, setTextInput] = useState('');
  const [copiedText, setCopiedText] = useState(false);

  const words = textInput.trim() ? textInput.trim().split(/\s+/).length : 0;
  const chars = textInput.length;
  const readingTime = Math.ceil(words / 200); // 200 words per minute

  const handleCopy = () => {
    navigator.clipboard.writeText(textInput);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const cleanSpaces = () => setTextInput(textInput.replace(/\s+/g, ' '));
  const toTitleCase = () => setTextInput(textInput.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()));
  const toSentenceCase = () => setTextInput(textInput.charAt(0).toUpperCase() + textInput.slice(1).toLowerCase());
  const formatJSON = () => {
    try {
      const parsed = JSON.parse(textInput);
      setTextInput(JSON.stringify(parsed, null, 2));
    } catch {
      alert("Invalid JSON");
    }
  };

  const handleClear = () => setTextInput('');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header glass-panel" style={{ margin: '20px 20px 0', borderRadius: 'var(--radius-xl)', borderBottom: 'none' }}>
        <div>
          <div className="page-header-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Wrench size={24} className="text-success" /> Utility Engine
          </div>
          <div className="page-header-sub">Kumpulan mikro-tools (Text Cleaner, Formatter, Converter) yang berjalan 100% offline.</div>
        </div>
      </div>

      <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
        <div className="grid-2">
          {/* Main Workspace */}
          <div className="card glass-panel" style={{ display: 'flex', flexDirection: 'column', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Workspace Text / Data</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-icon" onClick={handleClear} title="Bersihkan"><Trash2 size={16} style={{ color: 'var(--error)' }}/></button>
                <button className="btn-icon" onClick={handleCopy} title="Salin">
                  {copiedText ? <Check size={16} style={{ color: 'var(--success)' }}/> : <Copy size={16}/>}
                </button>
              </div>
            </div>
            <textarea
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder="Paste teks, JSON, atau data di sini..."
              style={{ flex: 1, minHeight: 400, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, color: 'var(--text-primary)', fontFamily: 'monospace', resize: 'vertical', outline: 'none' }}
            />
            
            {/* Stats Row */}
            <div style={{ display: 'flex', gap: 16, marginTop: 12, padding: 12, background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div><strong style={{ color: 'var(--accent)' }}>Words:</strong> {words}</div>
              <div><strong style={{ color: 'var(--success)' }}>Chars:</strong> {chars}</div>
              <div><strong style={{ color: 'var(--warning)' }}>Reading Time:</strong> ~{readingTime} min</div>
            </div>
          </div>

          {/* Action Panels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            <div className="card glass-panel" style={{ padding: 16 }}>
              <h3 style={{ marginBottom: 16, fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Text Cleaner</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button className="btn btn-secondary" onClick={cleanSpaces}>Remove Double Spaces</button>
                <button className="btn btn-secondary" onClick={toTitleCase}>Title Case</button>
                <button className="btn btn-secondary" onClick={toSentenceCase}>Sentence Case</button>
              </div>
            </div>

            <div className="card glass-panel" style={{ padding: 16 }}>
              <h3 style={{ marginBottom: 16, fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Formatters</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button className="btn btn-secondary" onClick={formatJSON}>Format JSON</button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>Paste data tidak terformat di workspace kiri, klik tombol untuk merapikan.</p>
            </div>

            <div className="card glass-panel" style={{ padding: 16, opacity: 0.8 }}>
              <h3 style={{ marginBottom: 16, fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Color Palette Generator</h3>
              <div style={{ display: 'flex', gap: 8, height: 40, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{ flex: 1, background: '#38bdf8' }} title="#38bdf8"></div>
                <div style={{ flex: 1, background: '#c084fc' }} title="#c084fc"></div>
                <div style={{ flex: 1, background: '#fbbf24' }} title="#fbbf24"></div>
                <div style={{ flex: 1, background: '#4ade80' }} title="#4ade80"></div>
                <div style={{ flex: 1, background: '#f87171' }} title="#f87171"></div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>Gunakan palette ini untuk standardisasi warna laporan / presentasi UrbanMind.</p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
