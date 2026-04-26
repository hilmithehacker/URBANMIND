import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  BackgroundVariant,
  MarkerType,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Sparkles, Trash2, Undo2, Redo2,
  MousePointer2, Type, Square, Image as ImageIcon,
  FolderOpen, X, Download, Grid3X3, AlignLeft, AlignCenter, AlignRight
} from 'lucide-react';
import { toPng, toJpeg } from 'html-to-image';
import { useApp } from '../context/AppContext';
import { getTemplate, type DiagramTemplate, type VisualNodeData } from './visualTemplates';

// ---------------------------------------------------------
// CUSTOM NODE: Modern, glassmorphism, clean editable text
// ---------------------------------------------------------
export type EditableNodeType = Node<VisualNodeData, 'editable'>;

const EditableNode = memo(({ id, data, selected }: NodeProps<EditableNodeType>) => {
  return (
    <div
      style={{
        background: data.bg || 'rgba(255,255,255,0.95)',
        color: data.textColor || '#0f172a',
        border: '1px solid rgba(148,163,184,0.4)',
        outline: selected ? '3px solid #3B82F6' : 'none',
        outlineOffset: 2,
        borderRadius: 12,
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        padding: '12px 16px',
        minWidth: 160,
        boxShadow: selected ? '0 10px 25px -5px rgba(59, 130, 246, 0.4)' : '0 4px 12px rgba(0,0,0,0.05)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#94a3b8', border: 'none', width: 8, height: 8 }} />
      {data.imageUrl ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <img src={data.imageUrl} alt="Node" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'contain' }} />
          {data.label && <div style={{ fontSize: 13, fontWeight: 500, fontFamily: data.fontFamily || 'inherit' }}>{data.label}</div>}
        </div>
      ) : (
        <textarea
          className="nodrag nopan"
          value={data.label || ''}
          onChange={(e) => data.onChange?.(id, e.target.value)}
          rows={2}
          placeholder="Type here..."
          style={{
            width: '100%',
            resize: 'vertical',
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: data.fontFamily || 'inherit',
            lineHeight: 1.4,
            outline: 'none',
            textAlign: (data.textAlign as 'left'|'center'|'right') || 'center',
          }}
        />
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#94a3b8', border: 'none', width: 8, height: 8 }} />
    </div>
  );
});
EditableNode.displayName = 'EditableNode';

const nodeTypes = { editable: EditableNode };

// ---------------------------------------------------------
// PRESET COLORS
// ---------------------------------------------------------
const COLORS = [
  '#ffffff', // White
  '#f8fafc', // Slate 50
  '#fef3c7', // Amber 100
  '#fee2e2', // Red 100
  '#f3e8ff', // Purple 100
  '#e0f2fe', // Sky 100
  '#dcfce7', // Green 100
  '#ffedd5', // Orange 100
  '#fce7f3', // Pink 100
];

const TEXT_COLORS = [
  '#0f172a', // Slate 900
  '#334155', // Slate 700
  '#1e40af', // Blue 800
  '#991b1b', // Red 800
  '#166534', // Green 800
];

