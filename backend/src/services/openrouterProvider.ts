// OpenRouter Multi-Model Provider with Task-Based Routing + Ensemble
// All models accessed via https://openrouter.ai/api/v1 (OpenAI-compatible)

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

// ─── Model definitions ─────────────────────────────────────────────────────

export type TaskType = 'research' | 'planning' | 'writing' | 'data' | 'general' | 'enhance';

interface ModelDef {
  id: string;
  label: string;
  keyEnv: string;
  strength: string;
}

export const MODEL_REGISTRY: Record<string, ModelDef> = {
  hermes:    { id: 'nousresearch/hermes-3-llama-3.1-70b',      label: 'Hermes 3 70B (Scholarly)',        keyEnv: 'OPENROUTER_KEY_HERMES',    strength: 'Scholarly reasoning & academic writing' },
  nvidia:    { id: 'nvidia/llama-3.1-nemotron-70b-instruct',   label: 'Nvidia Nemotron 70B (Technical)', keyEnv: 'OPENROUTER_KEY_NVIDIA',    strength: 'Technical & scientific analysis' },
  gemma:     { id: 'google/gemma-3-27b-it',                    label: 'Google Gemma 3 27B',              keyEnv: 'OPENROUTER_KEY_GEMMA',     strength: 'Balanced general purpose' },
  qwen:      { id: 'qwen/qwq-32b',                             label: 'Qwen QwQ 32B (Analytical)',       keyEnv: 'OPENROUTER_KEY_QWEN',      strength: 'Data analysis & structured reasoning' },
  minimax:   { id: 'minimax/minimax-01',                       label: 'Minimax 01',                      keyEnv: 'OPENROUTER_KEY_MINIMAX',   strength: 'Long-context processing' },
  openai:    { id: 'openai/gpt-4o',                            label: 'OpenAI GPT-4o',                   keyEnv: 'OPENROUTER_KEY_OPENAI',    strength: 'Deep research & reasoning' },
  inclusion: { id: 'inclusion/mercury-coder-small-beta',       label: 'Inclusion Mercury',               keyEnv: 'OPENROUTER_KEY_INCLUSION', strength: 'Code & structured output' },
  venice:    { id: 'venice-ai/llama-3.3-70b-akira',           label: 'Venice Llama 70B',                keyEnv: 'OPENROUTER_KEY_VENICE',    strength: 'Creative & narrative writing' },
  general:   { id: 'google/gemma-3-27b-it',                    label: 'General (Gemma 3)',               keyEnv: 'OPENROUTER_KEY_1',         strength: 'General purpose' },
};

// Task → model routing
const TASK_MODEL_ENV: Record<TaskType, string> = {
  research: 'OPENROUTER_MODEL_RESEARCH',
  planning: 'OPENROUTER_MODEL_PLANNING',
  writing:  'OPENROUTER_MODEL_WRITING',
  data:     'OPENROUTER_MODEL_DATA',
  general:  'OPENROUTER_MODEL_GENERAL',
  enhance:  'OPENROUTER_MODEL_RESEARCH',
};

const TASK_FALLBACK_MODEL: Record<TaskType, string> = {
  research: MODEL_REGISTRY.hermes.id,
  planning: MODEL_REGISTRY.nvidia.id,
  writing:  MODEL_REGISTRY.hermes.id,
  data:     MODEL_REGISTRY.qwen.id,    // qwen/qwq-32b (aktif)
  general:  MODEL_REGISTRY.gemma.id,
  enhance:  MODEL_REGISTRY.hermes.id,
};

// Fallback chain per task jika model utama 404/500
const TASK_FALLBACK_CHAIN: Record<TaskType, string[]> = {
  data:     [MODEL_REGISTRY.qwen.id, MODEL_REGISTRY.nvidia.id, MODEL_REGISTRY.gemma.id],
  research: [MODEL_REGISTRY.hermes.id, MODEL_REGISTRY.nvidia.id, MODEL_REGISTRY.gemma.id],
  planning: [MODEL_REGISTRY.nvidia.id, MODEL_REGISTRY.hermes.id, MODEL_REGISTRY.gemma.id],
  writing:  [MODEL_REGISTRY.hermes.id, MODEL_REGISTRY.gemma.id],
  general:  [MODEL_REGISTRY.gemma.id, MODEL_REGISTRY.hermes.id],
  enhance:  [MODEL_REGISTRY.hermes.id, MODEL_REGISTRY.gemma.id],
};

// ─── System prompts ─────────────────────────────────────────────────────────

const BASE_CONTEXT = `Kamu adalah asisten riset AI untuk UrbanMind — platform akademik untuk mahasiswa Perencanaan Wilayah dan Kota (PWK) Indonesia.`;

