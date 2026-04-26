import React, { useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { usePlanningStore, type PlanningTool } from '../store/planningStore'
import axios from 'axios'
import {
  Loader, CheckCircle2, MousePointer2, FilePlus, Layers, Zap, Target, 
  Construction, ClipboardCheck, Download, Copy, Send, Paperclip, FileText, X, ChevronRight, BookOpen
} from 'lucide-react'
import PlanningRenderer from './planning/PlanningRenderer'



function normalizePlanningResponse(raw: any) {
  const fallback = {
    summary: '',
    potentialStatements: [],
    problemStatements: [],
    tables: [],
    flow: { nodes: [], edges: [] },
    perspectiveComments: [],
    warnings: [],
    gaps: [],
    narasiLaporan: ''
  };

  if (!raw) return fallback;

  if (typeof raw === 'string') {
    return { ...fallback, summary: raw };
  }

  const textMatch = raw.summary || raw.answer || raw.text || raw.output || "";

  return {
    summary: typeof textMatch === 'string' ? textMatch : "",
    potentialStatements: Array.isArray(raw.potentialStatements) ? raw.potentialStatements : (Array.isArray(raw.potensi) ? raw.potensi : []),
    problemStatements: Array.isArray(raw.problemStatements) ? raw.problemStatements : (Array.isArray(raw.masalah) ? raw.masalah : []),
    tables: Array.isArray(raw.tables) ? raw.tables : [],
    flow: raw.flow && Array.isArray(raw.flow.nodes) ? raw.flow : { nodes: [], edges: [] },
    perspectiveComments: Array.isArray(raw.perspectiveComments) ? raw.perspectiveComments : [],
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
    gaps: Array.isArray(raw.gaps) ? raw.gaps : [],
    narasiLaporan: typeof raw.narasiLaporan === 'string' ? raw.narasiLaporan : ''
  };
}

function cleanMarkdownText(text: string): string {
  if (!text) return '';
  return text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#+\s/g, '').trim();
}

const TOOLS: { id: PlanningTool; label: string; icon: any; desc: string }[] = [
  { id: 'potensi_masalah',   label: 'Potensi & Masalah',  icon: MousePointer2, desc: 'Identifikasi awal' },
  { id: 'isu',               label: 'Isu Utama',          icon: Zap,           desc: 'Rumuskan isu strategis' },
  { id: 'tujuan',            label: 'Tujuan & Sasaran',   icon: Target,        desc: 'Susun target terukur' },
  { id: 'cascading',         label: 'Konsep & Cascading', icon: Construction,  desc: 'Strategi turunan' },
  { id: 'program',           label: 'Indikasi Program',   icon: FilePlus,      desc: 'Rencana operasional' },
  { id: 'logframe',          label: 'Logframe',           icon: Layers,        desc: 'Kerangka logis' },
  { id: 'consistency',       label: 'Consistency Check',  icon: ClipboardCheck,desc: 'Validasi alur' },
]

export default function Planning() {
  const { activeProject } = useApp()
  const { success, error: toastErr } = useToast()

  const { activeTool, setActiveTool, results, setResult, loading, setLoading } = usePlanningStore()

  const [chatInput, setChatInput] = useState('')
  const [uploadedFile, setUploadedFile] = useState<{ name: string; text: string } | null>(null)
  const [selectedContexts, setSelectedContexts] = useState<PlanningTool[]>([])
  const [loadingUpload, setLoadingUpload] = useState(false)
  const [loadingNarrative, setLoadingNarrative] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const activeToolData = TOOLS.find(t => t.id === activeTool) || TOOLS[0]
  const completedTools = Object.keys(results).filter(k => results[k as PlanningTool] && results[k as PlanningTool].length > 0) as PlanningTool[]

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; 
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.pdf') && !file.name.endsWith('.docx') && !file.name.endsWith('.txt')) {
      return toastErr('Format Ditolak', 'Hanya PDF, DOCX, atau TXT yang diizinkan.');
    }
    if (file.size > 10 * 1024 * 1024) return toastErr('Terlalu Besar', 'Ukuran maksimal adalah 10MB.');

    setLoadingUpload(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await axios.post(`${apiBase}/api/planning/extract-doc`, file, {
        headers: { 'Content-Type': 'application/octet-stream' }
      });
      setUploadedFile({ name: file.name, text: res.data?.text || '' });
      success('Dokumen Terlampir', `Berhasil membaca ${file.name}`);
    } catch (e: any) { 
      toastErr('Ekstraksi Gagal', e?.response?.data?.error || 'Server gagal memproses dokumen.');
    } finally { 
      setLoadingUpload(false); 
    }
  }

  const runAnalysis = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeProject) return toastErr('Pilih Proyek', 'Pilih proyek terlebih dahulu di Dashboard.')
    if (!chatInput?.trim() && !uploadedFile) return toastErr('Input Kosong', 'Ketik instruksi atau lampirkan dokumen.')
    
    setLoading(activeTool, true)
    
    const filteredPrev: Record<string, any> = {}
    const currentHistory = results[activeTool] || [];
    if (currentHistory.length > 0) {
      filteredPrev['Riwayat_Percakapan_Saat_Ini'] = currentHistory[currentHistory.length - 1].data;
    }

    selectedContexts.forEach(id => { 
      const hist = results[id];
      if (hist && hist.length > 0) filteredPrev[id] = hist[hist.length - 1].data;
    });

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const res = await axios.post(`${apiBase}/api/planning/generate`, {
        projectId: activeProject.id,
        tool: activeTool,
        manualInput: chatInput,
        genMode: 'analisis',
        docContext: uploadedFile?.text || '',
        prevResults: filteredPrev,
        sources: ['manual', uploadedFile ? 'doc' : '', Object.keys(filteredPrev).length ? 'previous' : ''].filter(Boolean)
      })
      
      const responsePayload = res.data?.data ?? res.data;
      const normalized = normalizePlanningResponse(responsePayload);

      const newHistory = [...(results[activeTool] || []), { id: Date.now().toString(), query: chatInput || `Analisis Dokumen: ${uploadedFile?.name}`, data: normalized }]
      setResult(activeTool, newHistory);
      
      if (res.data?.success === false) {
        toastErr('Terjadi Kendala', res.data?.error || 'Analisis gagal, namun data parsial tetap ditampilkan.');
      } else {
        setChatInput('');
        setUploadedFile(null);
        success('Analisis Selesai', activeToolData.label);
      }
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 300);
    } catch (e: any) { 
      toastErr('Gagal', e?.response?.data?.error || 'Terjadi kesalahan saat menghubungi server.');
    } finally { 
      setLoading(activeTool, false); 
    }
  }

  const handleNarrativeGeneration = async () => {
    const currentHistory = results[activeTool];
    if (!currentHistory || currentHistory.length === 0) return toastErr('Data Kosong', 'Jalankan analisis terlebih dahulu sebelum membuat narasi laporan.');
    
    const lastTurn = currentHistory[currentHistory.length - 1];
    setLoadingNarrative(true);
    
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await axios.post(`${apiBase}/api/planning/generate`, {
        projectId: activeProject?.id,
        tool: activeTool,
        genMode: 'narasi',
        prevResults: { 'Riwayat_Percakapan_Saat_Ini': lastTurn.data },
        sources: ['previous']
      });

      const narasiData = normalizePlanningResponse(res.data?.data);
      if (!narasiData) throw new Error('Narasi tidak valid');

      const newHist = [...currentHistory];
      newHist[newHist.length - 1] = { ...lastTurn, data: { ...lastTurn.data, narasiLaporan: narasiData.narasiLaporan } };
      setResult(activeTool, newHist);
      
      success('Narasi Berhasil', 'Sub-bab laporan formal telah ditambahkan.');
    } catch (e: any) {
      toastErr('Pembuatan Narasi Gagal', e?.response?.data?.error || 'AI gagal menyusun narasi.');
    } finally {
      setLoadingNarrative(false);
    }
  }

  const toggleContext = (id: PlanningTool) => {
    setSelectedContexts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const copyClean = () => {
    const currentHistory = results[activeTool];
    if (!currentHistory || currentHistory.length === 0) return toastErr('Kosong', 'Tidak ada data untuk disalin.');
    const data = currentHistory[currentHistory.length - 1].data;

    let textToCopy = '';
    if (data.narasiLaporan) {
      textToCopy = cleanMarkdownText(data.narasiLaporan);
    } else {
      let labelGreen = 'POTENSI'; let labelRed = 'MASALAH';
      if (activeTool === 'isu') { labelGreen = 'PELUANG / TREN'; labelRed = 'ISU PRIORITAS'; }
      if (activeTool === 'tujuan') { labelGreen = 'TUJUAN'; labelRed = 'SASARAN'; }
      if (activeTool === 'cascading') { labelGreen = 'KONSEP MAKRO'; labelRed = 'CASCADING MIKRO'; }
      if (activeTool === 'program') { labelGreen = 'PROGRAM UTAMA'; labelRed = 'SUB-PROGRAM'; }
      if (activeTool === 'logframe') { labelGreen = 'OUTCOME'; labelRed = 'RISIKO'; }
      if (activeTool === 'consistency') { labelGreen = 'ELEMEN SELARAS'; labelRed = 'INKONSISTENSI'; }

      if (data.summary) textToCopy += `RINGKASAN:\\n${cleanMarkdownText(data.summary)}\\n\\n`;
      if (data.potentialStatements?.length) textToCopy += `${labelGreen}:\\n` + data.potentialStatements.map((p: any) => `- ${cleanMarkdownText(p.statement)}`).join('\\n') + '\\n\\n';
      if (data.problemStatements?.length) textToCopy += `${labelRed}:\\n` + data.problemStatements.map((m: any) => `- ${cleanMarkdownText(m.statement)}`).join('\\n') + '\\n\\n';
    }
    
    navigator.clipboard.writeText(textToCopy);
    success('Berhasil Salin', 'Teks bersih siap digunakan di laporan.');
  }

  const downloadAsMD = () => {
    const currentHistory = results[activeTool];
    if (!currentHistory || currentHistory.length === 0) return toastErr('Kosong', 'Tidak ada data untuk diunduh.');
    const data = currentHistory[currentHistory.length - 1].data;

    let content = `# Laporan Analisis: ${activeToolData.label}\\n\\n`;
    if (data.narasiLaporan) {
      content += data.narasiLaporan;
    } else {
      let labelGreen = 'Rumusan Potensi'; let labelRed = 'Rumusan Masalah';
      if (activeTool === 'isu') { labelGreen = 'Peluang / Tren Global'; labelRed = 'Isu Strategis Prioritas'; }
      if (activeTool === 'tujuan') { labelGreen = 'Tujuan (Goals)'; labelRed = 'Sasaran (Objectives)'; }
      if (activeTool === 'cascading') { labelGreen = 'Konsep Makro'; labelRed = 'Cascading Mikro'; }
      if (activeTool === 'program') { labelGreen = 'Program Utama'; labelRed = 'Sub-Program / Mitigasi'; }
      if (activeTool === 'logframe') { labelGreen = 'Capaian Outcome'; labelRed = 'Asumsi / Risiko'; }
      if (activeTool === 'consistency') { labelGreen = 'Elemen Selaras'; labelRed = 'Inkonsistensi Kebijakan'; }

      if (data.summary) content += `## Ringkasan Eksekutif\\n${data.summary}\\n\\n`;
      if (data.potentialStatements?.length) content += `## ${labelGreen}\\n${data.potentialStatements.map((p: any) => `- **${p.statement}**\\n  - Alasan: ${p.why}\\n  - Gap: ${p.gap}`).join('\\n')}\\n\\n`;
      if (data.problemStatements?.length) content += `## ${labelRed}\\n${data.problemStatements.map((m: any) => `- **${m.statement}**\\n  - Penyebab: ${m.cause}\\n  - Dampak: ${m.impact}`).join('\\n')}\\n\\n`;
    }
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; 
    a.download = `UrbanMind_${activeTool}.md`; 
    a.click();
    URL.revokeObjectURL(url);
  }

  const isAnyLoading = loading[activeTool] || loadingNarrative || loadingUpload;

  return (
    <div className="planning-layout">
      {/* TOP: Horizontal Tool Selector */}
      <div className="top-stepper glass-panel">
        <div className="stepper-scroll">
          {TOOLS.map((t, index) => (
            <React.Fragment key={t.id}>
              <button 
                onClick={() => setActiveTool(t.id)} 
                className={`step-btn ${activeTool === t.id ? 'active' : ''} ${results[t.id]?.length ? 'completed' : ''}`}
              >
                <div className="step-icon"><t.icon size={16} /></div>
                <div className="step-text">
                  <div className="step-label">{t.label}</div>
                  <div className="step-desc">{t.desc}</div>
                </div>
                {results[t.id]?.length > 0 && <CheckCircle2 size={14} className="step-check" />}
              </button>
              {index < TOOLS.length - 1 && <ChevronRight size={16} className="step-arrow" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="planning-workspace">
        {/* CENTER: Main AI Output Area */}
        <div className="center-canvas">
          <div className="canvas-scroll">
            {loading[activeTool] ? (
              <div className="empty-state">
                <Loader size={48} className="spin text-accent" />
                <div className="es-text">Memproses analisis mendalam...</div>
              </div>
            ) : results[activeTool]?.length > 0 ? (
              <div className="chat-history">
                {results[activeTool].map((turn: any) => (
                  <div key={turn.id} className="ai-message fade-in">
                    <div className="ai-query glass-panel">
                      <div className="q-badge">USER</div>
                      <div className="q-text">{turn.query}</div>
                    </div>
                    <div className="ai-response">
                      <PlanningRenderer data={turn.data} tool={activeTool} />
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            ) : (
              <div className="empty-state opacity-low">
                <activeToolData.icon size={64} className="text-accent" />
                <div className="es-title">{activeToolData.label}</div>
                <div className="es-desc">Belum ada analisis. Mulai dengan memberikan instruksi atau data.</div>
              </div>
            )}
          </div>

          {/* BOTTOM: Sticky Chat Input */}
          <div className="bottom-chat-bar glass-panel">
            <div className="context-selector">
              <span className="ctx-label">Gunakan Konteks:</span>
              {completedTools.length === 0 ? <span className="ctx-empty">Belum ada memori</span> : (
                <div className="ctx-pills">
                  {completedTools.filter(id => id !== activeTool).map(id => {
                    const t = TOOLS.find(x => x.id === id);
                    const isSelected = selectedContexts.includes(id);
                    return (
                      <button key={id} onClick={() => toggleContext(id)} className={`ctx-pill ${isSelected ? 'active' : ''}`}>
                        {t?.label} {isSelected && <X size={12} />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <form className="chat-input-row" onSubmit={runAnalysis}>
              <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} accept=".pdf,.docx,.txt" />
              <button type="button" className={`btn-icon ${uploadedFile ? 'text-accent' : ''}`} onClick={() => fileInputRef.current?.click()}>
                <Paperclip size={20} />
              </button>
              
              <input 
                type="text" 
                className="main-input" 
                placeholder={isAnyLoading ? "Memproses..." : `Instruksi untuk ${activeToolData.label}...`}
                value={chatInput} 
                onChange={e => setChatInput(e.target.value)} 
                disabled={isAnyLoading} 
              />
              
              {uploadedFile && (
                <div className="file-chip">
                  <FileText size={12} /> {uploadedFile.name}
                  <button type="button" onClick={() => setUploadedFile(null)}><X size={12}/></button>
                </div>
              )}

              <button type="submit" className="btn-send glow" disabled={isAnyLoading || (!chatInput.trim() && !uploadedFile)}>
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT PANEL: Actions */}
        <div className="right-panel glass-panel">
          <div className="panel-section">
            <div className="panel-title"><BookOpen size={16} className="text-purple"/> MODE LAPORAN</div>
            <p className="panel-desc">Sintesis struktur analisis di atas menjadi narasi dokumen formal yang utuh.</p>
            <button className="btn-primary w-100 glow-purple" onClick={handleNarrativeGeneration} disabled={isAnyLoading || !results[activeTool]?.length}>
              {loadingNarrative ? <Loader size={16} className="spin" /> : 'Generate Narasi Laporan'}
            </button>
          </div>

          <div className="panel-section mt-auto">
            <div className="panel-title"><Download size={16} className="text-accent"/> EKSPOR HASIL</div>
            <button className="btn-outline w-100" onClick={downloadAsMD} disabled={!results[activeTool]?.length}>
              <Download size={14}/> Download Markdown
            </button>
            <button className="btn-outline w-100" onClick={copyClean} disabled={!results[activeTool]?.length}>
              <Copy size={14}/> Copy Teks Bersih
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .planning-layout { display: flex; flex-direction: column; height: calc(100vh - 60px); background: var(--bg-primary); }
        
        /* TOP STEPPER */
        .top-stepper { margin: 16px 24px 0; padding: 12px; border-radius: var(--radius-lg); z-index: 10; flex-shrink: 0; }
        .stepper-scroll { display: flex; align-items: center; gap: 12px; overflow-x: auto; padding-bottom: 4px; }
        .stepper-scroll::-webkit-scrollbar { height: 4px; }
        .step-btn { display: flex; align-items: center; gap: 12px; background: transparent; border: 1px solid transparent; padding: 8px 16px; border-radius: var(--radius); cursor: pointer; transition: var(--transition); min-width: 180px; text-align: left; }
        .step-btn:hover { background: rgba(255,255,255,0.05); }
        .step-btn.active { background: var(--bg-secondary); border-color: var(--accent); box-shadow: var(--shadow-glow); }
        .step-icon { color: var(--text-muted); }
        .step-btn.active .step-icon { color: var(--accent); }
        .step-btn.completed .step-icon { color: var(--success); }
        .step-text { flex: 1; }
        .step-label { font-size: 13px; font-weight: 600; color: var(--text-primary); }
        .step-desc { font-size: 11px; color: var(--text-muted); }
        .step-check { color: var(--success); }
        .step-arrow { color: var(--border); flex-shrink: 0; }

        /* WORKSPACE */
        .planning-workspace { display: flex; flex: 1; overflow: hidden; padding: 16px 24px 24px; gap: 24px; }
        
        /* CENTER CANVAS */
        .center-canvas { flex: 1; display: flex; flex-direction: column; position: relative; min-width: 0; }
        .canvas-scroll { flex: 1; overflow-y: auto; padding-right: 12px; padding-bottom: 140px; }
        .empty-state { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; text-align: center; }
        .empty-state.opacity-low { opacity: 0.3; }
        .es-title { font-size: 24px; font-weight: 700; color: var(--text-primary); }
        .es-desc { font-size: 14px; color: var(--text-muted); max-width: 400px; }
        .es-text { font-size: 14px; color: var(--accent); font-weight: 500; }
        .text-accent { color: var(--accent); }
        .text-purple { color: var(--purple); }

        .chat-history { display: flex; flex-direction: column; gap: 32px; max-width: 900px; margin: 0 auto; }
        .ai-message { display: flex; flex-direction: column; gap: 16px; }
        .ai-query { display: flex; gap: 12px; padding: 12px 16px; border-radius: var(--radius); align-self: flex-end; max-width: 80%; border-color: var(--border-subtle); }
        .q-badge { font-size: 10px; font-weight: 800; color: var(--text-muted); background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; height: fit-content; }
        .q-text { font-size: 14px; color: var(--text-primary); }
        .ai-response { width: 100%; }

        /* BOTTOM CHAT BAR */
        .bottom-chat-bar { position: absolute; bottom: 0; left: 0; right: 12px; border-radius: var(--radius-xl); padding: 16px; display: flex; flex-direction: column; gap: 12px; border: 1px solid var(--border); }
        .context-selector { display: flex; align-items: center; gap: 12px; }
        .ctx-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
        .ctx-empty { font-size: 11px; color: var(--text-muted); font-style: italic; }
        .ctx-pills { display: flex; gap: 8px; flex-wrap: wrap; }
        .ctx-pill { background: transparent; border: 1px solid var(--border); color: var(--text-secondary); padding: 4px 10px; border-radius: 20px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: var(--transition); }
        .ctx-pill:hover { border-color: var(--accent); color: var(--text-primary); }
        .ctx-pill.active { background: var(--accent-dim); border-color: var(--accent); color: var(--accent); }
        
        .chat-input-row { display: flex; align-items: center; gap: 12px; background: var(--bg-secondary); padding: 8px 12px 8px 16px; border-radius: var(--radius-lg); border: 1px solid var(--border); transition: var(--transition); }
        .chat-input-row:focus-within { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
        .main-input { flex: 1; background: transparent; border: none; color: var(--text-primary); font-size: 15px; outline: none; }
        .btn-icon { background: transparent; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; transition: 0.2s; }
        .btn-icon:hover { color: var(--text-primary); }
        
        .file-chip { display: flex; align-items: center; gap: 6px; background: var(--bg-tertiary); padding: 4px 10px; border-radius: 12px; font-size: 12px; color: var(--text-primary); }
        .file-chip button { background: transparent; border: none; color: var(--error); cursor: pointer; display: flex; align-items: center; }

        .btn-send { background: var(--accent); color: #0B0F19; border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: var(--transition); }
        .btn-send:hover:not(:disabled) { background: var(--accent-hover); transform: scale(1.05); }
        .btn-send:disabled { background: var(--bg-tertiary); color: var(--text-muted); cursor: not-allowed; }
        .btn-send.glow { box-shadow: var(--shadow-glow); }

        /* RIGHT PANEL */
        .right-panel { width: 320px; border-radius: var(--radius-lg); padding: 24px; display: flex; flex-direction: column; gap: 32px; flex-shrink: 0; overflow-y: auto; }
        .panel-section { display: flex; flex-direction: column; gap: 12px; }
        .panel-title { font-size: 12px; font-weight: 800; letter-spacing: 1px; color: var(--text-primary); display: flex; align-items: center; gap: 8px; }
        .panel-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 8px; }
        .mt-auto { margin-top: auto; }

        .w-100 { width: 100%; }
        .btn-primary { background: var(--accent); color: #0B0F19; border: none; padding: 12px; border-radius: var(--radius); font-weight: 600; font-size: 13px; cursor: pointer; transition: var(--transition); display: flex; align-items: center; justify-content: center; gap: 8px; }
        .btn-primary.glow-purple { background: var(--purple); box-shadow: 0 0 15px rgba(196, 181, 253, 0.3); }
        .btn-primary:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.1); }
        .btn-primary:disabled { background: var(--bg-tertiary); color: var(--text-muted); cursor: not-allowed; box-shadow: none; }

        .btn-outline { background: transparent; border: 1px solid var(--border); color: var(--text-secondary); padding: 10px; border-radius: var(--radius); font-weight: 500; font-size: 13px; cursor: pointer; transition: var(--transition); display: flex; align-items: center; justify-content: center; gap: 8px; }
        .btn-outline:hover:not(:disabled) { border-color: var(--text-muted); color: var(--text-primary); }
        .btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }

        .fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
