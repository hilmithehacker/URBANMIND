import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Citation {
  id: string;
  type: 'book' | 'article' | 'website';
  authors: string;
  title: string;
  year: string;
  publisher?: string;
  url?: string;
  formatted: {
    apa: string;
    mla: string;
    chicago: string;
  }
}

export interface DocumentSection {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'review' | 'done';
}

export interface DocumentOutline {
  id: string;
  name: string;
  sections: DocumentSection[];
}

interface WritingStore {
  citations: Record<string, Citation[]>;
  outlines: Record<string, DocumentOutline[]>;
  activeOutlineId: string | null;
  addCitation: (projectId: string, citation: Citation) => void;
  deleteCitation: (projectId: string, citationId: string) => void;
  addOutline: (projectId: string, outline: DocumentOutline) => void;
  deleteOutline: (projectId: string, outlineId: string) => void;
  setActiveOutline: (outlineId: string | null) => void;
  updateSection: (projectId: string, outlineId: string, sectionId: string, data: Partial<DocumentSection>) => void;
  addSection: (projectId: string, outlineId: string, title: string) => void;
}

export const useWritingStore = create<WritingStore>()(
  persist(
    (set) => ({
      citations: {},
      outlines: {},
      activeOutlineId: null,

      addCitation: (projectId, citation) => set((state) => {
        const projCits = state.citations[projectId] || [];
        return {
          citations: { ...state.citations, [projectId]: [citation, ...projCits] }
        };
      }),

      deleteCitation: (projectId, citationId) => set((state) => {
        const projCits = state.citations[projectId] || [];
        return {
          citations: { ...state.citations, [projectId]: projCits.filter(c => c.id !== citationId) }
        };
      }),

      addOutline: (projectId, outline) => set((state) => {
        const projOutlines = state.outlines[projectId] || [];
        return {
          outlines: { ...state.outlines, [projectId]: [outline, ...projOutlines] },
          activeOutlineId: outline.id
        };
      }),

      deleteOutline: (projectId, outlineId) => set((state) => {
        const projOutlines = state.outlines[projectId] || [];
        return {
          outlines: { ...state.outlines, [projectId]: projOutlines.filter(o => o.id !== outlineId) },
          activeOutlineId: state.activeOutlineId === outlineId ? null : state.activeOutlineId
        };
      }),

      setActiveOutline: (outlineId) => set({ activeOutlineId: outlineId }),

      updateSection: (projectId, outlineId, sectionId, data) => set((state) => {
        const projOutlines = state.outlines[projectId] || [];
        return {
          outlines: {
            ...state.outlines,
            [projectId]: projOutlines.map(o => {
              if (o.id !== outlineId) return o;
              return {
                ...o,
                sections: o.sections.map(s => s.id === sectionId ? { ...s, ...data } : s)
              };
            })
          }
        };
      }),

      addSection: (projectId, outlineId, title) => set((state) => {
        const projOutlines = state.outlines[projectId] || [];
        return {
          outlines: {
            ...state.outlines,
            [projectId]: projOutlines.map(o => {
              if (o.id !== outlineId) return o;
              return {
                ...o,
                sections: [...o.sections, { id: Date.now().toString(), title, content: '', status: 'draft' }]
              };
            })
          }
        };
      })
    }),
    {
      name: 'urbanmind-writing-storage',
    }
  )
)