// ---------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------
function VisualBuilderInner() {
  const { activeProject } = useApp();
  const projId = activeProject?.id || 'default';
  
  const [nodes, setNodes] = useState<Node<VisualNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  // Selection
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());

  // Tools & UI State
  const [activeTool, setActiveTool] = useState<'select' | 'text' | 'shape'>('select');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  // History
  const historyRef = useRef<Array<{ nodes: Node<VisualNodeData>[]; edges: Edge[] }>>([]);
  const futureRef = useRef<Array<{ nodes: Node<VisualNodeData>[]; edges: Edge[] }>>([]);
  const flowRef = useRef<HTMLDivElement>(null);

  const { fitView, zoomIn, zoomOut } = useReactFlow();

  // Load state on mount
  useEffect(() => {
    const saved = localStorage.getItem(`visual_${projId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNodes(parsed.nodes || []);
        setEdges(parsed.edges || []);
      } catch (e) {
        loadTemplate('blank');
      }
    } else {
      loadTemplate('blank');
    }
  }, [projId]);

  // Save state on change
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      localStorage.setItem(`visual_${projId}`, JSON.stringify({ nodes, edges }));
    }
  }, [nodes, edges, projId]);

  const pushHistory = useCallback((n: Node<VisualNodeData>[], e: Edge[]) => {
    historyRef.current.push({ nodes: n, edges: e });
    if (historyRef.current.length > 50) historyRef.current.shift();
    futureRef.current = [];
  }, []);

  const handleNodeChange = useCallback((id: string, label: string) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)));
  }, []);

  const withHandlers = useMemo(() => {
    return nodes.map((n) => ({
      ...n,
      data: { ...n.data, onChange: handleNodeChange },
    }));
  }, [nodes, handleNodeChange]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => {
      const next = applyNodeChanges(changes, nds) as Node<VisualNodeData>[];
      // Update selection state efficiently
      const selected = new Set<string>();
      next.forEach(n => { if (n.selected) selected.add(n.id); });
      setSelectedNodeIds(selected);
      return next;
    });
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  
  const onConnect = useCallback((params: Connection) => {
    pushHistory(nodes, edges);
    setEdges((eds) => addEdge({ 
      ...params, 
      type: 'smoothstep', 
      markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
      style: { stroke: '#94a3b8', strokeWidth: 2 }
    }, eds));
  }, [nodes, edges, pushHistory]);

  const loadTemplate = (tmpl: DiagramTemplate) => {
    pushHistory(nodes, edges);
    const { nodes: n, edges: e } = getTemplate(tmpl);
    setNodes(n);
    setEdges(e);
    setTemplateModalOpen(false);
    setTimeout(() => fitView({ duration: 800, padding: 0.2 }), 100);
  };

  const addNode = (type: 'shape' | 'text' | 'image' = 'shape', imageUrl?: string) => {
    pushHistory(nodes, edges);
    const isText = type === 'text';
    const isImage = type === 'image';
    setNodes((nds) => nds.concat({
      id: `n-${Date.now()}`,
      position: { x: 300 + Math.random() * 100, y: 200 + Math.random() * 100 },
      type: 'editable',
      data: { 
        label: isText ? 'Type something...' : (isImage ? '' : 'New Node'),
        bg: isText || isImage ? 'transparent' : 'rgba(255,255,255,0.95)',
        textColor: '#0f172a',
        imageUrl
      },
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        addNode('image', ev.target.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset
  };

  const updateSelectedProperty = (key: 'bg' | 'textColor' | 'fontFamily' | 'textAlign', value: string) => {
    pushHistory(nodes, edges);
    setNodes((nds) => nds.map(n => n.selected ? { ...n, data: { ...n.data, [key]: value } } : n));
  };

  const deleteSelected = useCallback(() => {
    pushHistory(nodes, edges);
    setNodes((nds) => nds.filter((n) => !n.selected));
    setEdges((eds) => eds.filter((e) => !e.selected));
    setSelectedNodeIds(new Set());
  }, [nodes, edges, pushHistory]);



  const undo = () => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    futureRef.current.push({ nodes, edges });
    setNodes(prev.nodes);
    setEdges(prev.edges);
  };

  const redo = () => {
    const next = futureRef.current.pop();
    if (!next) return;
    historyRef.current.push({ nodes, edges });
    setNodes(next.nodes);
    setEdges(next.edges);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmd = e.ctrlKey || e.metaKey;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only delete if we are not typing in a textarea
        if (document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT') {
          deleteSelected();
        }
      }
      if (isCmd && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (isCmd && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const exportImage = async (format: 'png' | 'jpg') => {
    if (!flowRef.current) return;
    const opt = { backgroundColor: '#F8FAFC', cacheBust: true, pixelRatio: 2 };
    const dataUrl = format === 'png' ? await toPng(flowRef.current, opt) : await toJpeg(flowRef.current, { ...opt, quality: 0.95 });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `diagram-${projId}-${Date.now()}.${format}`;
    a.click();
  };

  const selectedNode = selectedNodeIds.size === 1 ? nodes.find(n => n.id === Array.from(selectedNodeIds)[0]) : null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F8FAFC', position: 'relative' }}>
      
      {/* 1. TOP TOOLBAR (Glassmorphism) */}
      <div style={{
        position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(203, 213, 225, 0.9)', borderRadius: 100,
        padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 16,
        boxShadow: '0 8px 32px rgba(15, 23, 42, 0.08)', zIndex: 10
      }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setTemplateModalOpen(true)} title="Templates">
          <FolderOpen size={16} /> <span style={{ fontWeight: 600 }}>Templates</span>
        </button>
        <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
        <button className="btn btn-ghost btn-sm" onClick={undo} title="Undo (Ctrl+Z)"><Undo2 size={16} /></button>
        <button className="btn btn-ghost btn-sm" onClick={redo} title="Redo (Ctrl+Y)"><Redo2 size={16} /></button>
        <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
        <button className="btn btn-ghost btn-sm" onClick={() => zoomOut()}><span style={{ fontSize: 18, lineHeight: 1 }}>-</span></button>
        <button className="btn btn-ghost btn-sm" onClick={() => fitView({ duration: 500 })}>Fit</button>
        <button className="btn btn-ghost btn-sm" onClick={() => zoomIn()}><span style={{ fontSize: 18, lineHeight: 1 }}>+</span></button>
        <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
        <button className="btn btn-primary btn-sm glow" onClick={() => exportImage('png')} style={{ borderRadius: 100 }}>
          <Download size={14} /> Export
        </button>
      </div>

      {/* 2. LEFT COMPACT TOOL RAIL */}
      <div style={{
        position: 'absolute', top: '50%', left: 16, transform: 'translateY(-50%)',
        background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(226, 232, 240, 0.8)', borderRadius: 16,
        padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 12,
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.05)', zIndex: 10
      }}>
        <button className={`btn-icon ${activeTool === 'select' ? 'active' : ''}`} onClick={() => setActiveTool('select')} style={{ color: activeTool === 'select' ? '#3b82f6' : '#64748b' }}>
          <MousePointer2 size={20} />
        </button>
        <button className={`btn-icon ${activeTool === 'shape' ? 'active' : ''}`} onClick={() => { setActiveTool('shape'); addNode('shape'); }} style={{ color: activeTool === 'shape' ? '#3b82f6' : '#64748b' }}>
          <Square size={20} />
        </button>
        <button className={`btn-icon ${activeTool === 'text' ? 'active' : ''}`} onClick={() => { setActiveTool('text'); addNode('text'); }} style={{ color: activeTool === 'text' ? '#3b82f6' : '#64748b' }}>
          <Type size={20} />
        </button>
        <button className={`btn-icon`} onClick={() => fileInputRef.current?.click()} style={{ color: '#64748b' }} title="Upload Image">
          <ImageIcon size={20} />
        </button>
        <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
      </div>

      {/* 3. MAIN WHITEBOARD */}
      <div ref={flowRef} style={{ flex: 1, width: '100%', height: '100%' }}>
        <ReactFlow
          nodes={withHandlers}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          panOnDrag={activeTool === 'select'}
          selectionOnDrag={activeTool === 'select'}
          fitView
          minZoom={0.1}
          maxZoom={4}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#cbd5e1" />
        </ReactFlow>
      </div>

      {/* 4. FLOATING PROPERTY PANEL (Visible only when exactly 1 node is selected) */}
      {selectedNode && (
        <div style={{
          position: 'absolute', top: 80, right: 24, width: 260,
          background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(226, 232, 240, 0.8)', borderRadius: 16,
          padding: 16, boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.1)', zIndex: 10,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Edit Node
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: '#475569', marginBottom: 6, display: 'block' }}>Background Color</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {COLORS.map(c => (
                <button 
                  key={c} 
                  onClick={() => updateSelectedProperty('bg', c)}
                  style={{ 
                    width: 24, height: 24, borderRadius: 6, background: c, 
                    border: '1px solid #cbd5e1', cursor: 'pointer',
                    outline: selectedNode.data.bg === c ? '2px solid #3b82f6' : 'none',
                    outlineOffset: 1
                  }} 
                />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: '#475569', marginBottom: 6, display: 'block' }}>Text Color</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TEXT_COLORS.map(c => (
                <button 
                  key={c} 
                  onClick={() => updateSelectedProperty('textColor', c)}
                  style={{ 
                    width: 24, height: 24, borderRadius: 6, background: c, 
                    border: '1px solid #cbd5e1', cursor: 'pointer',
                    outline: selectedNode.data.textColor === c ? '2px solid #3b82f6' : 'none',
                    outlineOffset: 1
                  }} 
                />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: '#475569', marginBottom: 6, display: 'block' }}>Font Family</label>
            <select 
              className="input w-100" 
              value={(selectedNode.data.fontFamily as string) || 'inherit'} 
              onChange={(e) => updateSelectedProperty('fontFamily', e.target.value)}
              style={{ padding: '6px 10px', fontSize: 13, height: 32 }}
            >
              <option value="inherit">Modern (Inter)</option>
              <option value="'Times New Roman', serif">Serif (Formal)</option>
              <option value="'Courier New', monospace">Monospace</option>
              <option value="'Comic Sans MS', cursive">Handwriting</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: '#475569', marginBottom: 6, display: 'block' }}>Text Align</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['left', 'center', 'right'] as const).map(align => (
                <button 
                  key={align} 
                  onClick={() => updateSelectedProperty('textAlign', align)}
                  className={`btn-icon ${(selectedNode.data.textAlign || 'center') === align ? 'active' : ''}`}
                  style={{ flex: 1, padding: 4, background: (selectedNode.data.textAlign || 'center') === align ? '#eff6ff' : 'transparent', color: (selectedNode.data.textAlign || 'center') === align ? '#3b82f6' : '#64748b' }}
                >
                  {align === 'left' ? <AlignLeft size={16} /> : align === 'center' ? <AlignCenter size={16} /> : <AlignRight size={16} />}
                </button>
              ))}
            </div>
          </div>

          <hr style={{ borderColor: '#e2e8f0', margin: '16px 0' }} />

          <button className="btn btn-ghost w-100" onClick={deleteSelected} style={{ color: '#ef4444', justifyContent: 'center' }}>
            <Trash2 size={16} /> Hapus Node
          </button>
        </div>
      )}

      {/* 5. AI CHAT FLOATING BUTTON & DRAWER */}
      <div style={{ position: 'absolute', bottom: 24, right: 24, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
        {aiDrawerOpen && (
          <div style={{
            width: 320, background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(226, 232, 240, 0.8)', borderRadius: 20,
            padding: 16, boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.15)',
            animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a' }}>
                <Sparkles size={18} className="text-accent" /> AI Assistant
              </div>
              <button className="btn-icon" onClick={() => setAiDrawerOpen(false)}><X size={16}/></button>
            </div>
            
            <textarea 
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="Contoh: Buatkan problem tree tentang banjir di Jakarta..."
              rows={3}
              style={{ 
                width: '100%', resize: 'none', padding: 12, borderRadius: 12, 
                border: '1px solid #cbd5e1', background: '#f8fafc', 
                fontSize: 13, marginBottom: 12, outline: 'none'
              }}
            />
            <button 
              className="btn btn-primary w-100 glow" 
              onClick={() => {
                if(!aiPrompt) return;
                setAiLoading(true);
                // Fake delay for AI fallback
                setTimeout(() => {
                  pushHistory(nodes, edges);
                  setNodes(nds => nds.concat({ id: `ai-${Date.now()}`, position: {x: 400, y: 300}, type: 'editable', data: {label: `Generated:\n${aiPrompt.slice(0,30)}...`} }));
                  setAiLoading(false);
                  setAiPrompt('');
                }, 1000);
              }}
              disabled={aiLoading || !aiPrompt}
            >
              {aiLoading ? 'Sedang berpikir...' : 'Generate Diagram'}
            </button>
          </div>
        )}
        
        <button 
          className="btn btn-primary glow" 
          style={{ width: 56, height: 56, borderRadius: 28, padding: 0, justifyContent: 'center' }}
          onClick={() => setAiDrawerOpen(!aiDrawerOpen)}
        >
          {aiDrawerOpen ? <X size={24} /> : <Sparkles size={24} />}
        </button>
      </div>

      {/* TEMPLATE MODAL */}
      {templateModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div style={{
            background: '#ffffff', borderRadius: 24, padding: 24, width: '90%', maxWidth: 800,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '80vh', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Pilih Template Diagram</h2>
              <button className="btn-icon" onClick={() => setTemplateModalOpen(false)}><X size={20}/></button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, overflowY: 'auto', paddingRight: 8 }}>
              {[
                { id: 'blank', name: 'Blank Canvas' },
                { id: 'problem-tree', name: 'Problem Tree' },
                { id: 'objective-tree', name: 'Objective Tree' },
                { id: 'swot', name: 'SWOT Matrix' },
                { id: 'logframe', name: 'Logical Framework' },
                { id: 'cascading', name: 'Cascading Planning' },
                { id: 'stakeholder', name: 'Stakeholder Map' },
                { id: 'causal', name: 'Causal Loop' },
                { id: 'cycle', name: 'Cycle Diagram' },
                { id: 'process', name: 'Process Flow' },
                { id: 'research', name: 'Research Framework' },
                { id: 'fishbone', name: 'Fishbone Diagram' },
                { id: 'logic-model', name: 'Program Logic Model' }
              ].map(t => (
                <button 
                  key={t.id} 
                  onClick={() => loadTemplate(t.id as DiagramTemplate)}
                  style={{
                    padding: 20, borderRadius: 16, border: '1px solid #e2e8f0', background: '#f8fafc',
                    textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: 8
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#eff6ff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                    <Grid3X3 size={20} />
                  </div>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Global styles for animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .react-flow__handle { width: 10px; height: 10px; border-radius: 50%; background: #94a3b8; }
        .react-flow__handle:hover { background: #3b82f6; transform: scale(1.2); }
      `}</style>
    </div>
  );
}

export default function VisualBuilder() {
  return (
    <ReactFlowProvider>
      <VisualBuilderInner />
    </ReactFlowProvider>
  );
}
