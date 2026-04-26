import express from 'express';
import { aiProvider } from '../services/aiProvider';
import { openrouterGenerate } from '../services/openrouterProvider';

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────
function safeIncludes(value: any, item: any): boolean {
  if (Array.isArray(value)) return value.includes(item);
  if (typeof value === "string") return value.includes(item);
  return false;
}

type ToolId = 'potensi_masalah' | 'isu' | 'tujuan' | 'cascading' | 'program' | 'logframe' | 'consistency';

const TOOLS: Record<ToolId, { label: string; icon: string }> = {
  'potensi_masalah': { label: 'Potensi & Masalah', icon: '🔍' },
  'isu': { label: 'Isu Utama', icon: '⚡' },
  'tujuan': { label: 'Tujuan & Sasaran', icon: '🎯' },
  'cascading': { label: 'Konsep & Cascading', icon: '🏗️' },
  'program': { label: 'Indikasi Program', icon: '📋' },
  'logframe': { label: 'Logframe Perencanaan', icon: '📊' },
  'consistency': { label: 'Consistency Check', icon: '✅' },
};

function buildCompactContext(body: any): string {
  const { manualInput, docContext, prevResults, sources = [] } = body;
  let ctx = '';

  if (safeIncludes(sources, 'manual') && manualInput) ctx += `\n[INPUT USER]: ${manualInput}\n`;
  if (safeIncludes(sources, 'doc') && docContext) ctx += `\n[DOKUMEN EKSISTING]: ${docContext.slice(0, 3000)}\n`;
  
  if (safeIncludes(sources, 'previous') && prevResults) {
    ctx += `\n[MEMORI ANALISIS SEBELUMNYA]:\n`;
    Object.entries(prevResults).forEach(([t, data]: any) => {
      if (data) {
        ctx += `\n--- Hasil Analisis [${t}] ---\n`;
        ctx += JSON.stringify(data).slice(0, 4000) + '\n';
      }
    });
    ctx += `\nINSTRUKSI KELANJUTAN: Karena ini adalah input lanjutan/perbaikan, JANGAN mengulang hasil di atas mentah-mentah jika user meminta tambahan/perubahan. Lanjutkan atau perbaiki hasil di atas sesuai instruksi terbaru user.\n`;
  }
  return ctx;
}