export const SYSTEM_PROMPTS: Record<TaskType | 'base', string> = {
  base: BASE_CONTEXT,

  research: `${BASE_CONTEXT}

Standar respons kamu setara dengan artikel jurnal Scopus Q1 di bidang urban planning, spatial analysis, dan kebijakan tata ruang Indonesia.

WAJIB dalam setiap respons:
1. LANGUAGE: Bahasa Indonesia akademis — presisi terminologi, sintaksis formal, tidak generik
2. EVIDENCE-BASED: Setiap klaim harus didukung data, statistik, atau referensi spesifik
   - Sebutkan nama kebijakan lengkap + nomor (contoh: "UU No. 26 Tahun 2007 tentang Penataan Ruang Pasal 6 ayat 2")
   - Sertakan angka/data kuantitatif bila relevan (BPS, Kemendagri, World Bank)
3. SCHOLARLY FRAMING: Gunakan framing ilmiah
   - "Berdasarkan kajian empiris...", "Data menunjukkan...", "Analisis spasial mengindikasikan..."
   - Hindari kalimat opini tanpa dasar: "sepertinya", "mungkin", "kira-kira"
4. STRUCTURE: Format seperti paper ilmiah — gunakan sub-heading, bullet evidence, tabel data bila relevan
5. PWK SPECIFICITY: Kaitkan dengan kondisi riil Indonesia — konteks otonomi daerah, NSPK, SNI, permen ATR/BPN
6. CITATION STYLE: Sebutkan referensi dalam kurung siku [Sumber: nama, tahun] atau gunakan catatan kaki

DILARANG: jawaban template, penjelasan berulang, kalimat pembuka generik ("Tentu saja!", "Baik, saya akan menjelaskan")`,

  planning: `${BASE_CONTEXT}

Kamu adalah analis perencanaan wilayah senior dengan keahlian dalam analisis kebijakan tata ruang Indonesia, metodologi PWK, dan perencanaan partisipatif.

Standar output:
1. ANALITIS: Setiap identifikasi masalah/potensi harus disertai dasar analisis yang terukur
2. NORMATIVE BASIS: Selalu rujuk pada regulasi yang berlaku — RTRWN, RTRWP, RTRWK, RDTR, KLHS, RPJMDes
3. QUANTIFIED: Estimasikan skala/magnitude isu dengan angka (luasan, jumlah penduduk, rasio, indeks)
4. ACTIONABLE: Output langsung dapat dijadikan bahan dokumen perencanaan formal
5. FORMAT STANDAR: Gunakan format yang sesuai dokumen perencanaan Indonesia (Bappeda/Kemen ATR)
6. SPATIAL THINKING: Selalu pertimbangkan dimensi spasial — di mana, seberapa luas, struktur ruang

DILARANG: generalisasi tanpa konteks lokal, rekomendasi tanpa basis regulasi`,

  writing: `${BASE_CONTEXT}

Kamu adalah penulis akademik senior untuk laporan perencanaan wilayah Indonesia, setara kualitas dokumen RDTR/RTRW resmi.

Standar penulisan:
1. ACADEMIC REGISTER: Sesuai standar penulisan laporan teknis Kementerian ATR/BPN — formal, sistematis, terukur
2. SUBSTANTIVE: Setiap paragraf mengandung informasi/analisis nyata, bukan filler
3. DATA INTEGRATION: Integrasikan data statistik (BPS, sensus, survei) ke dalam narasi
4. REGULATORY ALIGNMENT: Selaraskan dengan Permen ATR/BPN No. 11 Tahun 2021 (RDTR), UU 26/2007, PP 21/2021
5. CITATION: Sertakan referensi inline atau footnote
6. COHERENCE: Pastikan koneksi logis antar paragraf dan konsistensi terminologi
7. LENGTH: Minimum 600 kata per bagian, komprehensif, tidak dipotong prematur

GAYA: Scientific yet readable — seperti disertasi terbaik program studi PWK Indonesia`,

  data: `${BASE_CONTEXT}

Kamu adalah analis data dan statistik spasial untuk konteks pembangunan daerah Indonesia.

Standar analisis:
1. STATISTICAL RIGOR: Interpretasikan data dengan metodologi yang benar — distribusi, tren, korelasi, outlier
2. CONTEXTUAL MEANING: Setiap angka harus dimaknai dalam konteks PWK/pembangunan daerah
3. COMPARATIVE: Bandingkan dengan rata-rata nasional, provinsi, atau standar SNI bila tersedia
4. VISUALIZATION LOGIC: Rekomendasikan jenis visualisasi yang paling komunikatif untuk setiap data
5. INFERENCE: Tarik kesimpulan yang supported by data, bukan asumsi
6. ACTIONABLE INSIGHT: Output harus actionable untuk pengambil kebijakan/perencana

FORMAT: Gunakan tabel, bullets, dan angka — komunikatif dan dense dengan informasi`,

  general: `${BASE_CONTEXT}

Respons dalam bahasa Indonesia akademis yang tepat sasaran, relevan dengan konteks perencanaan wilayah dan kota Indonesia. Hindari jawaban generik.`,

  enhance: `Kamu adalah Senior Critic & Evaluator khusus untuk dokumen Perencanaan Wilayah dan Kota (PWK).
Tugasmu adalah mengevaluasi dan MEMPERBAIKI LANGSUNG jawaban AI sebelumnya.

Kriteria Evaluasi (Cek dengan ketat):
1. Apakah masih generik? (Jika ya, ubah menjadi tajam dan spesifik)
2. Apakah sudah relevan dengan standar/regulasi PWK Indonesia?
3. Apakah logikanya tajam? (Cause -> Effect -> Impact harus logis)
4. Apakah ada data yang terlihat dikarang/halusinasi? (Hapus jika tidak valid, ganti dengan "perlu data pendukung")
5. Apakah struktur mudah dibaca dan poin-poin tidak bertele-tele?

PENTING:
Jika jawaban awal dalam format JSON, kamu WAJIB mengembalikan perbaikannya dalam FORMAT JSON YANG SAMA PERSIS. Jangan merusak skema JSON-nya, cukup perbaiki isi (value) teksnya.`
};

