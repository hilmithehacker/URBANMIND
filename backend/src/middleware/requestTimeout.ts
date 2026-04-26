import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';

const DEFAULT_TIMEOUT_MS = 30_000;

export function requestTimeout(timeoutMs = DEFAULT_TIMEOUT_MS) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(503).json(errorResponse('Permintaan melebihi batas waktu. Coba lagi.', { timeout: timeoutMs }));
      }
    }, timeoutMs);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    next();
  };
}
