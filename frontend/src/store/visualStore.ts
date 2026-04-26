import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addEdge, applyNodeChanges, applyEdgeChanges, type Node, type Edge, type NodeChange, type EdgeChange, type Connection } from '@xyflow/react'

export interface Diagram {
  id: string;
  name: string;
  type: 'swot' | 'logframe' | 'problem-tree' | 'objective-tree' | 'causal' | 'mindmap' | 'custom';
  nodes: Node[];
  edges: Edge[];
  updatedAt: number;
}

interface VisualStore {
  diagrams: Record<string, Diagram[]>; // ProjectID -> Diagrams
  activeDiagramId: string | null;
  addDiagram: (projectId: string, name: string, type: Diagram['type']) => void;
  deleteDiagram: (projectId: string, diagramId: string) => void;
  setActiveDiagram: (diagramId: string | null) => void;
  onNodesChange: (projectId: string, diagramId: string, changes: NodeChange[]) => void;
  onEdgesChange: (projectId: string, diagramId: string, changes: EdgeChange[]) => void;
  onConnect: (projectId: string, diagramId: string, connection: Connection) => void;
  addNode: (projectId: string, diagramId: string, node: Node) => void;
  updateNodeData: (projectId: string, diagramId: string, nodeId: string, data: any) => void;
}

export const useVisualStore = create<VisualStore>()(
  persist(
    (set) => ({
      diagrams: {},
      activeDiagramId: null,

      addDiagram: (projectId, name, type) => set((state) => {
        const newDiag: Diagram = {
          id: Date.now().toString(),
          name,
          type,
          nodes: [],
          edges: [],
          updatedAt: Date.now()
        };
        const projDiagrams = state.diagrams[projectId] || [];
        return {
          diagrams: { ...state.diagrams, [projectId]: [...projDiagrams, newDiag] },
          activeDiagramId: newDiag.id
        };
      }),

      deleteDiagram: (projectId, diagramId) => set((state) => {
        const projDiagrams = state.diagrams[projectId] || [];
        return {
          diagrams: { ...state.diagrams, [projectId]: projDiagrams.filter(d => d.id !== diagramId) },
          activeDiagramId: state.activeDiagramId === diagramId ? null : state.activeDiagramId
        };
      }),

      setActiveDiagram: (diagramId) => set({ activeDiagramId: diagramId }),

      onNodesChange: (projectId, diagramId, changes) => set((state) => {
        const projDiagrams = state.diagrams[projectId] || [];
        const diagIdx = projDiagrams.findIndex(d => d.id === diagramId);
        if (diagIdx === -1) return state;

        const newDiags = [...projDiagrams];
        newDiags[diagIdx] = {
          ...newDiags[diagIdx],
          nodes: applyNodeChanges(changes, newDiags[diagIdx].nodes),
          updatedAt: Date.now()
        };
        return { diagrams: { ...state.diagrams, [projectId]: newDiags } };
      }),

      onEdgesChange: (projectId, diagramId, changes) => set((state) => {
        const projDiagrams = state.diagrams[projectId] || [];
        const diagIdx = projDiagrams.findIndex(d => d.id === diagramId);
        if (diagIdx === -1) return state;

        const newDiags = [...projDiagrams];
        newDiags[diagIdx] = {
          ...newDiags[diagIdx],
          edges: applyEdgeChanges(changes, newDiags[diagIdx].edges),
          updatedAt: Date.now()
        };
        return { diagrams: { ...state.diagrams, [projectId]: newDiags } };
      }),

      onConnect: (projectId, diagramId, connection) => set((state) => {
        const projDiagrams = state.diagrams[projectId] || [];
        const diagIdx = projDiagrams.findIndex(d => d.id === diagramId);
        if (diagIdx === -1) return state;

        const newDiags = [...projDiagrams];
        newDiags[diagIdx] = {
          ...newDiags[diagIdx],
          edges: addEdge(connection, newDiags[diagIdx].edges),
          updatedAt: Date.now()
        };
        return { diagrams: { ...state.diagrams, [projectId]: newDiags } };
      }),

      addNode: (projectId, diagramId, node) => set((state) => {
        const projDiagrams = state.diagrams[projectId] || [];
        const diagIdx = projDiagrams.findIndex(d => d.id === diagramId);
        if (diagIdx === -1) return state;

        const newDiags = [...projDiagrams];
        newDiags[diagIdx] = {
          ...newDiags[diagIdx],
          nodes: [...newDiags[diagIdx].nodes, node],
          updatedAt: Date.now()
        };
        return { diagrams: { ...state.diagrams, [projectId]: newDiags } };
      }),

      updateNodeData: (projectId, diagramId, nodeId, data) => set((state) => {
        const projDiagrams = state.diagrams[projectId] || [];
        const diagIdx = projDiagrams.findIndex(d => d.id === diagramId);
        if (diagIdx === -1) return state;

        const newDiags = [...projDiagrams];
        newDiags[diagIdx] = {
          ...newDiags[diagIdx],
          nodes: newDiags[diagIdx].nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n),
          updatedAt: Date.now()
        };
        return { diagrams: { ...state.diagrams, [projectId]: newDiags } };
      })

    }),
    {
      name: 'urbanmind-visual-storage',
    }
  )
)