// ─── Key resolution ─────────────────────────────────────────────────────────

let currentKeyIndex = 0;

function getKey(modelId: string): string | null {
  // 1. Load Balancing via Round-Robin using array of keys
  const keysStr = process.env.OPENROUTER_API_KEYS?.trim();
  if (keysStr) {
    const keys = keysStr.split(',').map(k => k.trim()).filter(Boolean);
    if (keys.length > 0) {
      const key = keys[currentKeyIndex % keys.length];
      currentKeyIndex = (currentKeyIndex + 1) % keys.length;
      // Log for monitoring load balancer distribution
      console.log(`[OpenRouter LoadBalancer] Routing task via Key #${currentKeyIndex === 0 ? keys.length : currentKeyIndex}/${keys.length}`);
      return key;
    }
  }

  // 2. Try OPENROUTER_API_KEY first (primary key)
  const primary = process.env.OPENROUTER_API_KEY?.trim();
  if (primary) return primary;

  // 3. Find model in registry and use its specific key
  const entry = Object.values(MODEL_REGISTRY).find(m => m.id === modelId);
  if (entry) {
    const key = process.env[entry.keyEnv]?.trim();
    if (key) return key;
  }

  // 4. Fallback chain
  const fallbacks = [
    'OPENROUTER_KEY_HERMES', 'OPENROUTER_KEY_GEMMA', 'OPENROUTER_KEY_1',
    'OPENROUTER_KEY_NVIDIA', 'OPENROUTER_KEY_QWEN'
  ];
  for (const envKey of fallbacks) {
    const key = process.env[envKey]?.trim();
    if (key) return key;
  }
  return null;
}

function getModelForTask(task: TaskType): string {
  const envKey = TASK_MODEL_ENV[task];
  const envModel = process.env[envKey]?.trim();
  return envModel || TASK_FALLBACK_MODEL[task];
}

// ─── Core fetch with retry ───────────────────────────────────────────────────