function buildPrompt(tool: ToolId, ctx: string, genMode: string): string {
  const isNarasi = genMode === 'narasi';
  
  let labelGreen = 'Potensi / Faktor Positif';
  let labelRed = 'Masalah / Faktor Negatif';
  let descGreen = 'Mengupas tuntas potensi atau keunggulan komparatif';
  let descRed = 'Masalah, isu strategis, atau hambatan';
  
  if (tool === 'isu') { labelGreen = 'Peluang / Tren Eksternal'; labelRed = 'Isu Strategis Prioritas'; descGreen = 'Tren peluang makro/global'; descRed = 'Isu prioritas mendesak yang butuh penanganan'; }
  if (tool === 'tujuan') { labelGreen = 'Tujuan (Goals)'; labelRed = 'Sasaran (Objectives/Kelemahan yg dituju)'; descGreen = 'Tujuan jangka panjang yang ingin dicapai'; descRed = 'Sasaran spesifik/target kinerja terukur'; }
  if (tool === 'cascading') { labelGreen = 'Konsep Makro / Struktur Ruang'; labelRed = 'Cascading / Rencana Pola Ruang'; descGreen = 'Strategi makro pengembangan'; descRed = 'Turunan konsep ke dalam rencana spesifik'; }
  if (tool === 'program') { labelGreen = 'Program Utama (Prioritas)'; labelRed = 'Sub-Program / Mitigasi Risiko'; descGreen = 'Program indikatif strategis 5 tahunan'; descRed = 'Sub-program teknis atau mitigasi dari program utama'; }
  if (tool === 'logframe') { labelGreen = 'Output / Outcome'; labelRed = 'Asumsi / Risiko Kegagalan'; descGreen = 'Capaian indikator logframe'; descRed = 'Risiko/asumsi di luar kendali program'; }
  if (tool === 'consistency') { labelGreen = 'Elemen Sinkron / Selaras'; labelRed = 'Inkonsistensi / Konflik Keruangan'; descGreen = 'Kesesuaian dengan hierarki regulasi'; descRed = 'Konflik pemanfaatan ruang atau gap kebijakan'; }

  const SCHEMA_SPEC = `
Anda WAJIB memberikan respons HANYA dalam format JSON yang valid. Jangan berikan teks pembuka/penutup.
Gunakan skema JSON berikut secara persis:

{
  "summary": "Ringkasan analisis komprehensif dalam 1 paragraf singkat (wajib diisi)",
  "potentialStatements": [
    {
      "statement": "[POIN 1] SATU PARAGRAF PENUH mengenai ${labelGreen}",
      "why": "Alasan strategis",
      "standard": "Standar/acuan regulasi",
      "baseline": "Kondisi awal/eksisting",
      "gap": "Peluang/kesenjangan",
      "implication": "Implikasi logis"
    }
  ],
  "problemStatements": [
    {
      "statement": "[POIN 1] SATU PARAGRAF PENUH mengenai ${labelRed}",
      "cause": "Penyebab akar",
      "standard": "Standar/regulasi dilanggar",
      "baseline": "Kondisi empiris",
      "gap": "Besaran kesenjangan",
      "impact": "Dampak turunan",
      "dataYear": "Tahun data"
    }
  ],
  "tables": [
    {
      "title": "Tabel Sintesis Kesenjangan",
      "headers": ["Aspek", "Eksisting", "Standar", "Gap", "Tindakan"],
      "rows": [
        ["Infrastruktur", "Rasio 5%", "Minimal 10%", "-5%", "Perlu pembangunan"]
      ]
    }
  ],
  "flow": {
    "nodes": [
      { "id": "A", "label": "Label Node 1", "type": "masalah" },
      { "id": "B", "label": "Label Node 2", "type": "potensi" }
    ],
    "edges": [
      { "source": "A", "target": "B", "label": "Menyebabkan" }
    ]
  },
  "perspectiveComments": [
    {
      "name": "Budi Santoso",
      "role": "Masyarakat / Warga",
      "profile": "Ketua RT",
      "comment": "Komentar stakeholder..."
    }
  ],
  "warnings": [
    "Peringatan risiko kegagalan 1..."
  ],
  "gaps": [
    "Kesenjangan data yang belum terjawab 1..."
  ],
  "narasiLaporan": ${isNarasi ? '"Teks laporan naratif berformat paragraf rapi..."' : '""'}
}

ATURAN PENGISIAN JSON:
1. SANGAT PENTING: Anda sedang mengerjakan tugas "${TOOLS[tool].label}".
2. Jika data tidak cukup, tetap isi dengan draf terbaik dan tulis kekurangan data di array "gaps" atau "warnings".
3. Tidak boleh ada markdown formatting seperti ** atau * di luar string teks, jangan bungkus JSON dengan \`\`\`json.
4. "flow" harus merepresentasikan hubungan sebab akibat dari "potentialStatements" dan "problemStatements".
`;

  return `
Pakar Perencanaan Wilayah (Senior Urban Planner).
Tugas Anda Saat Ini: ${isNarasi ? 'Buat Narasi Laporan Formal' : `Analisis Teknis: ${TOOLS[tool].label}`}

KONTEKS / INPUT DATA:
${ctx}

${SCHEMA_SPEC}
`;
}

function isSimplePlanningRequest(input: string, docContext: string, prevResults: any) {
  return (input || '').length < 300 &&
    !docContext &&
    Object.keys(prevResults || {}).length === 0;
}

function isDummyRequest(input: string) {
  const i = (input || '').toLowerCase();
  return i.includes('dummy') || i.includes('contoh') || i.includes('sample');
}

