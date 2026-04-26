import { Router, Request, Response } from 'express';
import { aiProvider, AIMessage } from '../services/aiProvider';
import {
  openrouterChat, openrouterGenerate,
  openrouterAvailable, openrouterStatus,
  MODEL_REGISTRY, TaskType
} from '../services/openrouterProvider';

const router = Router();

function getActiveProvider(): 'gemini' | 'openrouter' {
  const pref = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (pref === 'openrouter' && openrouterAvailable()) return 'openrouter';
  if (pref === 'gemini' && aiProvider.isAvailable()) return 'gemini';
  if (openrouterAvailable()) return 'openrouter';
  if (aiProvider.isAvailable()) return 'gemini';
  return 'openrouter';
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { messages, projectContext, task = 'research' } = req.body as {
      messages: AIMessage[];
      projectContext?: string;
      task?: TaskType;
    };

    if (!messages || messages.length === 0) {
      return res.status(400).json({ success: false, error: 'Pesan tidak boleh kosong' });
    }

    const filtered = [...messages];
    while (filtered.length > 0 && filtered[0].role !== 'user') filtered.shift();
    if (filtered.length === 0) {
      return res.status(400).json({ success: false, error: 'Tidak ada pesan user yang valid' });
    }

    const provider = getActiveProvider();

    if (provider === 'openrouter') {
      if (!openrouterAvailable()) {
        return res.status(503).json({ success: false, fallback: true, error: 'AI provider tidak dikonfigurasi' });
      }
      const result = await openrouterChat(filtered, projectContext, task);
      return res.json({ success: true, data: result });
    }

    if (!aiProvider.isAvailable()) {
      return res.status(503).json({ success: false, fallback: true, error: 'Gemini tidak dikonfigurasi' });
    }
    const result = await aiProvider.chat(filtered, projectContext);
    res.json({ success: true, data: result });
  } catch (e: any) {
    console.error('[AI Chat Error]', e.message);
    res.status(500).json({ success: false, error: e.message || 'Gagal menghubungi AI' });
  }
});

// ─── Generate ─────────────────────────────────────────────────────────────────

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { prompt, systemContext, task = 'general' } = req.body as {
      prompt: string; systemContext?: string; task?: TaskType
    };
    if (!prompt) return res.status(400).json({ success: false, error: 'Prompt wajib diisi' });

    const provider = getActiveProvider();

    if (provider === 'openrouter') {
      if (!openrouterAvailable()) {
        return res.status(503).json({ success: false, fallback: true, error: 'OpenRouter tidak dikonfigurasi' });
      }
      const result = await openrouterGenerate(prompt, systemContext, task);
      return res.json({ success: true, data: result });
    }

    if (!aiProvider.isAvailable()) {
      return res.status(503).json({ success: false, fallback: true, error: 'Gemini tidak dikonfigurasi' });
    }
    const result = await aiProvider.generateText(prompt, systemContext);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message || 'Gagal generate' });
  }
});

// ─── Status ───────────────────────────────────────────────────────────────────

router.get('/status', (_req: Request, res: Response) => {
  const geminiOk = aiProvider.isAvailable();
  const orStatus = openrouterStatus();
  const activeProvider = getActiveProvider();

  res.json({
    success: true,
    data: {
      activeProvider,
      available: geminiOk || orStatus.available,
      ensemble: orStatus.ensemble,
      gemini: { available: geminiOk, model: aiProvider.getModelName(), keyConfigured: !!process.env.GEMINI_API_KEY?.trim() },
      openrouter: {
        available: orStatus.available,
        activeModels: orStatus.activeModels,
        keyConfigured: orStatus.available,
        models: orStatus.models,
        ensemble: orStatus.ensemble
      }
    }
  });
});

// ─── Models ───────────────────────────────────────────────────────────────────

router.get('/models', (_req: Request, res: Response) => {
  const orStatus = openrouterStatus();
  res.json({
    success: true,
    data: {
      activeProvider: getActiveProvider(),
      openrouter: orStatus.models,
      activeModels: orStatus.activeModels,
      gemini: { available: aiProvider.isAvailable(), model: aiProvider.getModelName() }
    }
  });
});

export { router as aiRouter };
