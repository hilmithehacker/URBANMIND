import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { parse as csvParse } from 'csv-parse/sync';
import { openrouterGenerate, openrouterAvailable } from '../services/openrouterProvider';
import { aiProvider } from '../services/aiProvider';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

// ─── Helpers ────────────────────────────────────────────────────────────────

function tryParseCSV(buffer: Buffer): Record<string, any>[] | null {
  const encodings = ['utf-8', 'latin1', 'utf-16le'];
  for (const enc of encodings) {
    try {
      const text = buffer.toString(enc as BufferEncoding);
      const records = csvParse(text, {
        columns: true, skip_empty_lines: true, trim: true, relax_column_count: true
      }) as Record<string, any>[];
      if (records.length > 0) return records;
    } catch (_) {}
  }
  return null;
}

function parseBuffer(buffer: Buffer, mimetype: string, originalname: string): {
  headers: string[];
  rows: Record<string, any>[];
  rowCount: number;
  columnCount: number;
  sheetName?: string;
  sheets?: string[];
  fileType: string;
} {
  const ext = originalname.toLowerCase().split('.').pop() || '';

  // ── CSV ──
  if (ext === 'csv' || mimetype === 'text/csv' || mimetype === 'application/csv') {
    const records = tryParseCSV(buffer);
    if (!records || records.length === 0) throw new Error('File CSV kosong atau tidak dapat dibaca. Cek encoding dan delimiter.');
    const headers = Object.keys(records[0]);
    if (headers.length === 0) throw new Error('Kolom CSV tidak terbaca. Pastikan baris pertama berisi header.');
    return { headers, rows: records, rowCount: records.length, columnCount: headers.length, fileType: 'CSV' };
  }

  // ── DBF ──
  if (ext === 'dbf') {
    try {
      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true, codepage: 1252 });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, any>[];
      if (rows.length === 0) throw new Error('DBF kosong atau tidak ada record yang terbaca.');
      const headers = Object.keys(rows[0]);
      return { headers, rows, rowCount: rows.length, columnCount: headers.length, sheetName, fileType: 'DBF' };
    } catch (e: any) {
      throw new Error(`Gagal membaca DBF: ${e.message}. Pastikan file DBF valid (dBASE III/IV/V).`);
    }
  }

  // ── XLSX / XLS / ODS ──
  try {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    if (wb.SheetNames.length === 0) throw new Error('File Excel tidak memiliki sheet.');
    const sheets = wb.SheetNames;
    const sheetName = sheets[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, any>[];
    if (rows.length === 0) throw new Error(`Sheet "${sheetName}" kosong. Pilih sheet lain atau periksa file.`);
    const headers = Object.keys(rows[0]);
    return { headers, rows, rowCount: rows.length, columnCount: headers.length, sheetName, sheets, fileType: ext.toUpperCase() };
  } catch (e: any) {
    throw new Error(`Gagal membaca Excel: ${e.message}`);
  }
}

function computeStats(rows: Record<string, any>[], headers: string[]) {
  const stats: Record<string, any> = {};
  const total = rows.length;
  for (const col of headers) {
    const rawValues = rows.map(r => r[col]);
    const nonNull = rawValues.filter(v => v !== null && v !== undefined && v !== '');
    const missing = total - nonNull.length;
    const numbers = nonNull.map(Number).filter(v => !isNaN(v));

    if (numbers.length > nonNull.length * 0.6 && numbers.length > 0) {
      const sorted = [...numbers].sort((a, b) => a - b);
      const sum = numbers.reduce((a, b) => a + b, 0);
      const mean = sum / numbers.length;
      const variance = numbers.reduce((a, b) => a + (b - mean) ** 2, 0) / numbers.length;
      stats[col] = {
        type: 'numeric', count: numbers.length, missing,
        min: +sorted[0].toFixed(4), max: +sorted[sorted.length - 1].toFixed(4),
        mean: +mean.toFixed(4), median: +sorted[Math.floor(sorted.length / 2)].toFixed(4),
        std: +Math.sqrt(variance).toFixed(4), sum: +sum.toFixed(4)
      };
    } else {
      const freq: Record<string, number> = {};
      nonNull.forEach(v => { const k = String(v).trim(); freq[k] = (freq[k] || 0) + 1; });
      const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
      const topValues = sorted.slice(0, 15).map(([value, count]) => ({
        value, count, pct: +((count / total) * 100).toFixed(1)
      }));
      stats[col] = {
        type: 'categorical', count: nonNull.length, missing,
        unique: Object.keys(freq).length, topValues
      };
    }
  }
  return stats;
}