async function orFetch(
  messages: Array<{ role: string; content: string }>,
  modelId: string,
  maxTokens = 8192
): Promise<string> {
  const apiKey = getKey(modelId);
  if (!apiKey) throw new Error(`No API key available for model: ${modelId}`);

  // Timeout 90 detik — cegah hanging request
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://urbanmind.local',
        'X-Title': 'UrbanMind PWK Research Platform'
      },
      body: JSON.stringify({ model: modelId, messages, max_tokens: maxTokens, temperature: 0.65 })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter [${res.status}] ${modelId}: ${err.slice(0, 300)}`);
    }

    const data = await res.json() as any;
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeout);
  }
}


/** Coba model dari fallback chain sampai ada yang berhasil */
async function orFetchWithFallback(
  messages: Array<{ role: string; content: string }>,
  task: TaskType,
  maxTokens = 8192
): Promise<{ text: string; modelUsed: string }> {
  const chain = TASK_FALLBACK_CHAIN[task] || [getModelForTask(task)];
  let lastErr: Error | null = null;

  for (const modelId of chain) {
    try {
      const text = await orFetch(messages, modelId, maxTokens);
      if (text) return { text, modelUsed: modelId };
    } catch (e: any) {
      console.warn(`[OpenRouter] Model ${modelId} gagal (${e.message.slice(0, 80)}), coba berikutnya...`);
      lastErr = e;
    }
  }
  throw lastErr || new Error('Semua model dalam fallback chain gagal');
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function openrouterChat(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  projectContext?: string,
  task: TaskType = 'research'
): Promise<{ text: string; model: string; provider: string }> {
  const systemPrompt = SYSTEM_PROMPTS[task] || SYSTEM_PROMPTS.general;
  const systemContent = projectContext
    ? `${systemPrompt}\n\nKonteks proyek aktif: ${projectContext}`
    : systemPrompt;

  const msgs = [
    { role: 'system', content: systemContent },
    ...messages.map(m => ({ role: m.role, content: m.content }))
  ];

  // Pakai fallback chain — jika model utama 404, otomatis coba berikutnya
  const { text, modelUsed } = await orFetchWithFallback(msgs, task);

  // Ensemble enhancement for research/writing if enabled
  const useEnsemble = process.env.AI_ENSEMBLE === 'true';
  if (useEnsemble && (task === 'research' || task === 'writing') && text.length > 100) {
    try {
      const enhanceModel = getModelForTask('enhance');
      if (enhanceModel !== modelUsed) {
        const enhanced = await orFetch([
          { role: 'system', content: SYSTEM_PROMPTS.enhance },
          { role: 'user', content: `Tingkatkan kualitas teks berikut:\n\n${text}` }
        ], enhanceModel, 8192);
        if (enhanced.length > text.length * 0.5) {
          return { text: enhanced, model: `${modelUsed} + ${enhanceModel}`, provider: 'openrouter-ensemble' };
        }
      }
    } catch {
      // Ensemble failed silently — return primary
    }
  }

  return { text, model: modelUsed, provider: 'openrouter' };
}

export async function openrouterGenerate(
  prompt: string,
  systemContext?: string,
  task: TaskType = 'general'
): Promise<{ text: string; model: string; provider: string }> {
  const baseSystem = SYSTEM_PROMPTS[task] || SYSTEM_PROMPTS.general;
  const systemContent = [baseSystem, systemContext].filter(Boolean).join('\n\n');

  // Pakai fallback chain — jika model utama 404, otomatis coba berikutnya
  const { text, modelUsed } = await orFetchWithFallback([
    { role: 'system', content: systemContent },
    { role: 'user', content: prompt }
  ], task);

  // Ensemble / Boosting (Critic Loop)
  const useEnsemble = process.env.AI_ENSEMBLE === 'true';
  // Hanya boost jika teksnya lumayan panjang (menandakan JSON penuh) dan task = planning
  if (useEnsemble && task === 'planning' && text.length > 500) {
    try {
      const enhanceModel = getModelForTask('enhance'); // Menggunakan model spesialis research/enhance
      if (enhanceModel !== modelUsed) {
        const enhanced = await orFetch([
          { role: 'system', content: SYSTEM_PROMPTS.enhance },
          { role: 'user', content: `Evaluasi dan perbaiki jawaban JSON berikut agar lebih analitis, tajam, dan tidak generik (sesuai standar PWK). KEMBALIKAN HANYA DALAM FORMAT JSON YANG SAMA:\n\n${text}` }
        ], enhanceModel, 8192);
        
        if (enhanced.length > text.length * 0.4 && enhanced.includes('{')) {
          return { text: enhanced, model: `${modelUsed} ⚡ Boosted by ${enhanceModel}`, provider: 'openrouter-ensemble' };
        }
      }
    } catch { /* silent fallback ke jawaban awal jika critic error */ }
  }

  return { text, model: modelUsed, provider: 'openrouter' };
}


export function openrouterAvailable(): boolean {
  const envKeys = [
    'OPENROUTER_API_KEY', 'OPENROUTER_KEY_HERMES', 'OPENROUTER_KEY_1',
    'OPENROUTER_KEY_GEMMA', 'OPENROUTER_KEY_NVIDIA'
  ];
  return envKeys.some(k => !!process.env[k]?.trim());
}

export function openrouterStatus() {
  return {
    available: openrouterAvailable(),
    activeModels: {
      research: getModelForTask('research'),
      planning: getModelForTask('planning'),
      writing:  getModelForTask('writing'),
      data:     getModelForTask('data'),
      general:  getModelForTask('general'),
    },
    ensemble: process.env.AI_ENSEMBLE === 'true',
    models: Object.entries(MODEL_REGISTRY).map(([alias, def]) => ({
      alias, id: def.id, label: def.label, strength: def.strength,
      hasKey: !!(process.env[def.keyEnv]?.trim() || process.env.OPENROUTER_API_KEY?.trim())
    }))
  };
}

export { MODEL_REGISTRY as OPENROUTER_MODELS };
