import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LayoutItem, LayoutMode, MapMeta, MapLayer, TemplateType } from './mapsTypes'
import { PAPER_SIZES } from './mapsTypes'

interface Props {
  template: TemplateType; meta: MapMeta; font: string; layers: MapLayer[]
  showInset: boolean; insetUrl: string
  ticks: { lon: string; lat: string; pct: number }[]
  dynamicScale: number
  layoutMode: LayoutMode
  layoutItems: LayoutItem[]
  onLayoutChange: (item: LayoutItem) => void
}

// ── North Arrow ──────────────────────────────────────────────────────────────
function NorthArrow({ color = '#000000', s = 1 }: { color?: string; s?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 4 * s }}>
      <svg width={24 * s} height={32 * s} viewBox="0 0 28 38">
        <polygon points="14,2 20,28 14,22 8,28" fill={color} />
        <polygon points="14,2 8,28 14,22 20,28" fill="#fff" stroke={color} strokeWidth="1" />
        <circle cx="14" cy="22" r="3" fill={color} />
      </svg>
      <div style={{ fontSize: 11 * s, fontWeight: 'bold', color: color, marginTop: -2 * s }}>U</div>
    </div>
  )
}

// ── Scale Bar (dynamic) ───────────────────────────────────────────────────────
function ScaleBar({ scale, s = 1, align = 'center' }: { scale: number; s?: number; align?: 'center' | 'left' }) {
  const fmt = scale >= 1000000 ? `1 : ${(scale/1000000).toFixed(1)}jt`
    : scale >= 1000 ? `1 : ${Math.round(scale/1000)}rb`
    : `1 : ${scale.toLocaleString()}`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : 'flex-start', margin: `${4 * s}px 0` }}>
      <div style={{ fontSize: 11 * s, color: '#000', marginBottom: 4 * s, fontWeight: 700 }}>SKALA {fmt}</div>
      <div style={{ display: 'flex', border: `${0.6 * s}px solid #000`, padding: 0, overflow: 'hidden' }}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: 15 * s, height: 3 * s, background: i % 2 === 0 ? '#000' : '#fff' }} />
            <div style={{ width: 15 * s, height: 3 * s, background: i % 2 === 0 ? '#fff' : '#000' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Legend Symbols ────────────────────────────────────────────────────────────
function Sym({ type, fill, stroke, s }: { type: string; fill: string; stroke: string; s: number }) {
  if (type === 'point') return <div style={{ width: 8 * s, height: 8 * s, borderRadius: '50%', background: fill, border: `${1 * s}px solid ${stroke}`, flexShrink: 0 }} />
  if (type === 'line')  return <div style={{ width: 16 * s, height: 2.5 * s, background: fill, flexShrink: 0, borderRadius: 1 }} />
  return <div style={{ width: 14 * s, height: 9 * s, background: fill, border: `${1 * s}px solid ${stroke}`, flexShrink: 0, borderRadius: 1 }} />
}

function LegendItems({ layers, textColor, s }: { layers: MapLayer[]; textColor: string; s: number }) {
  const vis = layers.filter(l => l.visible && l.legendShow)
  if (!vis.length) return <div style={{ fontSize: 11 * s, color: '#94a3b8', fontStyle: 'italic' }}>Upload layer untuk legenda</div>
  
  const useTwoCols = vis.length > 8
  return (
    <div style={{ display: 'grid', gridTemplateColumns: useTwoCols ? '1fr 1fr' : '1fr', gap: `${6 * s}px` }}>
      {vis.map(l => {
        if (l.colorMode === 'categorized' && Object.keys(l.colorMap).length > 0) {
          return (
            <div key={l.id} style={{ marginBottom: 6 * s }}>
              <div style={{ fontSize: 10 * s, fontWeight: 700, color: textColor, marginBottom: 3 * s }}>{l.legendLabel || l.name}</div>
              {Object.entries(l.colorMap).slice(0, 10).map(([val, color]) => (
                <div key={val} style={{ display: 'flex', alignItems: 'center', gap: 5 * s, marginBottom: 2 * s }}>
                  <Sym type={l.featureType} fill={color} stroke={l.strokeColor} s={s} />
                  <span style={{ fontSize: 10 * s, color: textColor }}>{l.categoryLabels?.[val] || val}</span>
                </div>
              ))}
            </div>
          )
        }
        return (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 5 * s, marginBottom: 4 * s }}>
            <Sym type={l.featureType} fill={l.fillColor} stroke={l.strokeColor} s={s} />
            <span style={{ fontSize: 10 * s, color: textColor }}>{l.legendLabel || l.name}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Coordinate Zebra Ticks ────────────────────────────────────────────────────
function ZebraTick({ label, even, vertical, position, s }: { label: string; even: boolean; vertical?: boolean; position?: 'top'|'bottom'|'left'|'right'; s: number }) {
  const black = '#000000'
  return (
    <div style={{
      flex: 1, background: even ? black : '#fff',
      border: `${0.05 * s}px solid ${black}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', position: 'relative'
    }}>
      <span style={{
        fontSize: 8 * s, color: even ? '#fff' : black, whiteSpace: 'nowrap',
        transform: vertical ? 'rotate(-90deg)' : 'none', lineHeight: 1
      }}>{label}</span>
      
      {/* Exterior Ticks */}
      {position === 'top' && <div style={{ position:'absolute', top: -3 * s, left:'50%', width: 0.8 * s, height: 3 * s, background:black }} />}
      {position === 'bottom' && <div style={{ position:'absolute', bottom: -3 * s, left:'50%', width: 0.8 * s, height: 3 * s, background:black }} />}
      {position === 'left' && <div style={{ position:'absolute', left: -3 * s, top:'50%', width: 3 * s, height: 0.8 * s, background:black }} />}
      {position === 'right' && <div style={{ position:'absolute', right: -3 * s, top:'50%', width: 3 * s, height: 0.8 * s, background:black }} />}
    </div>
  )
}

// ── Grid Lines ───────────────────────────────────────────────────────────────
function GridLines({ lonTicks, latTicks, s, color = 'rgba(0,0,0,0.15)' }: { lonTicks: any[], latTicks: any[], s: number, color?: string }) {
  return (
    <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, pointerEvents:'none', overflow: 'hidden' }}>
      {lonTicks.slice(1, -1).map((t, i) => (
        <div key={`v-${i}`} style={{ position:'absolute', left: `${t.pct * 100}%`, top: 0, bottom: 0, width: 0.7 * s, background: color }} />
      ))}
      {latTicks.slice(1, -1).map((t, i) => (
        <div key={`h-${i}`} style={{ position:'absolute', top: `${(1 - t.pct) * 100}%`, left: 0, right: 0, height: 0.7 * s, background: color }} />
      ))}
    </div>
  )
}
function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max)
}

function ComposerBox({ item, onDragStart, onResizeStart, children }: { item: LayoutItem; onDragStart: (e: React.PointerEvent<HTMLDivElement>, item: LayoutItem) => void; onResizeStart: (e: React.PointerEvent<HTMLDivElement>, item: LayoutItem) => void; children: React.ReactNode }) {
  return (
    <div
      onPointerDown={(e) => { if (item.locked) return; onDragStart(e, item) }}
      style={{
        position: 'absolute',
        top: item.top,
        left: item.left,
        width: item.width,
        height: item.height,
        zIndex: item.zIndex,
        border: '1px solid rgba(0,0,0,0.12)',
        background: 'rgba(255,255,255,0.95)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
        borderRadius: 8,
        overflow: 'hidden',
        cursor: item.locked ? 'default' : 'move',
        display: item.visible ? 'flex' : 'none',
        flexDirection: 'column'
      }}
    >
      <div style={{ background: 'rgba(15,23,42,0.08)', padding: '6px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.02em', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <span>{item.label}</span>
        {item.locked ? <span style={{ fontSize: 10, opacity: 0.7 }}>Locked</span> : null}
      </div>
      <div style={{ position: 'relative', flex: 1, padding: 8, overflow: 'hidden' }}>{children}</div>
      {!item.locked && (
        <div
          onPointerDown={(e) => { e.stopPropagation(); onResizeStart(e, item) }}
          style={{ position: 'absolute', right: 4, bottom: 4, width: 14, height: 14, background: 'rgba(0,0,0,0.3)', cursor: 'nwse-resize', borderRadius: 3 }}
        />
      )}
    </div>
  )
}
// ── Main MapFrame ─────────────────────────────────────────────────────────────
const MapFrame = forwardRef<HTMLDivElement, Props>(({
  template, meta, font, layers, showInset, insetUrl, ticks, dynamicScale,
  layoutMode, layoutItems, onLayoutChange
}, ref) => {
  const paper = PAPER_SIZES[meta.paperSize || 'A4']
  const s = paper.scale
  const fontStyle = { fontFamily: font }
  const isPortrait = meta.orientation === 'portrait'
  const MAP_W = isPortrait ? paper.h : paper.w
  const MAP_H = isPortrait ? paper.w : paper.h
  const PANEL_W = isPortrait ? MAP_W : 200 * s
  const PANEL_H = isPortrait ? 220 * s : MAP_H
  const ZEBRA = 6 * s
  const black = '#000000'
  const textColor = '#000000'

  const lonTicks = ticks.filter(t => t.lon)
  const latTicks = ticks.filter(t => t.lat)
  const dragState = useRef<{
    item: LayoutItem
    type: 'drag' | 'resize'
    startX: number
    startY: number
    startTop: number
    startLeft: number
    startWidth: number
    startHeight: number
  } | null>(null)

  const handlePointerMove = useCallback((event: PointerEvent) => {
    const state = dragState.current
    if (!state) return
    event.preventDefault()
    const dx = event.clientX - state.startX
    const dy = event.clientY - state.startY
    const item = layoutItems.find(i => i.id === state.item.id)
    if (!item) return

    if (state.type === 'drag') {
      const left = clamp(state.startLeft + dx, 16, MAP_W - state.startWidth - 16)
      const top = clamp(state.startTop + dy, 16, MAP_H - state.startHeight - 16)
      onLayoutChange({ ...item, left, top })
    } else {
      const width = clamp(state.startWidth + dx, 120, MAP_W - state.startLeft - 16)
      const height = clamp(state.startHeight + dy, 80, MAP_H - state.startTop - 16)
      onLayoutChange({ ...item, width, height })
    }
  }, [layoutItems, onLayoutChange, MAP_W, MAP_H])

  useEffect(() => {
    const move = (e: PointerEvent) => handlePointerMove(e)
    const up = () => { dragState.current = null }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [handlePointerMove])

  const startDrag = (e: React.PointerEvent<HTMLDivElement>, item: LayoutItem) => {
    if (item.locked) return
    e.preventDefault()
    dragState.current = {
      item,
      type: 'drag',
      startX: e.clientX,
      startY: e.clientY,
      startTop: item.top,
      startLeft: item.left,
      startWidth: item.width,
      startHeight: item.height
    }
  }

  const startResize = (e: React.PointerEvent<HTMLDivElement>, item: LayoutItem) => {
    if (item.locked) return
    e.preventDefault()
    dragState.current = {
      item,
      type: 'resize',
      startX: e.clientX,
      startY: e.clientY,
      startTop: item.top,
      startLeft: item.left,
      startWidth: item.width,
      startHeight: item.height
    }
  }

  const renderComposerContent = (item: LayoutItem) => {
    switch (item.id) {
      case 'title':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ fontSize: 18 * s, fontWeight: 900, color: black, textTransform: 'uppercase', lineHeight: 1.1 }}>{meta.title || 'JUDUL PETA'}</div>
            {meta.subtitle && <div style={{ fontSize: 11 * s, color: '#475569', marginTop: 6 * s }}>{meta.subtitle}</div>}
          </div>
        )
      case 'legend':
        return <LegendItems layers={layers} textColor={black} s={s * 1.0} />
      case 'northArrow':
        return <NorthArrow color={black} s={1.2 * s} />
      case 'scaleBar':
        return <ScaleBar scale={dynamicScale} s={1.0 * s} align='left' />
      case 'inset':
        return insetUrl ? <img src={insetUrl} alt="Inset" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', border: '1px dashed #94a3b8', borderRadius: 6, padding: 8, textAlign: 'center' }}>Inset kosong</div>
      case 'source':
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 11 * s, color: '#475569', textAlign: 'center' }}>{meta.source || 'Sumber data peta'}</div>
      default:
        return null
    }
  }

  if (layoutMode === 'composer') {
    return (
      <div ref={ref} style={{ ...fontStyle, position: 'relative', width: MAP_W, height: MAP_H, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: '16px', border: '1px dashed rgba(15, 23, 42, 0.14)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(20, 1fr)', gridTemplateRows: 'repeat(20, 1fr)', pointerEvents: 'none' }}>
          {Array.from({ length: 20 * 20 }).map((_, idx) => <div key={idx} style={{ border: '1px solid rgba(15, 23, 42, 0.06)' }} />)}
        </div>
        {layoutItems.filter(item => item.visible).map(item => (
          <ComposerBox key={item.id} item={item} onDragStart={startDrag} onResizeStart={startResize}>
            {renderComposerContent(item)}
          </ComposerBox>
        ))}
      </div>
    )
  }

  if (template === 'formal-big' || template === 'formal-simple') {
    const isDouble = template === 'formal-big'
    return (
      <div ref={ref} style={{
        ...fontStyle, position: 'relative',
        width: MAP_W, height: MAP_H,
        border: isDouble ? `${0.6 * s}px double ${black}` : `${0.2 * s}px solid ${black}`,
        display: 'flex', flexDirection: isPortrait ? 'column' : 'row',
        background: 'none'
      }}>
        {/* ── Zebra coordinate border (4-side) ── */}
        {ticks.length > 0 && (
          <div style={{ position:'absolute', top:0, left:0, right: isPortrait ? 0 : PANEL_W, bottom: isPortrait ? PANEL_H : 0, pointerEvents:'none', zIndex:10 }}>
            <div style={{ position:'absolute', top: 0, left: ZEBRA * 0.7, right: ZEBRA * 0.7, height: ZEBRA * 0.7, display:'flex' }}>
              {lonTicks.map((t,i) => <ZebraTick key={i} label={t.lon} even={i%2===0} position="top" s={s * 0.8} />)}
            </div>
            <div style={{ position:'absolute', bottom: 0, left: ZEBRA * 0.7, right: ZEBRA * 0.7, height: ZEBRA * 0.7, display:'flex' }}>
              {lonTicks.map((t,i) => <ZebraTick key={i} label={t.lon} even={i%2===0} position="bottom" s={s * 0.8} />)}
            </div>
            <div style={{ position:'absolute', top: 0, left: 0, bottom: 0, width: ZEBRA * 0.7, display:'flex', flexDirection:'column' }}>
              {latTicks.map((t,i) => <ZebraTick key={i} label={t.lat} even={i%2===0} vertical position="left" s={s * 0.8} />)}
            </div>
            <div style={{ position:'absolute', top: 0, right: 0, bottom: 0, width: ZEBRA * 0.7, display:'flex', flexDirection:'column' }}>
              {latTicks.map((t,i) => <ZebraTick key={i} label={t.lat} even={i%2===0} vertical position="right" s={s * 0.8} />)}
            </div>
          </div>
        )}

        <div style={{ flex:1, position:'relative', overflow: 'hidden' }}>
           <GridLines lonTicks={lonTicks} latTicks={latTicks} s={s} color="rgba(0,0,0,0.22)" />
        </div>

        <div style={{ 
          width: isPortrait ? '100%' : PANEL_W, 
          height: isPortrait ? PANEL_H : '100%',
          flexShrink:0, background:'#ffffff', 
          borderLeft: isPortrait ? 'none' : `${0.5 * s}px solid ${black}`,
          borderTop: isPortrait ? `${0.5 * s}px solid ${black}` : 'none',
          display:'flex', flexDirection: isPortrait ? 'row' : 'column'
        }}>
          {/* Header Section */}
          <div style={{ 
            padding: `${10 * s}px`, 
            borderRight: isPortrait ? `${0.5 * s}px solid ${black}` : 'none',
            borderBottom: isPortrait ? 'none' : `${0.5 * s}px solid ${black}`, 
            textAlign:'center', 
            width: isPortrait ? '25%' : '100%',
            display: 'flex', flexDirection: 'column', justifyContent: 'center'
          }}>
            {meta.logoUrl && (
              <img src={meta.logoUrl} alt="logo" style={{ height: 36 * s, objectFit:'contain', display:'block', margin:`0 auto ${4 * s}px` }} />
            )}
            <div style={{ fontSize: 11 * s, fontWeight: 800, color: textColor, textTransform:'uppercase', lineHeight: 1.2 }}>
              {meta.title || 'JUDUL PETA'}
            </div>
          </div>

          {/* Orientation & Scale Section */}
          <div style={{ 
            padding: `${8 * s}px`, 
            borderRight: isPortrait ? `${0.5 * s}px solid ${black}` : 'none',
            borderBottom: isPortrait ? 'none' : `${0.5 * s}px solid ${black}`, 
            width: isPortrait ? '15%' : '100%',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent: 'center'
          }}>
            <NorthArrow color={black} s={0.8 * s} />
            <ScaleBar scale={dynamicScale} s={0.8 * s} />
          </div>

          {/* Inset Section */}
          {showInset && (
            <div style={{ 
              padding: `${6 * s}px`, 
              borderRight: isPortrait ? `${0.5 * s}px solid ${black}` : 'none',
              borderBottom: isPortrait ? 'none' : `${0.5 * s}px solid ${black}`, 
              width: isPortrait ? '15%' : '100%',
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent: 'center'
            }}>
              <div style={{ fontSize: 7 * s, fontWeight: 700, marginBottom: 4 * s }}>INSET</div>
              {insetUrl ? (
                <img src={insetUrl} alt="inset" style={{ width: '100%', height: isPortrait ? 50 * s : 70 * s, objectFit: 'cover', border: `${0.4 * s}px solid ${black}` }} />
              ) : (
                <div style={{ width: '100%', height: isPortrait ? 50 * s : 70 * s, border: `${0.4 * s}px dashed #ccc`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 6 * s, color: '#94a3b8' }}>No Inset</div>
              )}
            </div>
          )}

          {/* Legend Section */}
          <div style={{ 
            padding: `${8 * s}px`, 
            flex: 1, 
            borderRight: isPortrait ? `${0.5 * s}px solid ${black}` : 'none',
            overflowY:'auto' 
          }}>
            <div style={{ fontSize: 9 * s, fontWeight: 800, textTransform:'uppercase', marginBottom: 4 * s, color: textColor, borderBottom: `${0.5 * s}px solid ${black}` }}>
              LEGENDA
            </div>
            <LegendItems layers={layers} textColor={textColor} s={s * 0.9} />
          </div>

          {/* Source & Metadata Section */}
          <div style={{ 
            padding: `${6 * s}px`, 
            width: isPortrait ? '15%' : '100%',
            textAlign:'center',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', fontSize: 7 * s
          }}>
            <div style={{ fontWeight: 700 }}>Sumber:</div>
            <div style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isPortrait ? 'nowrap' : 'normal' }}>{meta.source}</div>
          </div>
        </div>
      </div>
    )
  }

  // ── NON-FORMAL / DARK / MINIMAL ──
  const isDark = template === 'dark'
  const isNonFormal = template === 'nonformal'
  const legBg = isDark ? 'rgba(15,23,42,0.93)' : 'rgba(255,255,255,0.95)'
  const legText = isDark ? '#e2e8f0' : '#000'

  return (
    <div ref={ref} style={{ ...fontStyle, position:'relative', width: MAP_W, height: MAP_H, background: 'none' }}>
      {/* ── Zebra coordinate border (Thinner for Non-Formal) ── */}
      {(isNonFormal || template === 'dark') && ticks.length > 0 && (
        <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, pointerEvents:'none', zIndex:10, opacity: 0.6 }}>
          <GridLines lonTicks={lonTicks} latTicks={latTicks} s={s} color={isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"} />
          <div style={{ position:'absolute', top: 0, left: 0, right: 0, height: ZEBRA * 0.7, display:'flex' }}>
            {lonTicks.map((t,i) => <ZebraTick key={i} label={t.lon} even={i%2===0} position="top" s={s * 0.8} />)}
          </div>
          <div style={{ position:'absolute', bottom: 0, left: 0, right: 0, height: ZEBRA * 0.7, display:'flex' }}>
            {lonTicks.map((t,i) => <ZebraTick key={i} label={t.lon} even={i%2===0} position="bottom" s={s * 0.8} />)}
          </div>
          <div style={{ position:'absolute', top: 0, left: 0, bottom: 0, width: ZEBRA * 0.7, display:'flex', flexDirection:'column' }}>
            {latTicks.map((t,i) => <ZebraTick key={i} label={t.lat} even={i%2===0} vertical position="left" s={s * 0.8} />)}
          </div>
          <div style={{ position:'absolute', top: 0, right: 0, bottom: 0, width: ZEBRA * 0.7, display:'flex', flexDirection:'column' }}>
            {latTicks.map((t,i) => <ZebraTick key={i} label={t.lat} even={i%2===0} vertical position="right" s={s * 0.8} />)}
          </div>
        </div>
      )}

      {/* Header moved to legend for non-formal */}

      <div style={{ 
        position:'absolute', bottom:16*s, right:16*s, zIndex:600, 
        background:legBg, border:`${1*s}px solid rgba(0,0,0,0.1)`, 
        borderRadius:16*s, padding:`${14*s}px ${18*s}px`, minWidth:220*s, maxWidth:320*s,
        boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column', gap: 8*s
      }}>
        {/* Title & Subtitle Integrated Here */}
        <div style={{ borderBottom: `2px solid ${isDark ? '#475569' : '#cbd5e1'}`, paddingBottom: 8*s, marginBottom: 2*s }}>
          <div style={{ fontSize:15*s, fontWeight:900, color:legText, textTransform:'uppercase', letterSpacing: 1.2*s, lineHeight: 1.2 }}>{meta.title||'JUDUL PETA'}</div>
          {meta.subtitle && <div style={{ fontSize:10*s, color: isDark ? '#94a3b8' : '#64748b', marginTop: 4*s, fontWeight: 500 }}>{meta.subtitle}</div>}
        </div>

        <div style={{ borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, paddingBottom: 6*s }}>
          <div style={{ fontSize:12*s, fontWeight:700, color:legText, textTransform:'uppercase', letterSpacing: 0.5*s }}>LEGENDA</div>
          <div style={{ fontSize:10*s, color: 'var(--text-muted)' }}>{meta.author}</div>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: 220*s }}>
          <LegendItems layers={layers} textColor={legText} s={s * 1.05} />
        </div>

        <div style={{ 
          marginTop: 4*s, borderTop: `1px dashed ${isDark ? '#334155' : '#e2e8f0'}`, paddingTop: 8*s,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 25*s
        }}>
           <ScaleBar scale={dynamicScale} s={s * 1.05} align="center" />
           <NorthArrow color={legText} s={1.3 * s} />
        </div>
      </div>
    </div>
  )
})

MapFrame.displayName = 'MapFrame'
export default MapFrame
