import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { projectsRouter } from './routes/projects';
import { filesRouter } from './routes/files';
import { aiRouter } from './routes/ai';
import { planningRouter } from './routes/planning';
import { dataRouter } from './routes/data';
import { geoparseRouter } from './routes/geoparse';
import { literatureRouter } from './routes/literature';
import { writingRouter } from './routes/writing';
import { requestLogger } from './middleware/requestLogger';
import { requestTimeout } from './middleware/requestTimeout';
import { successResponse, errorResponse } from './utils/response';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(requestLogger);
app.use(requestTimeout(95000));
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/projects', projectsRouter);
app.use('/api/files', filesRouter);
app.use('/api/ai', aiRouter);
app.use('/api/planning', planningRouter);
app.use('/api/data', dataRouter);
app.use('/api/geoparse', geoparseRouter);
app.use('/api/literature', literatureRouter);
app.use('/api/writing', writingRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json(successResponse({
    status: 'ok',
    timestamp: new Date().toISOString(),
    openrouterConfigured: !!(process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY_HERMES),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    activeProvider: process.env.AI_PROVIDER || 'openrouter',
    ensemble: process.env.AI_ENSEMBLE === 'true',
    version: '2.0.0'
  }));
});

// Global error handler to prevent server crashes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server Error:', err?.message || err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json(errorResponse(err?.message || 'Terjadi kesalahan pada server'));
});

app.listen(PORT, () => {
  console.log(`✅ UrbanMind Backend running on http://localhost:${PORT}`);
  console.log(`🔑 Gemini: ${process.env.GEMINI_API_KEY ? 'Configured' : 'NOT configured'}`);
  console.log(`🤖 OpenRouter: ${process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY_HERMES ? 'Configured' : 'NOT configured'}`);
  console.log(`🔀 AI Provider: ${process.env.AI_PROVIDER || 'auto'} | Ensemble: ${process.env.AI_ENSEMBLE}`);
});

export default app;
