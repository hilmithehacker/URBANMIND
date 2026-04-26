import { useState } from 'react';
import { FileCheck2, Settings, Download, Trash2, FileUp, AlertTriangle } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

export default function PDFToolkit() {
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [splitFile, setSplitFile] = useState<File | null>(null);
  const [splitStart, setSplitStart] = useState<number>(1);
  const [splitEnd, setSplitEnd] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [splitLoading, setSplitLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
      if (files.length === 0) {
        setError('Hanya file PDF yang didukung.');
        return;
      }
      setPdfFiles(prev => [...prev, ...files]);
      setError('');
    }
  };

  const removeFile = (index: number) => {
    setPdfFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleMerge = async () => {
    if (pdfFiles.length < 2) {
      setError('Pilih minimal 2 file untuk digabung.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const mergedPdf = await PDFDocument.create();
      for (const file of pdfFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }
      
      const mergedPdfFile = await mergedPdf.save();
      const blob = new Blob([mergedPdfFile as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Merged_${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Gagal menggabungkan PDF. File mungkin terenkripsi atau rusak.');
    } finally {
      setLoading(false);
    }
  };

  const handleSplitFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (e.target.files[0].type !== 'application/pdf') {
        setError('Hanya file PDF yang didukung.');
        return;
      }
      setSplitFile(e.target.files[0]);
      setError('');
    }
  };

  const handleSplit = async () => {
    if (!splitFile) return;
    if (splitStart < 1 || splitEnd < splitStart) {
      setError('Rentang halaman tidak valid.');
      return;
    }
    setSplitLoading(true);
    setError('');
    try {
      const arrayBuffer = await splitFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const totalPages = pdf.getPageCount();
      
      if (splitStart > totalPages || splitEnd > totalPages) {
        setError(`Dokumen hanya memiliki ${totalPages} halaman.`);
        setSplitLoading(false);
        return;
      }

      const splitPdf = await PDFDocument.create();
      const pageIndices = Array.from({ length: splitEnd - splitStart + 1 }, (_, i) => splitStart - 1 + i);
      const copiedPages = await splitPdf.copyPages(pdf, pageIndices);
      copiedPages.forEach((page) => splitPdf.addPage(page));
      
      const splitPdfFile = await splitPdf.save();
      const blob = new Blob([splitPdfFile as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Split_${splitStart}-${splitEnd}_${splitFile.name}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Gagal memisahkan PDF. File mungkin terenkripsi atau rusak.');
    } finally {
      setSplitLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header glass-panel" style={{ margin: '20px 20px 0', borderRadius: 'var(--radius-xl)', borderBottom: 'none' }}>
        <div>
          <div className="page-header-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileCheck2 size={24} className="text-accent" /> Smart PDF Toolkit
          </div>
          <div className="page-header-sub">Alat manipulasi PDF instan, lokal, dan aman. Tidak ada file yang diunggah ke server.</div>
        </div>
      </div>

      <div className="page-content">
        {error && (
          <div className="alert alert-warning glass-panel" style={{ marginBottom: 20 }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        <div className="grid-2">
          {/* Merge PDF Card */}
          <div className="card glass-panel">
            <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={18} /> Gabung PDF (Merge)
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Gabungkan beberapa file PDF menjadi satu dokumen utuh secara offline.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label className="btn btn-secondary w-100" style={{ justifyContent: 'center', cursor: 'pointer' }}>
                <FileUp size={16} /> Pilih File PDF
                <input type="file" multiple accept=".pdf" style={{ display: 'none' }} onChange={handleFileUpload} />
              </label>
            </div>

            {pdfFiles.length > 0 && (
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>File Terpilih</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pdfFiles.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, background: 'var(--bg-primary)', padding: '6px 10px', borderRadius: 6 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{f.name}</span>
                      <button className="btn-icon" onClick={() => removeFile(i)} style={{ color: 'var(--error)' }}><Trash2 size={14}/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button 
              className="btn btn-primary w-100 glow" 
              onClick={handleMerge} 
              disabled={loading || pdfFiles.length < 2}
            >
              {loading ? 'Memproses...' : <><Download size={16}/> Gabung & Unduh</>}
            </button>
          </div>

          {/* Split PDF Card */}
          <div className="card glass-panel">
            <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={18} /> Pisah PDF (Split)
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Ambil halaman tertentu dari satu dokumen PDF.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label className="btn btn-secondary w-100" style={{ justifyContent: 'center', cursor: 'pointer' }}>
                <FileUp size={16} /> Pilih File PDF
                <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleSplitFileUpload} />
              </label>
            </div>

            {splitFile && (
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>File Terpilih</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, background: 'var(--bg-primary)', padding: '6px 10px', borderRadius: 6, marginBottom: 12 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{splitFile.name}</span>
                  <button className="btn-icon" onClick={() => setSplitFile(null)} style={{ color: 'var(--error)' }}><Trash2 size={14}/></button>
                </div>
                
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Dari Halaman</label>
                    <input type="number" min="1" value={splitStart} onChange={e => setSplitStart(parseInt(e.target.value) || 1)} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sampai Halaman</label>
                    <input type="number" min="1" value={splitEnd} onChange={e => setSplitEnd(parseInt(e.target.value) || 1)} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
                  </div>
                </div>
              </div>
            )}

            <button 
              className="btn btn-primary w-100 glow" 
              onClick={handleSplit} 
              disabled={splitLoading || !splitFile}
            >
              {splitLoading ? 'Memproses...' : <><Download size={16}/> Pisah & Unduh</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
