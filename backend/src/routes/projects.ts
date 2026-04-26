import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const router = Router();
const DATA_FILE = path.join(__dirname, '../../data/projects.json');

interface Project {
  id: string;
  name: string;
  description: string;
  location: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'archived';
}

function loadProjects(): Project[] {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function saveProjects(projects: Project[]): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2));
}

// GET all projects
router.get('/', (req: Request, res: Response) => {
  try {
    const projects = loadProjects();
    res.json({ success: true, data: projects });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Gagal memuat proyek' });
  }
});

// POST create project
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, description, location, type } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Nama proyek wajib diisi' });
    }
    const projects = loadProjects();
    const newProject: Project = {
      id: uuidv4(),
      name,
      description: description || '',
      location: location || '',
      type: type || 'Perencanaan Umum',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active'
    };
    projects.push(newProject);
    saveProjects(projects);
    res.status(201).json({ success: true, data: newProject });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Gagal membuat proyek' });
  }
});

// GET single project
router.get('/:id', (req: Request, res: Response) => {
  try {
    const projects = loadProjects();
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ success: false, error: 'Proyek tidak ditemukan' });
    res.json({ success: true, data: project });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Gagal memuat proyek' });
  }
});

// PUT update project
router.put('/:id', (req: Request, res: Response) => {
  try {
    const projects = loadProjects();
    const idx = projects.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Proyek tidak ditemukan' });
    projects[idx] = { ...projects[idx], ...req.body, updatedAt: new Date().toISOString() };
    saveProjects(projects);
    res.json({ success: true, data: projects[idx] });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Gagal memperbarui proyek' });
  }
});

// DELETE project
router.delete('/:id', (req: Request, res: Response) => {
  try {
    let projects = loadProjects();
    projects = projects.filter(p => p.id !== req.params.id);
    saveProjects(projects);
    res.json({ success: true, message: 'Proyek berhasil dihapus' });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Gagal menghapus proyek' });
  }
});

export { router as projectsRouter };
