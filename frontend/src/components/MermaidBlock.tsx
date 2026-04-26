import { useEffect, useRef } from 'react'
import mermaid from 'mermaid'

interface MermaidBlockProps {
  code: string
}

const MermaidBlock: React.FC<MermaidBlockProps> = ({ code }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Mermaid Configuration for Professional Urban Planning
    mermaid.initialize({
      startOnLoad: true,
      theme: 'base',
      themeVariables: {
        primaryColor: '#1F2937',
        primaryTextColor: '#F9FAFB',
        primaryBorderColor: '#6366F1',
        lineColor: '#94A3B8',
        secondaryColor: '#111827',
        tertiaryColor: '#1F2937',
        fontSize: '12px', // Diperkecil agar proporsional
        fontFamily: 'Inter, sans-serif',
        // Pastel Palette
        mainBkg: '#1F2937',
        nodeBorder: '#6366F1',
        nodeTextColor: '#F9FAFB', 
        clusterBkg: 'rgba(99, 102, 241, 0.05)',
        clusterBorder: '#4B5563',
        defaultLinkColor: '#6B7280',
        titleColor: '#F9FAFB',
        edgeLabelBackground: '#111827',
      },
      flowchart: {
        htmlLabels: true,
        curve: 'linear', 
        useMaxWidth: false, // Jangan biarkan melebar tak terkendali
        nodeSpacing: 40,
        rankSpacing: 40,
        padding: 15
      }
    })

    if (containerRef.current) {
      containerRef.current.innerHTML = ''
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`
      
      // Menangani case jika kode mermaid kosong atau tidak valid
      const safeCode = code.trim().startsWith('flowchart') || code.trim().startsWith('graph') 
        ? code 
        : `flowchart TD\n  Start[Data Tidak Lengkap] --> End[Gagal Render Diagram]`

      mermaid.render(id, safeCode).then((result) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = result.svg
          
          // Force SVG height/width consistency
          const svg = containerRef.current.querySelector('svg')
          if (svg) {
            svg.style.maxWidth = '100%'
            svg.style.height = 'auto'
          }
        }
      }).catch(err => {
        console.error('Mermaid render error:', err)
        if (containerRef.current) {
          containerRef.current.innerHTML = `<div style="color: #EF4444; font-size: 12px; padding: 10px; background: rgba(239, 68, 68, 0.1); borderRadius: 8px;">Gagal memuat diagram: Format Mermaid tidak didukung.</div>`
        }
      })
    }
  }, [code])

  return (
    <div 
      ref={containerRef} 
      className="mermaid-wrapper" 
      style={{ 
        width: '100%', 
        overflowX: 'auto', 
        display: 'flex', 
        justifyContent: 'center',
        background: '#0B0F19',
        padding: '10px',
        borderRadius: '8px'
      }} 
    />
  )
}

export default MermaidBlock