function generateAutoInsight(stats: Record<string, any>, headers: string[], fileName: string): string {
  const lines: string[] = [`**Ringkasan Otomatis: ${fileName}**\n`];
  const catCols = headers.filter(h => stats[h]?.type === 'categorical');
  const numCols = headers.filter(h => stats[h]?.type === 'numeric');

  if (catCols.length > 0) {
    const col = catCols[0];
    const s = stats[col];
    const dominant = s.topValues?.[0];
    if (dominant) {
      lines.push(`- **${col}**: ${s.unique} kategori unik. Dominan: **"${dominant.value}"** (${dominant.pct}% dari total data).`);
    }
    if (s.missing > 0) lines.push(`  ⚠️ ${s.missing} nilai kosong pada kolom ${col}.`);
  }

  for (const col of numCols.slice(0, 3)) {
    const s = stats[col];
    const range = s.max - s.min;
    const cv = s.mean > 0 ? ((s.std / s.mean) * 100).toFixed(1) : '?';
    lines.push(`- **${col}**: rentang ${s.min} – ${s.max}, rata-rata **${s.mean}** (CV: ${cv}%). ${
      parseFloat(cv) > 50 ? '⚠️ Variabilitas tinggi — distribusi tidak merata.' : 'Distribusi relatif homogen.'
    }`);
    if (s.missing > 0) lines.push(`  ⚠️ ${s.missing} nilai hilang pada kolom ${col}.`);
  }

  if (catCols.length === 0 && numCols.length === 0) {
    lines.push('- Tidak ada kolom yang dapat dianalisis otomatis.');
  }

  return lines.join('\n');
}

// ─── POST /upload ────────────────────────────────────────────────────────────

router.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Tidak ada file yang dikirim.' });

    const { buffer, mimetype, originalname, size } = req.file;
    if (size === 0) return res.status(400).json({ success: false, error: 'File kosong (0 byte).' });

    const parsed = parseBuffer(buffer, mimetype, originalname);
    const stats = computeStats(parsed.rows, parsed.headers);
    const autoInsight = generateAutoInsight(stats, parsed.headers, originalname);

    // Auto-recommend best categorical col for pivot
    const catCols = parsed.headers.filter(h => stats[h]?.type === 'categorical');
    const bestCatCol = catCols.reduce((best, col) => {
      const s = stats[col];
      if (!best) return col;
      const sb = stats[best];
      // prefer col with 2–30 unique values (good for pivot/chart)
      const score = (s.unique >= 2 && s.unique <= 30) ? s.unique : 999;
      const scoreB = (sb.unique >= 2 && sb.unique <= 30) ? sb.unique : 999;
      return score < scoreB ? col : best;
    }, '' as string);

    res.json({
      success: true,
      data: {
        fileName: originalname, fileType: parsed.fileType,
        sheetName: parsed.sheetName, sheets: parsed.sheets,
        rowCount: parsed.rowCount, columnCount: parsed.columnCount,
        headers: parsed.headers, preview: parsed.rows.slice(0, 50),
        stats, autoInsight, bestCatCol,
        sampleForAI: parsed.rows.slice(0, 100)
      }
    });
  } catch (e: any) {
    res.status(422).json({ success: false, error: e.message || 'Gagal membaca file.' });
  }
});

// ─── POST /sheet (re-parse Excel with different sheet) ───────────────────────

