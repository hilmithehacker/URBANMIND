import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const router = Router();
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const META_FILE = path.join(__dirname, '../../data/files.json');

interface FileMeta {
  id: string;
  projectId: string;
  originalName: string;
  storedName: string;
  size: number;
  mimetype: string;
  uploadedAt: string;
  path: string;
}

function loadFileMeta(): FileMeta[] {
  const dir = path.dirname(META_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(META_FILE)) fs.writeFileSync(META_FILE, '[]');
  return JSON.parse(fs.readFileSync(META_FILE, 'utf-8'));
}

function saveFileMeta(files: FileMeta[]): void {
  fs.writeFileSync(META_FILE, JSON.stringify(files, null, 2));
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const projectId = req.body.projectId || req.params.projectId || 'general';
    const dest = path.join(UPLOADS_DIR, projectId);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'text/plain', 'text/csv',
      'application/json',
      'application/zip',
      'application/x-zip-compressed',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipe file tidak didukung: ${file.mimetype}`));
    }
  }
});

// GET files for a project
router.get('/project/:projectId', (req: Request, res: Response) => {
  try {
    const files = loadFileMeta().filter(f => f.projectId === req.params.projectId);
    res.json({ success: true, data: files });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Gagal memuat daftar file' });
  }
});

// POST upload file
router.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Tidak ada file yang diunggah' });
    }
    const { projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, error: 'projectId wajib diisi' });
    }

    const files = loadFileMeta();
    const meta: FileMeta = {
      id: uuidv4(),
      projectId,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedAt: new Date().toISOString(),
      path: `/uploads/${projectId}/${req.file.filename}`
    };
    files.push(meta);
    saveFileMeta(files);

    res.status(201).json({ success: true, data: meta });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message || 'Gagal mengunggah file' });
  }
});

// DELETE file
router.delete('/:id', (req: Request, res: Response) => {
  try {
    let files = loadFileMeta();
    const file = files.find(f => f.id === req.params.id);
    if (!file) return res.status(404).json({ success: false, error: 'File tidak ditemukan' });

    const fullPath = path.join(UPLOADS_DIR, file.projectId, file.storedName);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

    files = files.filter(f => f.id !== req.params.id);
    saveFileMeta(files);
    res.json({ success: true, message: 'File berhasil dihapus' });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Gagal menghapus file' });
  }
});

export { router as filesRouter };
