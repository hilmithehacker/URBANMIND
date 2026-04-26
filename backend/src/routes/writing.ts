import express from 'express';
import { aiProvider } from '../services/aiProvider';
import { openrouterGenerate } from '../services/openrouterProvider';

const router = express.Router();

interface WritingRequest {
  tool: 'draft' | 'paraphrase' | 'summarize';
  content: string;
  context?: any;
  tone?: 'akademis' | 'populer' | 'formal';
}

router.post('/generate', async (req, res) => {
  try {
    const { tool, content, context, tone = 'akademis' } = req.body as WritingRequest;

    if (!content) {
      return res.status(400).json({ success: false, error: 'Content is required', data: null, meta: {} });
    }

    let systemPrompt = `Kamu adalah penulis akademik senior untuk Perencanaan Wilayah dan Kota (PWK).
Gunakan gaya penulisan: ${tone.toUpperCase()}.
Jangan gunakan salam pembuka/penutup. Langsung berikan output teks.`;

    let userPrompt = '';

    if (tool === 'draft') {
      userPrompt = `Buatlah draft narasi laporan berdasarkan poin-poin berikut:\n\n${content}\n\nKonteks tambahan:\n${JSON.stringify(context || {})}`;
    } else if (tool === 'paraphrase') {
      userPrompt = `Parafrase teks berikut agar lebih akademis dan mudah dipahami:\n\n${content}`;
    } else if (tool === 'summarize') {
      userPrompt = `Buatlah ringkasan eksekutif (executive summary) dari teks berikut:\n\n${content}`;
    }

    const provider = process.env.AI_PROVIDER === 'openrouter' ? 'openrouter' : 'gemini';
    const aiResult = provider === 'openrouter'
      ? await openrouterGenerate(userPrompt, systemPrompt, 'writing')
      : await aiProvider.generateText(userPrompt, systemPrompt);

    res.json({
      success: true,
      data: { result: aiResult.text.trim() },
      error: null,
      meta: { tool, provider }
    });

  } catch (error: any) {
    console.error('[Writing Error]', error.message);
    res.status(500).json({
      success: false,
      data: null,
      error: error.message || 'Gagal menghasilkan teks.',
      meta: {}
    });
  }
});

export const writingRouter = router;
