import React from 'react'
import MermaidBlock from '../../components/MermaidBlock'
import { Lightbulb, AlertTriangle, User, Zap, MessageSquareText, Target, Crosshair, Map } from 'lucide-react'

// ── 1. Text Cleaner & Formatter ──────────────────────────────────────────

function cleanInlineMarkdown(text: string): string {
  if (!text) return ''
  return text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#+\s/g, '').trim()
}

// Me-render teks dengan dukungan bold sebatas sebaris (inline)
function renderFormattedText(text: string): React.ReactNode[] {
  if (!text) return []
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: '#F9FAFB', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} style={{ fontStyle: 'italic', color: '#D1D5DB' }}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

function generateMermaid(flow: any, labelGreen: string, labelRed: string): string {
  if (!flow || !flow.nodes || flow.nodes.length === 0) return '';
  let code = `flowchart TD\\n`;
  code += `  classDef potensi fill:#A7F3D0,stroke:#10B981,stroke-width:2px,color:#000,rx:8px,ry:8px\\n`;
  code += `  classDef masalah fill:#FECACA,stroke:#EF4444,stroke-width:2px,color:#000,rx:8px,ry:8px\\n`;
  code += `  subgraph Legenda\\n    L1[${labelGreen.replace(/[^a-zA-Z0-9 ]/g, '')}]:::potensi\\n    L2[${labelRed.replace(/[^a-zA-Z0-9 ]/g, '')}]:::masalah\\n  end\\n`;
  
  flow.nodes.forEach((n: any) => {
    const safeLabel = (n.label || '').replace(/["\\(\\)\\[\\]\\{\\}]/g, '');
    const typeClass = n.type === 'potensi' ? 'potensi' : 'masalah';
    code += `  ${n.id}[${safeLabel}]:::${typeClass}\\n`;
  });
  
  if (flow.edges) {
    flow.edges.forEach((e: any) => {
      const safeEdgeLabel = e.label ? e.label.replace(/["\\(\\)\\[\\]\\{\\}]/g, '') : '';
      code += `  ${e.source} ${safeEdgeLabel ? `-->|${safeEdgeLabel}|` : '-->'} ${e.target}\\n`;
    });
  }
  return code;
}

// ── 2. UI Components ───────────────────────────────────────────────────────

const PotensiItem = ({ p, index }: { p: any, index: number }) => (
  <div className="analytical-card potensi">
    <div className="ac-header">
      <div className="ac-number">{index + 1}</div>
      <div className="ac-title">{cleanInlineMarkdown(p.statement)}</div>
    </div>
    <div className="ac-grid">
      <div className="ac-row"><span className="ac-label">Alasan:</span> <span className="ac-val">{cleanInlineMarkdown(p.why)}</span></div>
      <div className="ac-row"><span className="ac-label">Kondisi:</span> <span className="ac-val">{cleanInlineMarkdown(p.baseline)}</span></div>
      <div className="ac-row"><span className="ac-label">Standar:</span> <span className="ac-val">{cleanInlineMarkdown(p.standard)}</span></div>
      <div className="ac-row"><span className="ac-label">Gap/Peluang:</span> <span className="ac-val highlight-green">{cleanInlineMarkdown(p.gap)}</span></div>
      <div className="ac-row"><span className="ac-label">Implikasi:</span> <span className="ac-val">{cleanInlineMarkdown(p.implication)}</span></div>
    </div>
  </div>
)

const MasalahItem = ({ m, index }: { m: any, index: number }) => (
  <div className="analytical-card masalah">
    <div className="ac-header">
      <div className="ac-number">{index + 1}</div>
      <div className="ac-title">{cleanInlineMarkdown(m.statement)}</div>
    </div>
    <div className="ac-grid">
      <div className="ac-row"><span className="ac-label">Penyebab:</span> <span className="ac-val">{cleanInlineMarkdown(m.cause)}</span></div>
      <div className="ac-row"><span className="ac-label">Kondisi:</span> <span className="ac-val">{cleanInlineMarkdown(m.baseline)}</span></div>
      <div className="ac-row"><span className="ac-label">Standar:</span> <span className="ac-val">{cleanInlineMarkdown(m.standard)}</span></div>
      <div className="ac-row"><span className="ac-label">Kesenjangan:</span> <span className="ac-val highlight-red">{cleanInlineMarkdown(m.gap)}</span></div>
      <div className="ac-row"><span className="ac-label">Dampak:</span> <span className="ac-val">{cleanInlineMarkdown(m.impact)}</span></div>
      <div className="ac-row"><span className="ac-label">Data/Tahun:</span> <span className="ac-val meta">{cleanInlineMarkdown(m.dataYear)}</span></div>
    </div>
  </div>
)

const PerspectiveCard = ({ data }: { data: any }) => {
  // Map role ke icon
  const getRoleIcon = (role: string) => {
    const r = role.toLowerCase()
    if (r.includes('akademisi')) return <Lightbulb size={16} />
    if (r.includes('pemerintah')) return <Map size={16} />
    if (r.includes('planner')) return <Target size={16} />
    return <User size={16} />
  }

  return (
    <div className="perspective-card">
      <div className="pc-header">
        <div className="pc-avatar">{getRoleIcon(data.role)}</div>
        <div className="pc-info">
          <div className="pc-name">{cleanInlineMarkdown(data.name || 'Anonim')}</div>
          <div className="pc-role">{cleanInlineMarkdown(data.role)} • <span style={{ fontStyle: 'italic', color: '#9CA3AF' }}>{cleanInlineMarkdown(data.profile)}</span></div>
        </div>
      </div>
      <div className="pc-comment">"{renderFormattedText(data.comment)}"</div>
    </div>
  )
}

// ── 3. Main Renderer ───────────────────────────────────────────────────────

export default function PlanningRenderer({ data, tool }: { data: any, tool?: string }) {
  if (!data) return <div style={{ opacity: 0.5 }}>Belum ada hasil analisis.</div>

  let labelGreen = 'RUMUSAN POTENSI';
  let labelRed = 'RUMUSAN MASALAH';
  
  if (tool === 'isu') { labelGreen = 'PELUANG / TREN GLOBAL'; labelRed = 'ISU STRATEGIS PRIORITAS'; }
  if (tool === 'tujuan') { labelGreen = 'TUJUAN (GOALS)'; labelRed = 'SASARAN (OBJECTIVES)'; }
  if (tool === 'cascading') { labelGreen = 'KONSEP MAKRO'; labelRed = 'CASCADING MIKRO'; }
  if (tool === 'program') { labelGreen = 'PROGRAM PRIORITAS'; labelRed = 'SUB-PROGRAM / MITIGASI'; }
  if (tool === 'logframe') { labelGreen = 'CAPAIAN OUTCOME'; labelRed = 'ASUMSI / RISIKO'; }
  if (tool === 'consistency') { labelGreen = 'ELEMEN SELARAS'; labelRed = 'INKONSISTENSI KEBIJAKAN'; }

  // MODE NARASI LAPORAN
  if (data.narasiLaporan) {
    const paragraphs = data.narasiLaporan.split('\n').filter((p: string) => p.trim())
    return (
      <div className="planning-output">
        <div className="narasi-badge"><MessageSquareText size={14} /> MODE NARASI LAPORAN AKTIF</div>
        {paragraphs.map((p: string, i: number) => {
          if (p.startsWith('#')) {
            const level = p.match(/^#+/)?.[0].length || 2
            return <h2 key={i} className={`h${level}`}>{renderFormattedText(p.replace(/^#+\s*/, ''))}</h2>
          }
          return <p key={i} className="paragraph">{renderFormattedText(p)}</p>
        })}
      </div>
    )
  }

  // FALLBACK LOGIC
  const hasStructuredData = (data.potentialStatements && data.potentialStatements.length > 0) || 
                            (data.problemStatements && data.problemStatements.length > 0) || 
                            (data.tables && data.tables.length > 0);

  // MODE ANALISIS TERSTRUKTUR
  return (
    <div className="planning-output">
      
      {data.summary && (
        <div className="section-block">
          <h2 className="section-title text-indigo"><Lightbulb size={18} /> RINGKASAN EKSEKUTIF</h2>
          <div className="paragraph" style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            {renderFormattedText(data.summary)}
          </div>
        </div>
      )}

      {!hasStructuredData && data.summary && (
        <div className="empty-state" style={{ marginTop: '20px', opacity: 0.8 }}>
          <AlertTriangle size={24} className="text-warning" style={{ marginBottom: '10px' }} />
          <div>Structured sections are not available yet. Showing raw summary fallback.</div>
        </div>
      )}
      
      {/* 1. Potensi */}
      {data.potentialStatements && data.potentialStatements.length > 0 && (
        <div className="section-block">
          <h2 className="section-title text-green"><Crosshair size={18} /> {labelGreen}</h2>
          <div className="cards-container">
            {data.potentialStatements.map((p: any, i: number) => <PotensiItem key={i} p={p} index={i} />)}
          </div>
        </div>
      )}

      {/* 2. Masalah */}
      {data.problemStatements && data.problemStatements.length > 0 && (
        <div className="section-block">
          <h2 className="section-title text-red"><AlertTriangle size={18} /> {labelRed}</h2>
          <div className="cards-container">
            {data.problemStatements.map((m: any, i: number) => <MasalahItem key={i} m={m} index={i} />)}
          </div>
        </div>
      )}

      {/* 3. Tabel Sintesis */}
      {data.tables && data.tables.map((t: any, i: number) => (
        <div key={i} className="section-block">
          {t.title && <h3 className="table-title">{cleanInlineMarkdown(t.title)}</h3>}
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>{t.headers?.map((h: string, j: number) => <th key={j}>{cleanInlineMarkdown(h)}</th>)}</tr>
              </thead>
              <tbody>
                {t.rows?.map((row: string[], j: number) => (
                  <tr key={j}>{row.map((cell: string, k: number) => <td key={k}>{renderFormattedText(cell)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* 4. Diagram CEIR */}
      {data.flow && data.flow.nodes && data.flow.nodes.length > 0 && (
        <div className="section-block mermaid-container">
          <div className="visual-header"><Zap size={14} /> DIAGRAM KETERKAITAN (CAUSE-EFFECT-IMPACT-RESPONSE)</div>
          <MermaidBlock code={generateMermaid(data.flow, labelGreen, labelRed)} />
        </div>
      )}

      {/* 4.5 Warnings & Gaps */}
      {(data.warnings?.length > 0 || data.gaps?.length > 0) && (
        <div className="section-block">
          <h2 className="section-title text-warning" style={{ color: '#F59E0B', borderBottomColor: '#F59E0B' }}>
            <AlertTriangle size={18} /> KESENJANGAN & PERINGATAN DATA
          </h2>
          <div className="cards-container">
            {data.warnings?.map((w: string, i: number) => (
              <div key={`w-${i}`} className="analytical-card" style={{ borderLeft: '4px solid #F59E0B' }}>
                <strong>WARNING:</strong> {cleanInlineMarkdown(w)}
              </div>
            ))}
            {data.gaps?.map((g: string, i: number) => (
              <div key={`g-${i}`} className="analytical-card" style={{ borderLeft: '4px solid #9CA3AF' }}>
                <strong>DATA GAP:</strong> {cleanInlineMarkdown(g)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Perspektif Stakeholder */}
      {data.perspectiveComments && data.perspectiveComments.length > 0 && (
        <div className="section-block">
          <h2 className="section-title text-indigo"><MessageSquareText size={18} /> ANALISIS MULTI-PERSPEKTIF</h2>
          <div className="perspective-grid">
            {data.perspectiveComments.map((c: any, i: number) => <PerspectiveCard key={i} data={c} />)}
          </div>
        </div>
      )}

      <style>{`
        .planning-output { font-family: 'Inter', sans-serif; color: var(--text-secondary); font-size: 14px; line-height: 1.8; }
        .narasi-badge { display: inline-flex; align-items: center; gap: 8px; background: var(--accent-dim); color: var(--accent); padding: 6px 12px; border-radius: var(--radius); font-size: 11px; font-weight: 700; letter-spacing: 1px; margin-bottom: 24px; border: 1px solid var(--accent); box-shadow: var(--shadow-glow); }
        
        .h1, .h2 { color: var(--text-primary); font-weight: 800; margin: 32px 0 16px; border-left: 4px solid var(--accent); padding-left: 12px; text-shadow: 0 0 10px var(--accent-dim); }
        .h3 { color: var(--text-primary); font-weight: 700; margin: 24px 0 12px; }
        .paragraph { margin-bottom: 16px; text-align: justify; }

        .section-block { margin-bottom: 48px; }
        .section-title { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 800; letter-spacing: 1px; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 12px; text-shadow: 0 0 10px rgba(255,255,255,0.1); }
        .text-green { color: var(--success); border-bottom-color: var(--success-dim); }
        .text-red { color: var(--error); border-bottom-color: var(--error-dim); }
        .text-indigo { color: var(--accent); border-bottom-color: var(--accent-dim); }

        .cards-container { display: flex; flex-direction: column; gap: 16px; }
        .analytical-card { background: var(--bg-card); backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; position: relative; overflow: hidden; box-shadow: var(--shadow); transition: var(--transition); }
        .analytical-card:hover { border-color: var(--border-subtle); transform: translateY(-2px); }
        .analytical-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; }
        .analytical-card.potensi::before { background: var(--success); box-shadow: 0 0 15px var(--success); }
        .analytical-card.potensi:hover { border-color: rgba(134, 239, 172, 0.3); }
        .analytical-card.masalah::before { background: var(--error); box-shadow: 0 0 15px var(--error); }
        .analytical-card.masalah:hover { border-color: rgba(252, 165, 165, 0.3); }
        
        .ac-header { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 16px; }
        .ac-number { background: var(--bg-tertiary); color: var(--text-muted); width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; border: 1px solid var(--border); }
        .ac-title { font-size: 15px; font-weight: 700; color: var(--text-primary); line-height: 1.5; }
        
        .ac-grid { display: grid; grid-template-columns: 1fr; gap: 10px; background: rgba(0,0,0,0.3); padding: 16px; border-radius: var(--radius); border: 1px solid var(--border-subtle); }
        .ac-row { display: grid; grid-template-columns: 100px 1fr; gap: 12px; font-size: 13px; align-items: baseline; }
        .ac-label { color: var(--text-muted); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
        .ac-val { color: var(--text-secondary); }
        .highlight-green { color: var(--success); font-weight: 500; text-shadow: 0 0 8px var(--success-dim); }
        .highlight-red { color: var(--error); font-weight: 500; text-shadow: 0 0 8px var(--error-dim); }
        .meta { font-style: italic; color: var(--text-muted); font-size: 11px; }

        .table-title { font-size: 13px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
        .table-wrapper { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius-lg); background: rgba(0,0,0,0.2); backdrop-filter: var(--glass-blur); }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: rgba(255,255,255,0.03); padding: 14px 16px; text-align: left; color: var(--text-muted); font-weight: 600; white-space: nowrap; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; border-bottom: 1px solid var(--border); }
        td { padding: 14px 16px; border-bottom: 1px solid var(--border-subtle); vertical-align: top; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: rgba(255,255,255,0.02); }

        .mermaid-container { padding: 24px; background: rgba(0,0,0,0.2); border: 1px dashed var(--border); border-radius: var(--radius-lg); backdrop-filter: var(--glass-blur); }
        .visual-header { font-size: 11px; font-weight: 800; color: var(--accent); letter-spacing: 2px; margin-bottom: 24px; display: flex; align-items: center; gap: 8px; text-shadow: 0 0 10px var(--accent-dim); }

        .perspective-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; }
        .perspective-card { background: var(--bg-card); backdrop-filter: var(--glass-blur); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px; display: flex; flex-direction: column; gap: 16px; transition: var(--transition); box-shadow: var(--shadow); }
        .perspective-card:hover { border-color: rgba(196, 181, 253, 0.3); box-shadow: 0 0 20px rgba(196, 181, 253, 0.1); transform: translateY(-2px); }
        .pc-header { display: flex; gap: 16px; align-items: center; }
        .pc-avatar { width: 44px; height: 44px; background: rgba(196, 181, 253, 0.1); color: var(--purple); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid rgba(196, 181, 253, 0.2); }
        .pc-name { font-weight: 700; color: var(--text-primary); font-size: 15px; }
        .pc-role { font-size: 12px; color: var(--purple); font-weight: 600; }
        .pc-comment { font-size: 13px; color: var(--text-secondary); line-height: 1.7; background: rgba(0,0,0,0.3); padding: 16px; border-radius: var(--radius); border-bottom-left-radius: 4px; border: 1px solid var(--border-subtle); font-style: italic; }
      `}</style>
    </div>
  )
}
