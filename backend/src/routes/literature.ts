import express from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { openrouterGenerate, openrouterAvailable } from '../services/openrouterProvider';
import { successResponse, errorResponse } from '../utils/response';
import { LiteratureService } from '../services/literature/literature.service';
import { NormalizedPaper } from '../services/literature/literature.types';

const router = express.Router();
const litService = new LiteratureService();
const STORAGE_FILE = path.join(__dirname, '../../data/literature_v2.json');

interface SavedPaperRecord {
  id: string;
  projectId: string;
  paper: NormalizedPaper;
  savedAt: string;
}

function loadSavedPapers(): SavedPaperRecord[] {
  const dir = path.dirname(STORAGE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STORAGE_FILE)) fs.writeFileSync(STORAGE_FILE, '[]');
  try {
    return JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf-8')) as SavedPaperRecord[];
  } catch {
    return [];
  }
}

function saveSavedPapers(records: SavedPaperRecord[]) {
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(records, null, 2));
}

router.get('/search', async (req, res) => {
  try {
    const query = String(req.query.query || '').trim();
    const yearStart = req.query.yearStart ? Number(req.query.yearStart) : undefined;
    const yearEnd = req.query.yearEnd ? Number(req.query.yearEnd) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const openAccessOnly = req.query.openAccessOnly === 'true';

    if (!query) return res.status(400).json(errorResponse('Query is required'));

    const results = await litService.search({ query, yearStart, yearEnd, limit, openAccessOnly });
    return res.json(successResponse(results, { totalReturned: results.length }));
  } catch (error: any) {
    console.error('[Literature Search Error]', error);
    return res.status(500).json(errorResponse(error?.message || 'Gagal mencari literatur.'));
  }
});

router.post('/enrich', async (req, res) => {
  try {
    const paper = req.body.paper as NormalizedPaper;
    if (!paper || !paper.title) return res.status(400).json(errorResponse('Paper object is required'));
    
    const enriched = await litService.enrich(paper);
    return res.json(successResponse(enriched));
  } catch (error: any) {
    console.error('[Literature Enrich Error]', error);
    return res.status(500).json(errorResponse(error?.message || 'Gagal memperkaya metadata.'));
  }
});

router.post('/save', (req, res) => {
  try {
    const { projectId, paper } = req.body as { projectId: string; paper: NormalizedPaper };
    if (!projectId || !paper?.title) return res.status(400).json(errorResponse('projectId dan paper diperlukan.'));
    
    const records = loadSavedPapers();
    // Check if already saved
    if (records.some(r => r.projectId === projectId && (r.paper.doi === paper.doi && r.paper.title === paper.title))) {
      return res.status(400).json(errorResponse('Paper sudah tersimpan di project ini.'));
    }

    const saved: SavedPaperRecord = {
      id: uuidv4(),
      projectId,
      paper,
      savedAt: new Date().toISOString()
    };
    records.push(saved);
    saveSavedPapers(records);
    return res.status(201).json(successResponse(saved));
  } catch (error: any) {
    return res.status(500).json(errorResponse(error?.message || 'Gagal menyimpan literatur.'));
  }
});

router.get('/saved/:projectId', (req, res) => {
  try {
    const records = loadSavedPapers().filter(item => item.projectId === req.params.projectId);
    return res.json(successResponse(records));
  } catch (error: any) {
    return res.status(500).json(errorResponse(error?.message || 'Gagal memuat literatur tersimpan.'));
  }
});

router.delete('/saved/:id', (req, res) => {
  try {
    let records = loadSavedPapers();
    const exists = records.some((item) => item.id === req.params.id);
    if (!exists) return res.status(404).json(errorResponse('Item tidak ditemukan.'));
    records = records.filter((item) => item.id !== req.params.id);
    saveSavedPapers(records);
    return res.json(successResponse({ id: req.params.id }));
  } catch (error: any) {
    return res.status(500).json(errorResponse(error?.message || 'Gagal menghapus literatur tersimpan.'));
  }
});

