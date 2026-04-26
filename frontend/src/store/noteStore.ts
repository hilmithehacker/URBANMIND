import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Note {
  id: string;
  title: string;
  content: string;
  folder: string;
  tags: string[];
  updatedAt: number;
}

interface NoteStore {
  notes: Record<string, Note[]>; // ProjectID -> Notes
  activeNoteId: string | null;
  addNote: (projectId: string, note: Partial<Note>) => void;
  updateNote: (projectId: string, noteId: string, data: Partial<Note>) => void;
  deleteNote: (projectId: string, noteId: string) => void;
  setActiveNote: (noteId: string | null) => void;
}

export const useNoteStore = create<NoteStore>()(
  persist(
    (set) => ({
      notes: {},
      activeNoteId: null,

      addNote: (projectId, note) => set((state) => {
        const newNote: Note = {
          id: Date.now().toString(),
          title: note.title || 'Untitled Note',
          content: note.content || '',
          folder: note.folder || 'General',
          tags: note.tags || [],
          updatedAt: Date.now(),
        };
        const projNotes = state.notes[projectId] || [];
        return {
          notes: { ...state.notes, [projectId]: [newNote, ...projNotes] },
          activeNoteId: newNote.id
        };
      }),

      updateNote: (projectId, noteId, data) => set((state) => {
        const projNotes = state.notes[projectId] || [];
        return {
          notes: {
            ...state.notes,
            [projectId]: projNotes.map(n => n.id === noteId ? { ...n, ...data, updatedAt: Date.now() } : n)
          }
        };
      }),

      deleteNote: (projectId, noteId) => set((state) => {
        const projNotes = state.notes[projectId] || [];
        return {
          notes: {
            ...state.notes,
            [projectId]: projNotes.filter(n => n.id !== noteId)
          },
          activeNoteId: state.activeNoteId === noteId ? null : state.activeNoteId
        };
      }),

      setActiveNote: (noteId) => set({ activeNoteId: noteId })
    }),
    {
      name: 'urbanmind-notes-storage',
    }
  )
)
