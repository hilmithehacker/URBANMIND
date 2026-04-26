import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Cpu, Settings as SettingsIcon } from 'lucide-react'
import axios from 'axios'

interface ModelInfo { alias: string; id: string; label: string; hasKey: boolean }
interface AIStatusData {
  activeProvider: string
  available: boolean
  gemini: { available: boolean; model: string; keyConfigured: boolean }
  openrouter: { available: boolean; model: string; keyConfigured: boolean; models: ModelInfo[] }
}

const OR_MODEL_OPTIONS = [
  { id: 'google/gemma-3-27b-it',              label: 'Google Gemma 3 27B',       key: 'OPENROUTER_KEY_GEMMA' },
  { id: 'minimax/minimax-01',                  label: 'Minimax 01',               key: 'OPENROUTER_KEY_MINIMAX' },
  { id: 'openai/gpt-4o',                       label: 'OpenAI GPT-4o',            key: 'OPENROUTER_KEY_OPENAI' },
  { id: 'qwen/qwq-32b',                        label: 'Qwen QwQ 32B (Data)',      key: 'OPENROUTER_KEY_QWEN' },
  { id: 'nousresearch/hermes-3-llama-3.1-70b', label: 'Hermes 3 70B (Research)', key: 'OPENROUTER_KEY_HERMES' },
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct', label: 'Nvidia Nemotron 70B',  key: 'OPENROUTER_KEY_NVIDIA' },
]

