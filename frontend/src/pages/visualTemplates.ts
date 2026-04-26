import { type Edge, type Node, MarkerType } from '@xyflow/react';

export type DiagramTemplate = 
  | 'blank' | 'problem-tree' | 'objective-tree' | 'swot' 
  | 'logframe' | 'cascading' | 'stakeholder' | 'causal' 
  | 'cycle' | 'process' | 'research' | 'fishbone' | 'logic-model';

export type VisualNodeData = Record<string, unknown> & {
  label: string;
  description?: string;
  bg?: string;
  textColor?: string;
  imageUrl?: string;
  fontFamily?: string;
  textAlign?: string;
  onChange?: (id: string, label: string) => void;
};

const createNode = (id: string, x: number, y: number, label: string, bg?: string): Node<VisualNodeData> => ({
  id,
  type: 'editable',
  position: { x, y },
  data: { label, bg, textColor: '#0f172a' },
});

const createEdge = (source: string, target: string, label?: string, animated?: boolean): Edge => ({
  id: `e-${source}-${target}`,
  source,
  target,
  label,
  animated,
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
  style: { stroke: '#94a3b8', strokeWidth: 2 },
});

export const getTemplate = (template: DiagramTemplate): { nodes: Node<VisualNodeData>[]; edges: Edge[] } => {
  if (template === 'problem-tree') {
    return {
      nodes: [
        createNode('core', 400, 300, 'Core Problem', '#fee2e2'),
        createNode('c1', 200, 500, 'Cause 1'), createNode('c2', 400, 500, 'Cause 2'), createNode('c3', 600, 500, 'Cause 3'),
        createNode('e1', 200, 100, 'Effect 1'), createNode('e2', 400, 100, 'Effect 2'), createNode('e3', 600, 100, 'Effect 3'),
      ],
      edges: [
        createEdge('c1', 'core'), createEdge('c2', 'core'), createEdge('c3', 'core'),
        createEdge('core', 'e1'), createEdge('core', 'e2'), createEdge('core', 'e3'),
      ],
    };
  }

  if (template === 'objective-tree') {
    return {
      nodes: [
        createNode('main', 400, 300, 'Main Objective', '#dcfce7'),
        createNode('m1', 200, 500, 'Means 1'), createNode('m2', 400, 500, 'Means 2'), createNode('m3', 600, 500, 'Means 3'),
        createNode('end1', 200, 100, 'Ends 1'), createNode('end2', 400, 100, 'Ends 2'), createNode('end3', 600, 100, 'Ends 3'),
      ],
      edges: [
        createEdge('m1', 'main'), createEdge('m2', 'main'), createEdge('m3', 'main'),
        createEdge('main', 'end1'), createEdge('main', 'end2'), createEdge('main', 'end3'),
      ],
    };
  }

  if (template === 'swot') {
    return {
      nodes: [
        createNode('s', 200, 200, 'Strengths (Internal)', '#dcfce7'),
        createNode('w', 500, 200, 'Weaknesses (Internal)', '#fee2e2'),
        createNode('o', 200, 400, 'Opportunities (External)', '#e0f2fe'),
        createNode('t', 500, 400, 'Threats (External)', '#fef3c7'),
      ],
      edges: [],
    };
  }

  if (template === 'logframe') {
    return {
      nodes: [
        createNode('goal', 100, 100, 'Goal (Impact)', '#e0f2fe'),
        createNode('outcome', 100, 250, 'Outcome', '#dcfce7'),
        createNode('output', 100, 400, 'Output', '#fef3c7'),
        createNode('activity', 100, 550, 'Activities', '#f3e8ff'),
        createNode('ind1', 400, 100, 'Indicators (Goal)'), createNode('ind2', 400, 250, 'Indicators (Outcome)'),
        createNode('ind3', 400, 400, 'Indicators (Output)'), createNode('ind4', 400, 550, 'Resources/Inputs'),
      ],
      edges: [
        createEdge('activity', 'output'), createEdge('output', 'outcome'), createEdge('outcome', 'goal'),
      ],
    };
  }

  if (template === 'cascading') {
    return {
      nodes: [
        createNode('issue', 400, 50, 'Strategic Issue', '#fee2e2'),
        createNode('goal', 400, 200, 'Goal', '#e0f2fe'),
        createNode('target', 400, 350, 'Target', '#dcfce7'),
        createNode('strategy', 200, 500, 'Strategy A', '#fef3c7'), createNode('strategy2', 600, 500, 'Strategy B', '#fef3c7'),
        createNode('prog1', 100, 650, 'Program A1'), createNode('prog2', 300, 650, 'Program A2'),
      ],
      edges: [
        createEdge('issue', 'goal'), createEdge('goal', 'target'),
        createEdge('target', 'strategy'), createEdge('target', 'strategy2'),
        createEdge('strategy', 'prog1'), createEdge('strategy', 'prog2'),
      ],
    };
  }

  if (template === 'stakeholder') {
    return {
      nodes: [
        createNode('q1', 500, 100, 'High Power / Low Interest\n(Keep Satisfied)', '#fef3c7'),
        createNode('q2', 800, 100, 'High Power / High Interest\n(Manage Closely)', '#fee2e2'),
        createNode('q3', 500, 400, 'Low Power / Low Interest\n(Monitor)', '#f1f5f9'),
        createNode('q4', 800, 400, 'Low Power / High Interest\n(Keep Informed)', '#e0f2fe'),
      ],
      edges: [],
    };
  }

  if (template === 'causal') {
    return {
      nodes: [
        createNode('var1', 300, 100, 'Population', '#e0f2fe'),
        createNode('var2', 500, 300, 'Infrastructure Need', '#fee2e2'),
        createNode('var3', 100, 300, 'Available Land', '#dcfce7'),
      ],
      edges: [
        createEdge('var1', 'var2', '+'), createEdge('var2', 'var3', '-'), createEdge('var3', 'var1', '-'),
      ],
    };
  }

  if (template === 'cycle') {
    return {
      nodes: [
        createNode('s1', 400, 100, 'Plan', '#e0f2fe'),
        createNode('s2', 600, 300, 'Do', '#dcfce7'),
        createNode('s3', 400, 500, 'Check', '#fef3c7'),
        createNode('s4', 200, 300, 'Act', '#fee2e2'),
      ],
      edges: [
        createEdge('s1', 's2'), createEdge('s2', 's3'), createEdge('s3', 's4'), createEdge('s4', 's1'),
      ],
    };
  }

  if (template === 'process') {
    return {
      nodes: [
        createNode('start', 100, 300, 'Start', '#f1f5f9'),
        createNode('input', 300, 300, 'Input', '#e0f2fe'),
        createNode('process', 500, 300, 'Process', '#dcfce7'),
        createNode('decision', 700, 300, 'Decision?', '#fef3c7'),
        createNode('output', 900, 300, 'Output', '#dcfce7'),
      ],
      edges: [
        createEdge('start', 'input'), createEdge('input', 'process'),
        createEdge('process', 'decision'), createEdge('decision', 'output', 'Yes'),
        createEdge('decision', 'process', 'No'),
      ],
    };
  }

  if (template === 'research') {
    return {
      nodes: [
        createNode('bg', 400, 100, 'Background & Issue', '#f1f5f9'),
        createNode('prob', 400, 250, 'Research Problem', '#fee2e2'),
        createNode('obj', 400, 400, 'Research Objectives', '#e0f2fe'),
        createNode('meth1', 200, 550, 'Data Collection', '#fef3c7'),
        createNode('meth2', 600, 550, 'Data Analysis', '#fef3c7'),
        createNode('out', 400, 700, 'Expected Output', '#dcfce7'),
      ],
      edges: [
        createEdge('bg', 'prob'), createEdge('prob', 'obj'),
        createEdge('obj', 'meth1'), createEdge('obj', 'meth2'),
        createEdge('meth1', 'out'), createEdge('meth2', 'out'),
      ],
    };
  }

  if (template === 'fishbone') {
    return {
      nodes: [
        createNode('main', 800, 300, 'Main Effect / Problem', '#fee2e2'),
        createNode('p1', 400, 100, 'People'), createNode('p2', 600, 100, 'Process'),
        createNode('p3', 400, 500, 'Environment'), createNode('p4', 600, 500, 'Policy'),
        createNode('spine1', 400, 300, '', 'transparent'), createNode('spine2', 600, 300, '', 'transparent'),
      ],
      edges: [
        createEdge('p1', 'spine1'), createEdge('p2', 'spine2'),
        createEdge('p3', 'spine1'), createEdge('p4', 'spine2'),
        createEdge('spine1', 'spine2'), createEdge('spine2', 'main'),
      ],
    };
  }

  if (template === 'logic-model') {
    return {
      nodes: [
        createNode('in', 100, 300, 'Inputs', '#f1f5f9'),
        createNode('act', 300, 300, 'Activities', '#e0f2fe'),
        createNode('out', 500, 300, 'Outputs', '#fef3c7'),
        createNode('outc', 700, 300, 'Outcomes', '#dcfce7'),
        createNode('imp', 900, 300, 'Impact', '#fee2e2'),
      ],
      edges: [
        createEdge('in', 'act'), createEdge('act', 'out'),
        createEdge('out', 'outc'), createEdge('outc', 'imp'),
      ],
    };
  }

  return { nodes: [createNode('root', 400, 300, 'Double Click to Edit')], edges: [] };
};