router.post('/summarize', async (req, res) => {
  try {
    const paper = req.body.paper as NormalizedPaper;
    if (!paper || !paper.abstract) {
      return res.status(400).json(errorResponse('Paper dengan abstrak diperlukan untuk ringkasan.'));
    }
    if (!openrouterAvailable()) return res.status(503).json(errorResponse('AI provider tidak tersedia.')); 

    const prompt = `Tolong ringkas karya ilmiah berikut. Berikan output yang terstruktur:
1. Tujuan Penelitian
2. Metode
3. Lokasi/Konteks
4. Data yang Digunakan
5. Temuan Utama
6. Keterbatasan
7. Relevansi (terutama untuk tata ruang / urban planning jika relevan)

Judul: ${paper.title}
Tahun: ${paper.year || 'N/A'}
Jurnal: ${paper.journal || 'N/A'}
Penulis: ${paper.authors.join(', ')}
DOI: ${paper.doi || 'N/A'}
Abstrak: ${paper.abstract}

Ingat: Gunakan hanya informasi dari abstrak. Jangan berhalusinasi isi full paper. Jika ada informasi yang tidak disebutkan di abstrak, tuliskan "Tidak disebutkan dalam abstrak."`;
    
    const result = await openrouterGenerate(prompt, undefined, 'research');
    return res.json(successResponse({ summary: result.text, model: result.model, provider: result.provider }));
  } catch (error: any) {
    return res.status(500).json(errorResponse(error?.message || 'Gagal merangkum literatur.'));
  }
});

router.post('/gap', async (req, res) => {
  try {
    const paper = req.body.paper as NormalizedPaper;
    if (!paper || !paper.abstract) return res.status(400).json(errorResponse('Paper dengan abstrak diperlukan.'));
    if (!openrouterAvailable()) return res.status(503).json(errorResponse('AI provider tidak tersedia.'));

    const prompt = `Analisis abstrak karya ilmiah berikut untuk menemukan "Research Gap" (celah penelitian). 
Formatkan balasan dengan poin-poin berikut:
- Gap Topik
- Gap Metode
- Gap Lokasi/Konteks
- Gap Data
- Rekomendasi Arah Penelitian Lanjutan

Judul: ${paper.title}
Abstrak: ${paper.abstract}

Ingat: Hanya gunakan informasi dari abstrak. Jika metode/lokasi tidak jelas, nyatakan sebagai potensi eksplorasi. Bahasa harus akademis namun mudah dipahami mahasiswa.`;
    
    const result = await openrouterGenerate(prompt, undefined, 'research');
    return res.json(successResponse({ gapAnalysis: result.text, model: result.model, provider: result.provider }));
  } catch (error: any) {
    return res.status(500).json(errorResponse(error?.message || 'Gagal memproses research gap.'));
  }
});

router.post('/matrix', async (req, res) => {
  try {
    const { papers } = req.body as { papers: NormalizedPaper[] };
    if (!Array.isArray(papers) || papers.length === 0) {
      return res.status(400).json(errorResponse('Daftar papers harus array dengan paling tidak satu item.'));
    }
    if (!openrouterAvailable()) return res.status(503).json(errorResponse('AI provider tidak tersedia.'));

    const papersContext = papers.map((p, i) => `
Paper ${i + 1}:
Judul: ${p.title}
Penulis/Tahun: ${p.authors?.[0] || 'Unknown'} (${p.year || 'N/A'})
Abstrak: ${p.abstract || 'Tidak ada abstrak'}
`).join('\n');

    const prompt = `Buatlah Literature Matrix dalam format tabel Markdown untuk kumpulan paper berikut.
Kolom yang harus ada:
- Penulis & Tahun
- Judul
- Tujuan
- Metode
- Temuan Utama
- Gap

Berikut daftar papernya:
${papersContext}`;

    const result = await openrouterGenerate(prompt, undefined, 'research');
    return res.json(successResponse({ matrix: result.text, model: result.model, provider: result.provider }));
  } catch (error: any) {
    return res.status(500).json(errorResponse(error?.message || 'Gagal membuat literature matrix.'));
  }
});

router.post('/query-assist', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json(errorResponse('Query diperlukan.'));
    if (!openrouterAvailable()) return res.status(503).json(errorResponse('AI provider tidak tersedia.'));

    const prompt = `Tolong perbaiki dan tingkatkan kata kunci pencarian jurnal akademik berikut. Ubah dari bahasa Indonesia (jika ada) ke padanan bahasa Inggris akademik yang paling umum digunakan dalam jurnal internasional, tambahkan sinonim, dan gunakan operator OR / AND jika perlu. 

Query asli pengguna: "${query}"

Output: Hanya berikan string query yang diperbaiki, tanpa penjelasan apapun. Contoh output: ("land use change" OR "urban expansion") AND "Bandung"`;

    const result = await openrouterGenerate(prompt, undefined, 'research');
    return res.json(successResponse({ improvedQuery: result.text.trim().replace(/^["']|["']$/g, '') }));
  } catch (error: any) {
    return res.status(500).json(errorResponse(error?.message || 'Gagal mengasistensi query.'));
  }
});

export const literatureRouter = router;