export default function Settings() {
  const [aiStatus, setAiStatus] = useState<AIStatusData | null>(null)
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [backendError, setBackendError] = useState(false)

  const fetchStatus = async () => {
    setLoading(true); setBackendError(false)
    try {
      const [h, ai] = await Promise.all([
        axios.get('/api/health'),
        axios.get('/api/ai/status')
      ])
      setHealth(h.data)
      setAiStatus(ai.data.data)
    } catch {
      setBackendError(true)
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchStatus() }, [])

  const Ok = ({ ok }: { ok: boolean }) =>
    ok
      ? <CheckCircle size={15} style={{ color: 'var(--success)', flexShrink: 0 }} />
      : <XCircle size={15} style={{ color: 'var(--error)', flexShrink: 0 }} />

  const providerLabel: Record<string, string> = {
    gemini: 'Gemini (Google AI Studio)',
    openrouter: 'OpenRouter (Multi-Model)'
  }

  return (
    <div>
      <div className="page-header glass-panel" style={{ margin: '20px 20px 0', borderRadius: 'var(--radius-xl)', borderBottom: 'none' }}>
        <div>
          <div className="page-header-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><SettingsIcon size={24} className="text-secondary" /> Settings</div>
          <div className="page-header-sub">Status environment, provider AI, dan konfigurasi sistem</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchStatus} disabled={loading}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      <div className="page-content">
        {backendError && (
          <div className="alert alert-error glass-panel" style={{ marginBottom: 20 }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <div>
              <strong>Backend tidak terhubung.</strong> Jalankan: <code>cd backend && npm run dev</code>
            </div>
          </div>
        )}

        {/* Active provider banner */}
        {aiStatus && (
          <div className="card glass-panel" style={{ marginBottom: 20, background: aiStatus.available ? 'rgba(63,185,80,0.05)' : 'rgba(248,81,73,0.05)', border: `1px solid ${aiStatus.available ? 'rgba(63,185,80,0.3)' : 'rgba(248,81,73,0.3)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Cpu size={24} style={{ color: aiStatus.available ? 'var(--success)' : 'var(--error)', filter: 'drop-shadow(0 0 10px currentColor)' }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                  Provider Aktif: <span style={{ color: aiStatus.available ? 'var(--success)' : 'var(--error)' }}>
                    {providerLabel[aiStatus.activeProvider] || aiStatus.activeProvider}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {aiStatus.available
                    ? `AI siap digunakan — ganti provider via AI_PROVIDER di .env`
                    : 'Tidak ada provider aktif — cek konfigurasi di bawah'}
                </div>
              </div>
              <span className={`badge ${aiStatus.available ? 'badge-green' : 'badge-red'}`} style={{ marginLeft: 'auto', fontSize: 12, padding: '6px 12px' }}>
                {aiStatus.available ? '● Online' : '● Offline'}
              </span>
            </div>
          </div>
        )}

        <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
          {/* Backend */}
          <div className="card glass-panel">
            <div className="card-title" style={{ marginBottom: 16 }}>🖥️ Status Backend</div>
            {[
              { label: 'Status Server', value: !backendError && health ? 'Online' : 'Offline', ok: !backendError && !!health },
              { label: 'Port', value: ':3001', ok: true },
              { label: 'Versi', value: health?.version || '—', ok: !!health },
              { label: 'Last Check', value: health?.timestamp ? new Date(health.timestamp).toLocaleTimeString('id-ID') : '—', ok: true }
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{row.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {row.label === 'Status Server' && <Ok ok={row.ok} />}
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{row.value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Gemini */}
          <div className="card glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div className="card-title">🔵 Gemini (Google AI Studio)</div>
              {aiStatus?.activeProvider === 'gemini' && <span className="badge badge-blue">Aktif</span>}
            </div>
            {[
              { label: 'API Key', value: aiStatus?.gemini.keyConfigured ? 'Terkonfigurasi' : 'Belum diset', ok: !!aiStatus?.gemini.keyConfigured },
              { label: 'Tersedia', value: aiStatus?.gemini.available ? 'Ya' : 'Tidak', ok: !!aiStatus?.gemini.available },
              { label: 'Model', value: aiStatus?.gemini.model || '—', ok: true },
              { label: 'Aktifkan', value: 'Set AI_PROVIDER=gemini di .env', ok: true }
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{row.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {(row.label === 'API Key' || row.label === 'Tersedia') && <Ok ok={row.ok} />}
                  <span style={{ fontSize: 12, fontWeight: 500, fontFamily: row.label === 'Model' || row.label === 'Aktifkan' ? 'monospace' : 'inherit', color: row.label === 'Aktifkan' ? 'var(--text-muted)' : 'var(--text-primary)' }}>{row.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* OpenRouter */}
        <div className="card glass-panel" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div className="card-title">🟡 OpenRouter — Multi-Model Provider</div>
            {aiStatus?.activeProvider === 'openrouter' && <span className="badge badge-green">Aktif</span>}
          </div>

          <div className="grid-2" style={{ marginBottom: 16 }}>
            {[
              { label: 'Status', value: aiStatus?.openrouter.available ? 'Terkonfigurasi' : 'Tidak ada key', ok: !!aiStatus?.openrouter.available },
              { label: 'Model Aktif', value: aiStatus?.openrouter.model || '—', ok: true },
              { label: 'Aktifkan', value: 'Set AI_PROVIDER=openrouter di .env', ok: true },
              { label: 'Ganti Model', value: 'Set OPENROUTER_MODEL=<model-id> di .env', ok: true }
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 8, gap: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>{row.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  {row.label === 'Status' && <Ok ok={row.ok} />}
                  <span style={{ fontSize: 12, fontFamily: row.label.includes('Aktifkan') || row.label.includes('Ganti') ? 'monospace' : 'inherit', color: row.label.includes('Aktifkan') || row.label.includes('Ganti') ? 'var(--accent)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Models table */}
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Model Tersedia</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {OR_MODEL_OPTIONS.map(m => {
              const isActive = aiStatus?.openrouter.model === m.id
              const hasKey = aiStatus?.openrouter.models?.find(x => x.id === m.id)?.hasKey ?? true
              return (
                <div key={m.id} className={isActive ? 'glass-panel' : ''} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`, background: isActive ? 'var(--accent-dim)' : 'transparent' }}>
                  <Ok ok={hasKey} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}>{m.label}</div>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{m.id}</div>
                  </div>
                  {isActive && <span className="badge badge-blue">Aktif</span>}
                </div>
              )
            })}
          </div>

          <div className="alert alert-info glass-panel" style={{ marginTop: 16, marginBottom: 0, background: 'rgba(147, 197, 253, 0.1)' }}>
            <div style={{ fontSize: 12 }}>
              Untuk ganti model: edit <code>OPENROUTER_MODEL=&lt;model-id&gt;</code> di <code>.env</code> lalu restart backend.
            </div>
          </div>
        </div>

        {/* Tech stack */}
        <div className="card glass-panel">
          <div className="card-title" style={{ marginBottom: 16 }}>🛠️ Tech Stack</div>
          <div className="grid-2">
            {[
              { label: 'Frontend', value: 'React 19 + TypeScript + Vite' },
              { label: 'Backend', value: 'Node.js + Express + TypeScript' },
              { label: 'AI Providers', value: 'Gemini API + OpenRouter (Gemma, Minimax, GPT-4o, Qwen)' },
              { label: 'Storage', value: 'File-based JSON + Local uploads' },
              { label: 'Frontend Port', value: ':3000' },
              { label: 'Backend Port', value: ':3001' },
            ].map(item => (
              <div key={item.label} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