router.post('/sheet', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Tidak ada file.' });
    const sheetIndex = parseInt(req.body.sheetIndex || '0');
    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = wb.SheetNames[sheetIndex] || wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, any>[];
    if (rows.length === 0) return res.status(422).json({ success: false, error: `Sheet "${sheetName}" kosong.` });
    const headers = Object.keys(rows[0]);
    const stats = computeStats(rows, headers);
    const autoInsight = generateAutoInsight(stats, headers, req.file.originalname);
    res.json({ success: true, data: {
      fileName: req.file.originalname, fileType: 'XLSX',
      sheetName, sheets: wb.SheetNames,
      rowCount: rows.length, columnCount: headers.length,
      headers, preview: rows.slice(0, 50), stats, autoInsight,
      sampleForAI: rows.slice(0, 100)
    }});
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── POST /frequency (DBF-aware pivot by category) ───────────────────────────

router.post('/frequency', (req: Request, res: Response) => {
  try {
    const { rows, field, topN } = req.body as {
      rows: Record<string, any>[]; field: string; topN?: number;
    };
    if (!rows || !field) return res.status(400).json({ success: false, error: 'rows dan field wajib ada.' });

    const freq: Record<string, number> = {};
    rows.forEach(r => {
      const k = String(r[field] ?? 'N/A').trim();
      freq[k] = (freq[k] || 0) + 1;
    });

    const total = rows.length;
    let entries = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    if (topN && topN > 0) entries = entries.slice(0, topN);

    const result = entries.map(([value, count]) => ({
      value, count, pct: +((count / total) * 100).toFixed(2)
    }));

    const dominant = result[0];
    const insight = dominant
      ? `Kategori terbanyak pada kolom "${field}" adalah "${dominant.value}" (${dominant.count} record, ${dominant.pct}%). ` +
        `Terdapat ${Object.keys(freq).length} kategori unik dari total ${total} baris.`
      : 'Tidak ada data.';

    res.json({ success: true, data: { field, total, result, insight } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── POST /pivot ─────────────────────────────────────────────────────────────

router.post('/pivot', (req: Request, res: Response) => {
  try {
    const { rows, rowField, colField, valueField, aggFunc = 'sum', withPct = false } = req.body as {
      rows: Record<string, any>[]; rowField: string; colField: string | null;
      valueField: string; aggFunc: 'sum' | 'count' | 'avg' | 'max' | 'min'; withPct?: boolean;
    };

    if (!rows || !rowField) return res.status(400).json({ success: false, error: 'rows dan rowField wajib.' });

    const rowKeys = [...new Set(rows.map(r => String(r[rowField] ?? 'N/A')))].sort();
    const colKeys = colField
      ? [...new Set(rows.map(r => String(r[colField!] ?? 'N/A')))].sort()
      : ['Total'];

    const agg = (vals: number[]) => {
      if (vals.length === 0) return null;
      switch (aggFunc) {
        case 'count': return vals.length;
        case 'avg': return +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
        case 'max': return Math.max(...vals);
        case 'min': return Math.min(...vals);
        default: return +vals.reduce((a, b) => a + b, 0).toFixed(2);
      }
    };

    const pivot: Record<string, Record<string, number | null>> = {};
    const grandTotal: Record<string, number> = {};

    for (const rk of rowKeys) {
      pivot[rk] = {};
      for (const ck of colKeys) {
        const filtered = rows.filter(r =>
          String(r[rowField] ?? 'N/A') === rk &&
          (!colField || String(r[colField] ?? 'N/A') === ck)
        );
        const vals = filtered.map(r => Number(r[valueField])).filter(v => !isNaN(v));
        pivot[rk][ck] = agg(aggFunc === 'count' ? filtered.map(() => 1) : vals);
        grandTotal[ck] = (grandTotal[ck] || 0) + (pivot[rk][ck] as number || 0);
      }
      const allVals = rows.filter(r => String(r[rowField] ?? 'N/A') === rk)
        .map(r => Number(r[valueField])).filter(v => !isNaN(v));
      pivot[rk]['__total__'] = agg(aggFunc === 'count'
        ? rows.filter(r => String(r[rowField] ?? 'N/A') === rk).map(() => 1)
        : allVals);
    }

    // Percentage
    const pivotPct: Record<string, Record<string, number | null>> = {};
    if (withPct) {
      const colTotals: Record<string, number> = {};
      for (const ck of colKeys) {
        colTotals[ck] = rowKeys.reduce((s, rk) => s + (pivot[rk][ck] as number || 0), 0);
      }
      for (const rk of rowKeys) {
        pivotPct[rk] = {};
        for (const ck of colKeys) {
          const v = pivot[rk][ck] as number | null;
          pivotPct[rk][ck] = v !== null && colTotals[ck] > 0
            ? +((v / colTotals[ck]) * 100).toFixed(1) : null;
        }
      }
    }

    res.json({ success: true, data: {
      pivot, pivotPct, rowKeys, colKeys, rowField, colField, valueField, aggFunc,
      grandTotal
    }});
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── POST /analyze (AI) ───────────────────────────────────────────────────────

router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { fileName, headers, stats, sampleData, analysisType, projectContext } = req.body;

    const statsText = Object.entries(stats as Record<string, any>)
      .map(([col, s]: [string, any]) => {
        if (s.type === 'numeric') {
          return `- **${col}** [numerik]: n=${s.count}, missing=${s.missing}, min=${s.min}, max=${s.max}, mean=${s.mean}, median=${s.median}, std=${s.std}`;
        } else {
          const top3 = (s.topValues || []).slice(0, 3).map((v: any) => `${v.value}(${v.count}, ${v.pct}%)`).join(', ');
          return `- **${col}** [kategorik]: ${s.unique} nilai unik, missing=${s.missing}, dominan: ${top3}`;
        }
      }).join('\n');

    const sampleText = sampleData?.length > 0
      ? `\nSample data (${Math.min(10, sampleData.length)} baris):\n${JSON.stringify(sampleData.slice(0, 10), null, 2)}`
      : '';

    const prompts: Record<string, string> = {
      general: 'Lakukan analisis komprehensif dataset ini dalam konteks perencanaan wilayah Indonesia.',
      spatial: 'Analisis distribusi spasial dan pola keruangan. Identifikasi cluster, anomali, implikasi perencanaan.',
      trend: 'Analisis tren dan pola temporal. Identifikasi pertumbuhan, penurunan, dan proyeksi.',
      regression: 'BERTINDAK SEBAGAI SOFTWARE STATISTIK SPSS. Lakukan analisis Regresi Linear sederhana/berganda terhadap variabel numerik yang relevan. Temukan variabel dependen (Y) dan independen (X). Perkirakan persamaan regresi (Y = a + bX), nilai R-Squared, dan interpretasikan pengaruh X terhadap Y secara kausalitas dan signifikansi.',
      correlation: 'BERTINDAK SEBAGAI SOFTWARE STATISTIK SPSS. Buatlah estimasi Matriks Korelasi (Pearson r) antar variabel numerik. Jelaskan mana yang memiliki korelasi positif kuat, negatif kuat, atau tidak berkorelasi. Jelaskan makna korelasi tersebut terhadap fenomena tata ruang.',
      descriptive: 'BERTINDAK SEBAGAI SOFTWARE STATISTIK SPSS. Lakukan uji Statistik Deskriptif mendalam. Evaluasi normalitas data, kemencengan (skewness), varians/standar deviasi, nilai ekstrim (outlier), dan kualitas data numerik secara keseluruhan.',
      indicator: 'Evaluasi sebagai indikator pembangunan wilayah. Bandingkan dengan SNI atau benchmark nasional.'
    };

    const prompt = `${prompts[analysisType] || prompts.general}

**Dataset: ${fileName}**${projectContext ? `\n**Konteks Proyek:** ${projectContext}` : ''}

**Struktur:** ${headers.join(', ')}

**Statistik Deskriptif:**
${statsText}
${sampleText}

Berikan:
1. **Ringkasan Dataset** — kualitas dan karakteristik data
2. **Temuan Utama** — pola, tren, anomali dengan angka spesifik
3. **Interpretasi Kontekstual** — makna dalam konteks PWK/pembangunan daerah
4. **Rekomendasi Visualisasi** — chart terbaik untuk tiap variabel
5. **Implikasi Perencanaan** — untuk pengambilan kebijakan
6. **Keterbatasan Data** — missing values, bias, caveats

Bahasa: akademis, ilmiah, sertakan angka spesifik, rujuk standar/regulasi relevan.`;

    const useOR = openrouterAvailable();
    let result;
    if (useOR) {
      result = await openrouterGenerate(prompt, undefined, 'data');
    } else if (aiProvider.isAvailable()) {
      result = await aiProvider.generateText(prompt);
    } else {
      return res.status(503).json({ success: false, error: 'AI provider tidak dikonfigurasi.' });
    }

    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message || 'Analisis gagal' });
  }
});

export { router as dataRouter };