function getLocalDummyFallback(tool: ToolId, input: string) {
  return {
    tool,
    mode: 'analisis',
    summary: `Ini adalah ringkasan data dummy untuk alat ${TOOLS[tool]?.label || tool}. Permintaan: "${input}". Data ini digenerasi secara lokal karena sistem AI sedang sibuk atau timeout.`,
    potentialStatements: [
      {
        statement: `[DUMMY POSITIF] Contoh potensi/tujuan/konsep berdasarkan "${input}"`,
        why: "Karena lokasi sangat strategis.",
        standard: "SNI Perencanaan Kota",
        baseline: "Kondisi saat ini 50%",
        gap: "Terdapat peluang peningkatan 50%",
        implication: "Jika dimanfaatkan, ekonomi lokal akan meningkat drastis."
      }
    ],
    problemStatements: [
      {
        statement: `[DUMMY NEGATIF] Contoh masalah/isu/risiko utama terkait "${input}"`,
        cause: "Kurangnya pengawasan dan infrastruktur.",
        standard: "RTRW Daerah",
        baseline: "Kondisi sangat buruk (10%)",
        gap: "Defisit 90%",
        impact: "Kemacetan dan banjir",
        dataYear: new Date().getFullYear().toString()
      }
    ],
    tables: [
      {
        title: "Tabel Analisis Dummy",
        headers: ["Aspek", "Baseline", "Standar/Acuan", "Gap", "Implikasi"],
        rows: [
          ["Infrastruktur", "50%", "100%", "-50%", "Perlu Pembangunan Segera"]
        ]
      }
    ],
    flow: {
      nodes: [
        { id: "A", label: "Poin Negatif Dummy", type: "masalah" },
        { id: "B", label: "Poin Positif Dummy", type: "potensi" }
      ],
      edges: [
        { source: "A", target: "B", label: "Mempengaruhi" }
      ]
    },
    perspectiveComments: [
      {
        name: "Sistem Lokal",
        role: "Auto-Fallback",
        profile: "Sistem UrbanMind",
        comment: "Ini adalah data dummy otomatis karena mode cepat."
      }
    ],
    warnings: ["Ini adalah data simulasi/dummy lokal yang dihasilkan karena AI timeout atau gagal merespons permintaan sederhana."],
    gaps: ["Data analitis asli tidak dapat diambil dari AI."],
    narasiLaporan: ""
  };
}

function fastPlanningPrompt(tool: ToolId, input: string): string {
  return `
Anda adalah Pakar Perencanaan Wilayah. Buat respons singkat dan padat untuk tugas: ${TOOLS[tool].label}.
Input user: ${input}

Berikan respons HANYA dalam JSON persis seperti ini (tanpa markdown block, tanpa awalan/akhiran):
{
  "summary": "Ringkasan analisis 1 paragraf",
  "potentialStatements": [{"statement": "Paragraf potensi/tujuan/konsep...", "why": "...", "standard": "...", "baseline": "...", "gap": "...", "implication": "..."}],
  "problemStatements": [{"statement": "Paragraf masalah/isu/risiko...", "cause": "...", "standard": "...", "baseline": "...", "gap": "...", "impact": "...", "dataYear": "..."}],
  "tables": [{"title": "Tabel Analisis", "headers": ["Aspek", "Eksisting", "Standar", "Gap", "Tindakan"], "rows": [["Aspek 1", "Eksisting", "Standar", "Gap", "Tindakan"]]}],
  "flow": {"nodes": [{"id":"A", "label":"Node A", "type":"masalah"}, {"id":"B", "label":"Node B", "type":"potensi"}], "edges": [{"source":"A", "target":"B", "label":"Menyebabkan"}]},
  "perspectiveComments": [{"name":"Warga","role":"Masyarakat","profile":"Warga","comment":"..."}],
  "warnings": [],
  "gaps": [],
  "narasiLaporan": ""
}
`;
}
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

