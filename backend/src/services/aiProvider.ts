import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  text: string;
  model: string;
  provider: 'gemini' | 'fallback';
}

function resolveModelName(name: string): string {
  const map: Record<string, string> = {
    // Gemini 2.5 (use latest stable alias)
    'gemini-2.5-flash': 'gemini-2.5-flash-preview-04-17',
    'gemini-2.5-flash-preview': 'gemini-2.5-flash-preview-04-17',
    // Gemini 2.0
    'gemini-2.0-flash': 'gemini-2.0-flash',
    'gemini-2.0-flash-exp': 'gemini-2.0-flash-exp',
    'gemini-2.0-flash-lite': 'gemini-2.0-flash-lite',
    // Gemini 1.5 (stable, recommended)
    'gemini-1.5-flash': 'gemini-1.5-flash',
    'gemini-1.5-flash-latest': 'gemini-1.5-flash',
    'gemini-1.5-flash-8b': 'gemini-1.5-flash-8b',
    'gemini-1.5-pro': 'gemini-1.5-pro',
    // Aliases / fallback
    'gemini-pro': 'gemini-1.5-flash',
    'flash': 'gemini-1.5-flash',
    'pro': 'gemini-1.5-pro',
  };
  // If exact match found, use it. Otherwise pass through as-is (user may know exact name).
  return map[name.toLowerCase()] ?? name;
}

class GeminiProvider {
  private client: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private _available: boolean = false;
  private _modelName: string = 'gemini-1.5-flash';
  private initialized: boolean = false;

  // Lazy init: called on first use so dotenv is guaranteed to have run
  private init(): void {
    if (this.initialized) return;
    this.initialized = true;

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      console.log('⚠️  Gemini: GEMINI_API_KEY not set — AI features disabled');
      return;
    }

    const rawModel = (process.env.GEMINI_MODEL || 'gemini-1.5-flash').trim();
    this._modelName = resolveModelName(rawModel);
    console.log(`🔄 Gemini: init model "${rawModel}" → "${this._modelName}"`);

    try {
      this.client = new GoogleGenerativeAI(apiKey);
      this.model = this.client.getGenerativeModel({
        model: this._modelName,
        systemInstruction: `Kamu adalah asisten AI untuk UrbanMind, platform riset dan perencanaan kota untuk mahasiswa Perencanaan Wilayah dan Kota (PWK) Indonesia.

Pedoman respons:
- Gunakan bahasa Indonesia yang akademis namun mudah dipahami
- Relevan dengan konteks tata ruang, perencanaan wilayah, dan kota Indonesia
- Berikan analisis yang mendalam dan berbasis data/teori perencanaan
- Hindari jawaban generik; selalu kaitkan dengan konteks PWK
- Gunakan terminologi perencanaan yang tepat (RTRW, RDTR, KLHS, dll.)
- Sertakan referensi kebijakan Indonesia bila relevan (UU Penataan Ruang, Perpres, dll.)
- Format jawaban dengan rapi menggunakan markdown bila diperlukan`
      });
      this._available = true;
      console.log(`✅ Gemini Provider ready — model: ${this._modelName}`);
    } catch (e: any) {
      console.error(`❌ Gemini init error: ${e.message}`);
      this.model = null;
      this._available = false;
    }
  }

  isAvailable(): boolean {
    this.init();
    return this._available && this.model !== null;
  }

  getModelName(): string {
    this.init();
    return this._modelName;
  }

  async chat(messages: AIMessage[], projectContext?: string): Promise<AIResponse> {
    this.init();
    if (!this.model) {
      throw new Error('Gemini API tidak dikonfigurasi. Tambahkan GEMINI_API_KEY di file .env');
    }

    const chat = this.model.startChat({
      history: messages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
    });

    const lastMessage = messages[messages.length - 1];
    const contextPrefix = projectContext
      ? `[Konteks Proyek: ${projectContext}]\n\n`
      : '';

    const result = await chat.sendMessage(contextPrefix + lastMessage.content);
    return { text: result.response.text(), model: this._modelName, provider: 'gemini' };
  }

  async generateText(prompt: string, systemContext?: string): Promise<AIResponse> {
    this.init();
    if (!this.model) {
      throw new Error('Gemini API tidak dikonfigurasi.');
    }

    const fullPrompt = systemContext ? `${systemContext}\n\n${prompt}` : prompt;
    const result = await this.model.generateContent(fullPrompt);
    return { text: result.response.text(), model: this._modelName, provider: 'gemini' };
  }
}

export const aiProvider = new GeminiProvider();