router.post('/extract-doc', (req, res) => {
  try {
    let text = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    res.json({ success: true, text: text.slice(0, 30000) });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const { tool, genMode = 'analisis', manualInput, docContext, prevResults } = req.body;
    
    // FAST PATH CHECK
    const isSimple = isSimplePlanningRequest(manualInput, docContext, prevResults);
    
    const ctx = buildCompactContext(req.body);
    const system = `Respond ONLY in valid JSON. No markdown wrappers.`;
    
    // Choose prompt based on complexity
    const user = isSimple ? fastPlanningPrompt(tool as ToolId, manualInput) : buildPrompt(tool as ToolId, ctx, genMode);

    // 1. Check Cache
    const cacheKey = require('crypto').createHash('md5').update(user).digest('hex');
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[Cache Hit] Serving ${tool} from memory`);
      return res.json({ success: true, data: cached.data, error: null, meta: {} });
    }

    const provider = process.env.AI_PROVIDER === 'openrouter' ? 'openrouter' : 'gemini';
    
    // 2. Timeout & AI Call
    const aiPromise = provider === 'openrouter'
      ? openrouterGenerate(user, system, 'planning')
      : aiProvider.generateText(user, system);

    // 90s Timeout instead of 15s to allow AI to actually respond
    const timeoutPromise = new Promise<{text: string}>((_, reject) => 
      setTimeout(() => reject(new Error('AI Request Timeout')), 90000)
    );

    const aiResult = await Promise.race([aiPromise, timeoutPromise]);
    let text = aiResult.text.trim();
    let jsonStr = text;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];
    jsonStr = jsonStr.replace(/[\u0000-\u0009\u000B-\u001F]+/g, " "); 

    let parsedData;
    try {
      parsedData = JSON.parse(jsonStr);
    } catch (parseError: any) {
      try {
        let repaired = jsonStr.replace(/,\s*([\]}])/g, '$1').replace(/“/g, '"').replace(/”/g, '"');
        parsedData = JSON.parse(repaired);
      } catch (secondError: any) {
        console.error('[Planning JSON Error] AI Output failed to parse, wrapping plain text.');
        parsedData = {
          summary: text,
          potentialStatements: [],
          problemStatements: [],
          tables: [],
          flow: { nodes: [], edges: [] },
          perspectiveComments: [],
          warnings: ["Data tidak dapat di-parse dengan benar oleh AI."],
          gaps: [],
          narasiLaporan: ""
        };
      }
    }

    // Force strict schema fields
    parsedData = {
      tool,
      mode: genMode,
      summary: parsedData.summary || "",
      potentialStatements: Array.isArray(parsedData.potentialStatements) ? parsedData.potentialStatements : [],
      problemStatements: Array.isArray(parsedData.problemStatements) ? parsedData.problemStatements : [],
      tables: Array.isArray(parsedData.tables) ? parsedData.tables : [],
      flow: parsedData.flow || { nodes: [], edges: [] },
      perspectiveComments: Array.isArray(parsedData.perspectiveComments) ? parsedData.perspectiveComments : [],
      warnings: Array.isArray(parsedData.warnings) ? parsedData.warnings : [],
      gaps: Array.isArray(parsedData.gaps) ? parsedData.gaps : [],
      narasiLaporan: parsedData.narasiLaporan || ""
    };

    // Save to Cache
    cache.set(cacheKey, { data: parsedData, timestamp: Date.now() });

    res.json({ success: true, data: parsedData, error: null, meta: {} });
  } catch (e: any) {
    console.error(`[Planning Route Error] Tool: ${req.body.tool}, Msg: ${e.message}`);
    
    const isSimple = isSimplePlanningRequest(req.body.manualInput, req.body.docContext, req.body.prevResults);
    const isDummy = isDummyRequest(req.body.manualInput);

    // 3. Fallback on Error (Return local dummy if simple/dummy, else structured partial)
    if (isSimple || isDummy) {
      console.log(`[Planning Local Fallback] Serving local dummy fallback for ${req.body.tool}`);
      const fallbackData = getLocalDummyFallback(req.body.tool as ToolId, req.body.manualInput || req.body.tool);
      return res.status(200).json({ 
        success: true, // We act as if successful so UI renders it normally
        data: fallbackData, 
        error: null,
        meta: { localFallback: true }
      });
    }

    const fallbackData = {
      tool: req.body.tool,
      mode: req.body.genMode,
      summary: "Mohon maaf, terjadi kendala teknis atau timeout dari layanan AI (90 detik). Silakan coba lagi.",
      potentialStatements: [], problemStatements: [], tables: [], flow: {nodes:[],edges:[]},
      perspectiveComments: [], warnings: [e.message || "Timeout"], gaps: [],
      narasiLaporan: ""
    };

    res.status(200).json({ 
      success: false,
      data: fallbackData, 
      error: e.message || 'Analisis gagal.',
      meta: {}
    });
  }
});

export const planningRouter = router;
