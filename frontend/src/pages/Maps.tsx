import { useState, useEffect, useRef } from 'react'
import { Layers, Image as Img, Download, RefreshCw, Settings, Map as MapIcon } from 'lucide-react'
import MapFrame from './maps/MapFrame'
import LayerPanel from './maps/LayerPanel'
import type { MapLayer, MapMeta, TemplateType, PaperSize } from './maps/mapsTypes'
import { DEFAULT_META, FONTS, BASEMAPS, TEMPLATES, PALETTE, getMapRect, formatDeg, calcScale, PAPER_SIZES } from './maps/mapsTypes'
import { loadLeaflet, loadShp, loadJSZip, parseZipViaBackend } from './maps/mapUtils'
import type { BackendLayerInfo } from './maps/mapUtils'

declare global {
  interface Window {
    L: any
    shp: any
    JSZip: any
  }
}
declare const L: any

type Tab = 'compose' | 'layers' | 'inset' | 'export'
let _lid = 0
const uid = () => `l${++_lid}`

const MAP_STORAGE_KEY = 'urbanmind_maps_meta'

function detectType(gj: any): 'polygon' | 'line' | 'point' {
  const t = gj?.features?.[0]?.geometry?.type || ''
  if (t.includes('Polygon')) return 'polygon'
  if (t.includes('Line')) return 'line'
  return 'point'
}
function buildColorMap(gj: any, field: string): Record<string, string> {
  const vals = [...new Set((gj.features || []).map((f: any) => String(f.properties?.[field] ?? 'N/A')))] as string[]
  const m: Record<string, string> = {}
  vals.forEach((v, i) => { m[v] = PALETTE[i % PALETTE.length] })
  return m
}
function dashArray(d: string) {
  if (d === 'dashed') return '8,4'
  if (d === 'dotted') return '2,4'
  return d.includes(',') ? d : undefined
}

interface QMLStyle {
  type: 'single' | 'categorized'
  field?: string | null
  colorMap?: Record<string, string>
  fillColor?: string | null
  strokeColor?: string | null
  strokeWidth?: number | null
  dash?: string | null
  opacity?: number | null
}

function parseQML(xml: string): QMLStyle | null {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'text/xml')
    const renderer = doc.querySelector('renderer-v2')
    if (!renderer) return null

    const getSymbolStyle = (sym: Element | null) => {
      if (!sym) return null
      // QML uses <prop k="..." v="..." />
      const prop = (n: string) => sym.querySelector(`prop[k="${n}"]`)?.getAttribute('v')

      const parseColor = (c: string | undefined | null) => {
        if (!c) return null
        if (c.includes(',')) {
          const p = c.split(','); return `rgba(${p[0]},${p[1]},${p[2]},${(p[3] ? parseInt(p[3]) : 255) / 255})`
        }
        return c
      }

      // Check for different prop names used in different QGIS versions
      const fill = prop('color') || prop('fill_color')
      const stroke = prop('outline_color') || prop('line_color') || prop('color')
      const sw = prop('outline_width') || prop('line_width') || prop('width') || prop('stroke_width')
      const opacity = prop('opacity') || '1'

      return {
        fillColor: parseColor(fill),
        strokeColor: parseColor(stroke),
        strokeWidth: sw ? parseFloat(sw) * 2.0 : null,
        opacity: parseFloat(opacity),
        dash: prop('customdash') || (prop('line_style') === 'dash' ? '8,4' : (prop('line_style') === 'dot' ? '2,4' : null))
      }
    }

    const type = renderer.getAttribute('type')
    if (type === 'categorizedSymbol') {
      const field = renderer.getAttribute('attr')
      const categories = Array.from(doc.querySelectorAll('category'))
      const symbols = Array.from(doc.querySelectorAll('symbol'))
      const colorMap: Record<string, string> = {}
      categories.forEach(cat => {
        const val = cat.getAttribute('value')
        const symName = cat.getAttribute('symbol')
        const sym = symbols.find(s => s.getAttribute('name') === symName)
        const style = getSymbolStyle(sym ?? null)
        if (val && style?.fillColor) colorMap[val] = style.fillColor
      })
      const firstStyle = getSymbolStyle(symbols[0] ?? null)
      return { type: 'categorized', field, colorMap, ...firstStyle }
    } else if (type === 'rulebased') {
      // Simplified rule-based: just take the first symbol's style
      const sym = doc.querySelector('symbol')
      return { type: 'single', ...getSymbolStyle(sym) }
    }

    const sym = doc.querySelector('symbol')
    return { type: 'single', ...getSymbolStyle(sym) }
  } catch (e) { console.error('QML Parse Error:', e); return null }
}

export default function Maps() {
  const mapDivRef = useRef<HTMLDivElement>(null); const frameRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null); const mapInst = useRef<any>(null); const baseTile = useRef<any>(null)
  const [ready, setReady] = useState(false); const [tab, setTab] = useState<Tab>('compose')
  const [template, setTemplate] = useState<TemplateType>('formal-big'); const [basemap, setBasemap] = useState('none')
  const [font, setFont] = useState('Arial, sans-serif'); const [meta, setMeta] = useState<MapMeta>(DEFAULT_META)
  const [layers, setLayers] = useState<MapLayer[]>([]); const [selId, setSelId] = useState<string | null>(null)
  const [showInset, setShowInset] = useState(true); const [insetUrl, setInsetUrl] = useState('')
  const [showGrid, setShowGrid] = useState(true); const [ticks, setTicks] = useState<any[]>([])
  const [dynamicScale, setDynamicScale] = useState(50000); 
  const [targetScale, setTargetScale] = useState(50000);
  const [exporting, setExporting] = useState(false); const [msg, setMsg] = useState('')

  const refreshMap = () => {
    if (!mapInst.current) return
    setMsg('⏳ Sinkronisasi komponen peta...')
    
    // Bersihkan semua layer selain basemap
    mapInst.current.eachLayer((l: any) => {
      if (l !== baseTile.current) mapInst.current.removeLayer(l)
    })
    
    // Re-render semua layer yang statusnya visible
    setLayers(prev => prev.map(l => {
      if (l.visible) {
        return { ...l, leafletLayer: renderLayer(l) }
      }
      return { ...l, leafletLayer: null }
    }))
    
    mapInst.current.invalidateSize()
    updateTicks(mapInst.current)
    setMsg('✅ Peta berhasil disinkronisasi')
  }

  // Simpan meta setting (template, basemap, meta) ke localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MAP_STORAGE_KEY)
      if (saved) {
        const { savedTemplate, savedBasemap, savedFont, savedMeta } = JSON.parse(saved)
        if (savedTemplate) setTemplate(savedTemplate)
        if (savedBasemap) setBasemap(savedBasemap)
        if (savedFont) setFont(savedFont)
        if (savedMeta) setMeta(prev => ({ ...prev, ...savedMeta }))
      }
    } catch { /* ignore */ }
  }, [])

  // Auto-save map settings ke localStorage setiap kali berubah
  useEffect(() => {
    try {
      localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify({
        savedTemplate: template,
        savedBasemap: basemap,
        savedFont: font,
        savedMeta: meta,
      }))
    } catch { /* ignore */ }
  }, [template, basemap, font, meta])

  useEffect(() => { if (meta.isFormal) setBasemap('none') }, [meta.isFormal])
  const paper = PAPER_SIZES[meta.paperSize || 'A4']
  const isPortrait = meta.orientation === 'portrait'
  const MAP_W = isPortrait ? paper.h : paper.w
  const MAP_H = isPortrait ? paper.w : paper.h
  const rect = getMapRect(template, meta.orientation)
  const mapStyle: React.CSSProperties = { top: rect.top * paper.scale, left: rect.left * paper.scale, right: rect.right * paper.scale, bottom: rect.bottom * paper.scale }

  useEffect(() => { loadLeaflet(typeof L !== 'undefined' ? L : undefined).then(() => setReady(true)) }, [])
  useEffect(() => {
    if (!ready || !mapDivRef.current || mapInst.current) return
    const m = window.L.map(mapDivRef.current, { 
      zoomControl: false, 
      attributionControl: false,
      zoomSnap: 0.01,
      zoomDelta: 0.01,
      wheelPxPerZoomLevel: 150
    }).setView([-2, 118], 5)
    mapInst.current = m
    m.on('moveend zoomend', () => { setDynamicScale(calcScale(m)); updateTicks(m) })
    updateTicks(m)
  }, [ready])

  useEffect(() => {
    if (!mapInst.current || !window.L) return
    if (baseTile.current) { mapInst.current.removeLayer(baseTile.current); baseTile.current = null }
    const b = BASEMAPS.find(x => x.id === basemap)
    if (b && b.url) baseTile.current = window.L.tileLayer(b.url).addTo(mapInst.current)
  }, [basemap])

  const updateTicks = (m: any) => {
    const b = m.getBounds(); const sw = b.getSouthWest(); const ne = b.getNorthEast()
    const t: any[] = []; const count = 6
    for (let i = 0; i <= count; i++) {
      const pct = i / count; t.push({ lon: formatDeg(sw.lng + (ne.lng - sw.lng) * pct, false), lat: formatDeg(sw.lat + (ne.lat - sw.lat) * pct, true), pct })
    }
    setTicks(t)
  }

  const setZoomByScale = (scale: number) => {
    if (!mapInst.current) return
    const lat = mapInst.current.getCenter().lat
    const zoom = Math.log2((156543.03392 * Math.cos(lat * Math.PI / 180) / 0.000264583) / scale)
    mapInst.current.setZoom(zoom)
    setTargetScale(scale)
  }

  const renderLayer = (l: MapLayer) => {
    return window.L.geoJSON(l.geojson, {
      style: (f: any) => {
        let fill = l.fillColor; if (l.colorMode === 'categorized' && l.colorField) fill = l.colorMap[String(f.properties?.[l.colorField] ?? 'N/A')] || fill
        return { color: l.strokeColor, weight: l.strokeWidth, fillColor: fill, fillOpacity: l.fillOpacity, dashArray: dashArray(l.strokeDash) }
      },
      pointToLayer: (f: any, latlng: any) => {
        let fill = l.fillColor; if (l.colorMode === 'categorized' && l.colorField) fill = l.colorMap[String(f.properties?.[l.colorField] ?? 'N/A')] || fill
        return window.L.circleMarker(latlng, { radius: l.pointRadius, fillColor: fill, color: l.strokeColor, weight: l.strokeWidth, fillOpacity: l.fillOpacity })
      },
      onEachFeature: (f: any, lyr: any) => {
        if (l.showLabels && l.labelField && f.properties?.[l.labelField] != null) {
          const txt = String(f.properties[l.labelField]); const halo = l.labelHalo ? `text-shadow:0 0 3px #fff,0 0 3px #fff;` : ''
          lyr.bindTooltip(`<span style="font-size:${l.labelSize}px;color:${l.labelColor};${halo}font-weight:600">${txt}</span>`, { permanent: true, direction: 'center', className: 'leaflet-label-clean', offset: [0, 0] })
        }
      }
    }).addTo(mapInst.current)
  }

  const applyStyle = (id: string) => {
    setLayers(prev => prev.map(l => {
      if (l.id !== id) return l
      if (l.leafletLayer) mapInst.current?.removeLayer(l.leafletLayer)
      let cm = l.colorMap; if (l.colorMode === 'categorized' && l.colorField && !Object.keys(cm).length) cm = buildColorMap(l.geojson, l.colorField)
      const upd = { ...l, colorMap: cm, categoryLabels: l.categoryLabels || {} }; return { ...upd, leafletLayer: renderLayer(upd) }
    }))
    setMsg('✅ Style diterapkan')
  }

  useEffect(() => {
    if (!mapInst.current) return
    layers.forEach(l => {
      if (l.leafletLayer && l.visible) {
        l.leafletLayer.setStyle((f: any) => {
          let fill = l.fillColor; let stroke = l.strokeColor; let weight = l.strokeWidth; let opac = l.fillOpacity
          if (l.hasQml) { if (l.colorMode === 'categorized' && l.colorField) fill = l.colorMap[String(f.properties?.[l.colorField] ?? 'N/A')] || fill }
          else if (meta.isFormal) {
            if (l.featureType === 'polygon') { fill = '#f1f5f9'; stroke = '#000000'; weight = 0.5; opac = 0.4 }
            else if (l.featureType === 'line') { stroke = '#000000'; weight = 0.8 }
            else { fill = '#000000'; stroke = '#ffffff'; weight = 0.8 }
          } else if (l.colorMode === 'categorized' && l.colorField) fill = l.colorMap[String(f.properties?.[l.colorField] ?? 'N/A')] || fill
          return { color: stroke, weight: weight, fillColor: fill, fillOpacity: opac, dashArray: dashArray(l.strokeDash) }
        })
      }
    })
  }, [layers, meta.isFormal])

  // ── addLayer: kirim ke backend, fallback ke client-side jika offline ──────
  const addLayer = async (files: FileList) => {
    setMsg('⏳ Memproses file...')
    const results: { name: string; gj: any; qml?: any }[] = []

    for (const file of Array.from(files)) {
      try {
        // ── ZIP: coba backend parser dulu ──────────────────────────────────
        if (file.name.toLowerCase().endsWith('.zip')) {
          setMsg(`⏳ Mengirim ${file.name} ke parser...`)
          const backendResult = await parseZipViaBackend(file)

          if (backendResult.success && backendResult.layers && backendResult.layers.length > 0) {
            // ── Backend berhasil ────────────────────────────────────────────
            const validLayers = backendResult.layers.filter((l: BackendLayerInfo) => l.valid && l.geojson)
            const invalidLayers = backendResult.layers.filter((l: BackendLayerInfo) => !l.valid)

            if (invalidLayers.length > 0) {
              const errMsgs = invalidLayers.map((l: BackendLayerInfo) =>
                `${l.name}: ${l.errors.join(', ')}`
              ).join(' | ')
              setMsg(`⚠️ ${invalidLayers.length} layer invalid: ${errMsgs}`)
            }

            if (validLayers.length === 0) {
              setMsg(`❌ Tidak ada layer valid dalam ${file.name}. ${backendResult.layers.map((l: BackendLayerInfo) => l.errors.join(', ')).join(' | ')}`)
              continue
            }

            // Tambah setiap valid layer
            for (const bl of validLayers) {
              results.push({ name: bl.name, gj: bl.geojson, qml: bl.qmlStyle ? { _parsed: bl.qmlStyle } : undefined })
            }
            setMsg(`✅ Backend: ${validLayers.length} layer ditemukan dalam ${file.name}`)
            continue
          }

          // Backend gagal/offline — fallback ke client-side
          const backendErr = backendResult.error || 'Backend tidak tersedia'
          console.warn('[addLayer] Backend parse failed, fallback client:', backendErr)
          setMsg(`⚠️ Backend offline, parsing lokal: ${file.name}...`)

          // ── Fallback: client-side parser ───────────────────────────────
          try {
            await loadShp()
            await loadJSZip()

            if (!(window as any).JSZip) throw new Error('JSZip tidak berhasil dimuat')
            if (!(window as any).shp) throw new Error('shpjs tidak berhasil dimuat')

            const zip = await (window as any).JSZip.loadAsync(file)
            const fileMap: Record<string, any> = {}
            zip.forEach((p: string, obj: any) => { if (!obj.dir) fileMap[p] = obj })

            // Normalisasi: group berdasarkan BASENAME saja (ignore folder prefix)
            const groups: Record<string, { shp?: any; dbf?: any; shx?: any; prj?: any; qml?: any; path: string }> = {}
            const qmlMap: Record<string, any> = {} // basename → JSZip obj

            for (const [p, obj] of Object.entries(fileMap)) {
              const ext = p.split('.').pop()?.toLowerCase() || ''
              const fileBase = p.split('/').pop()?.replace(/\.[^.]+$/, '').toLowerCase() || ''

              if (ext === 'qml') { qmlMap[fileBase] = obj; continue }
              if (['shp', 'dbf', 'shx', 'prj'].includes(ext)) {
                if (!groups[fileBase]) groups[fileBase] = { path: p }
                  ; (groups[fileBase] as any)[ext] = obj
              }
            }

            for (const [base, components] of Object.entries(groups)) {
              if (!components.shp) continue
              setMsg(`⏳ Parsing ${base}...`)
              try {
                // Cari QML: exact match → fuzzy → singleton
                let qmlObj = qmlMap[base] || null
                if (!qmlObj) {
                  const qmlKeys = Object.keys(qmlMap)
                  qmlObj = qmlKeys.find(k => k.includes(base) || base.includes(k)) ? qmlMap[qmlKeys.find(k => k.includes(base) || base.includes(k))!] : null
                  if (!qmlObj && qmlKeys.length === 1 && Object.keys(groups).length === 1) qmlObj = qmlMap[qmlKeys[0]]
                }

                const miniZip = new (window as any).JSZip()
                miniZip.file('layer.shp', await components.shp.async('arraybuffer'))
                if (components.dbf) miniZip.file('layer.dbf', await components.dbf.async('arraybuffer'))
                if (components.shx) miniZip.file('layer.shx', await components.shx.async('arraybuffer'))
                if (components.prj) miniZip.file('layer.prj', await components.prj.async('arraybuffer'))

                const buf = await miniZip.generateAsync({ type: 'arraybuffer' })
                const gj = await (window as any).shp(buf)
                const qmlText = qmlObj ? await qmlObj.async('text') : undefined

                if (gj) results.push({ name: base, gj: Array.isArray(gj) ? gj[0] : gj, qml: qmlText })
              } catch (err: any) {
                console.error(`[addLayer] Client parse failed for ${base}:`, err)
                setMsg(`❌ Gagal parse ${base}: ${err.message}`)
              }
            }
          } catch (clientErr: any) {
            setMsg(`❌ Gagal parse ${file.name}: ${clientErr.message}`)
            continue
          }

        } else if (file.name.endsWith('.json') || file.name.endsWith('.geojson')) {
          // ── GeoJSON langsung ──────────────────────────────────────────────
          const text = await file.text()
          results.push({ name: file.name.replace(/\.[^.]+$/, ''), gj: JSON.parse(text) })
        }
      } catch (e: any) {
        setMsg(`❌ Gagal memuat ${file.name}: ${e.message}`)
      }
    }

    if (!results.length) {
      setMsg('⚠️ Tidak ada layer valid yang ditemukan. Pastikan ZIP berisi .shp beserta .dbf dan .shx.')
      return
    }

    // ── Tambah layer ke peta ─────────────────────────────────────────────────
    setLayers(prev => {
      let next = [...prev]
      results.forEach(({ name, gj, qml }, idx) => {
        const feats = gj?.features || []
        const fields = feats.length > 0 ? Object.keys(feats[0].properties || {}) : []
        const nl: MapLayer = {
          id: uid(), name, geojson: gj, featureType: detectType(gj),
          visible: true, featureCount: feats.length, fields,
          colorMode: 'single',
          fillColor: PALETTE[(prev.length + idx) % PALETTE.length],
          strokeColor: '#000000', fillOpacity: 0.65, strokeWidth: 1, strokeDash: 'solid',
          colorField: '', colorMap: {}, categoryLabels: {}, pointRadius: 5, pointSymbol: 'circle',
          labelField: '', showLabels: false, labelSize: 10, labelColor: '#000000', labelHalo: true,
          legendLabel: name, legendShow: true, leafletLayer: null
        }

        // ── Apply QML style ──────────────────────────────────────────────────
        if (qml) {
          // qml bisa berupa parsed object ({ _parsed: ... }) atau raw XML string
          let res: QMLStyle | null = null
          if (typeof qml === 'object' && qml._parsed) {
            res = qml._parsed as QMLStyle
          } else if (typeof qml === 'string') {
            res = parseQML(qml)
          }

          if (res) {
            nl.hasQml = true
            if (res.type === 'categorized' && res.field) {
              nl.colorMode = 'categorized'
              nl.colorField = res.field
              nl.colorMap = res.colorMap || {}
              // Jika colorMap kosong, build dari data
              if (!Object.keys(nl.colorMap).length && feats.length) {
                nl.colorMap = buildColorMap(gj, res.field)
              }
            }
            if (res.fillColor) nl.fillColor = res.fillColor
            if (res.strokeColor) nl.strokeColor = res.strokeColor
            if (res.strokeWidth != null) nl.strokeWidth = res.strokeWidth
            if (res.dash) nl.strokeDash = res.dash as any
            if (res.opacity != null) nl.fillOpacity = res.opacity
          }
        }

        // ── Default style per geometry type jika tidak ada QML ───────────────
        if (!nl.hasQml) {
          switch (nl.featureType) {
            case 'polygon':
              nl.fillOpacity = 0.6
              nl.strokeWidth = 0.8
              break
            case 'line':
              nl.fillOpacity = 1
              nl.strokeWidth = 1.5
              nl.fillColor = nl.strokeColor // line pakai warna stroke
              break
            case 'point':
              nl.pointRadius = 6
              nl.fillOpacity = 0.8
              break
          }
        }

        nl.leafletLayer = renderLayer(nl)
        next.push(nl)
        if (idx === 0) setSelId(nl.id)
        try { mapInst.current?.fitBounds(nl.leafletLayer.getBounds(), { padding: [40, 40] }) } catch { }
      })
      return next
    })

    setMsg(`✅ ${results.length} layer berhasil dimuat ke peta`)
  }

  const updateLayer = (id: string, patch: Partial<MapLayer>) => setLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  const toggleLayer = (id: string) => setLayers(prev => prev.map(l => { if (l.id !== id) return l; if (l.leafletLayer) { if (l.visible) mapInst.current?.removeLayer(l.leafletLayer); else l.leafletLayer.addTo(mapInst.current) }; return { ...l, visible: !l.visible } }))
  const removeLayer = (id: string) => { setLayers(prev => { const l = prev.find(x => x.id === id); if (l?.leafletLayer) mapInst.current?.removeLayer(l.leafletLayer); return prev.filter(x => x.id !== id) }); if (selId === id) setSelId(null) }
  const reorderLayer = (id: string, dir: 'up' | 'down') => setLayers(prev => { const i = prev.findIndex(l => l.id === id); if (i < 0) return prev; const arr = [...prev]; const sw = dir === 'up' ? i - 1 : i + 1; if (sw < 0 || sw >= arr.length) return prev;[arr[i], arr[sw]] = [arr[sw], arr[i]]; return arr })

  const doExport = async (fmt: 'jpg' | 'pdf' | 'png') => {
    if (!wrapRef.current) return
    setExporting(true); setMsg('Mengekspor...')
    try {
      const h2c = (await import('html2canvas')).default
      const canvas = await h2c(wrapRef.current, { useCORS: true, allowTaint: true, scale: 2, backgroundColor: '#ffffff', logging: false })
      const fname = (meta.title || 'peta').replace(/\s+/g, '_')
      if (fmt === 'png') { const a = document.createElement('a'); a.download = `${fname}.png`; a.href = canvas.toDataURL('image/png'); a.click() }
      else if (fmt === 'jpg') { const a = document.createElement('a'); a.download = `${fname}.jpg`; a.href = canvas.toDataURL('image/jpeg', 0.95); a.click() }
      else {
        const { jsPDF } = await import('jspdf'); const pdfW = paper.w * 0.264583; const pdfH = paper.h * 0.264583
        const pdf = new jsPDF({ orientation: pdfW > pdfH ? 'landscape' : 'portrait', unit: 'mm', format: [pdfW, pdfH] })
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfW, pdfH); pdf.save(`${fname}_${meta.paperSize}.pdf`)
      }
      setMsg('✅ Berhasil diunduh')
    } catch (e: any) { setMsg('❌ ' + e.message) } finally { setExporting(false) }
  }

  const toDataURL = (f: File) => new Promise<string>(r => { const fr = new FileReader(); fr.onload = e => r(e.target?.result as string); fr.readAsDataURL(f) })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <div className="page-header glass-panel" style={{ margin: '20px 20px 0', borderRadius: 'var(--radius-xl)', borderBottom: 'none', background: 'var(--bg-card)' }}>
        <div>
          <div className="page-header-title" style={{ 
            fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px',
            background: 'var(--gradient-warning)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            display: 'flex', alignItems: 'center', gap: 12 
          }}><MapIcon size={28} style={{ color: 'var(--warning)', filter: 'drop-shadow(0 0 10px rgba(250, 204, 21, 0.5))' }} /> Maps — Auto Layout Composer</div>
          <div className="page-header-sub" style={{ fontSize: 14, marginTop: 4 }}>SHP/GeoJSON · QML Styling · Proportional Landscape</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={refreshMap} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10 }}>
          <RefreshCw size={14} /> Sinkronisasi Peta
        </button>
      </div>
      {msg && <div className={`alert ${msg.startsWith('✅') ? 'alert-success' : msg.startsWith('❌') ? 'alert-error' : 'alert-info'}`} style={{ margin: 0, borderRadius: 0, fontSize: 12, padding: '6px 16px' }}>{msg} <button onClick={() => setMsg('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>×</button></div>}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: 295, flexShrink: 0, overflowY: 'auto', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {([['compose', 'Template', <Settings size={11} />], ['layers', 'Layer', <Layers size={11} />], ['inset', 'Inset', <Img size={11} />], ['export', 'Ekspor', <Download size={11} />]] as [Tab, string, React.ReactNode][]).map(([k, l, i]) => (
              <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: '9px 2px', fontSize: 10, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: tab === k ? 'var(--accent)' : 'var(--text-muted)', borderBottom: tab === k ? '2px solid var(--accent)' : '2px solid transparent' }}>{i}{l}</button>
            ))}
          </div>
          <div style={{ padding: 14, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tab === 'compose' && (
              <>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Ukuran Layout</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>{(['A4', 'A3', 'A2', 'A1', 'A0'] as PaperSize[]).map(ps => <button key={ps} onClick={() => setMeta(p => ({ ...p, paperSize: ps }))} style={{ padding: '8px 0', borderRadius: 6, fontSize: 11, fontWeight: 700, border: `1px solid ${meta.paperSize === ps ? 'var(--accent)' : 'var(--border)'}`, background: meta.paperSize === ps ? 'var(--accent-dim)' : 'var(--bg-tertiary)', color: meta.paperSize === ps ? 'var(--accent)' : 'var(--text)' }}>{ps}</button>)}</div>
                  
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Orientasi</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 15 }}>
                    {(['landscape', 'portrait'] as const).map(o => (
                      <button key={o} onClick={() => setMeta(p => ({ ...p, orientation: o }))} style={{ flex: 1, padding: '8px 0', borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: 'capitalize', border: `1px solid ${meta.orientation === o ? 'var(--accent)' : 'var(--border)'}`, background: meta.orientation === o ? 'var(--accent-dim)' : 'var(--bg-tertiary)', color: meta.orientation === o ? 'var(--accent)' : 'var(--text)' }}>{o}</button>
                    ))}
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Template</div>
                  {(Object.entries(TEMPLATES) as [TemplateType, { label: string; desc: string }][]).map(([id, t]) => <div key={id} onClick={() => setTemplate(id)} style={{ padding: '8px 10px', borderRadius: 7, border: `1px solid ${template === id ? 'var(--accent)' : 'var(--border)'}`, background: template === id ? 'var(--accent-dim)' : 'transparent', cursor: 'pointer', marginBottom: 5 }}><div style={{ fontSize: 12, fontWeight: 600, color: template === id ? 'var(--accent)' : 'var(--text-primary)' }}>{t.label}</div><div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{t.desc}</div></div>)}
                </div>
                <div className="form-group"><label className="form-label">Basemap</label><select className="form-input" value={basemap} onChange={e => setBasemap(e.target.value)}>{BASEMAPS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Font</label><select className="form-input" value={font} onChange={e => setFont(e.target.value)}>{FONTS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select></div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Sesuaikan Skala Peta</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input 
                      type="number" 
                      className="form-input" 
                      style={{ flex: 1 }}
                      value={targetScale} 
                      onChange={e => setTargetScale(Number(e.target.value))} 
                    />
                    <button className="btn btn-primary btn-sm" onClick={() => setZoomByScale(targetScale)}>Terapkan</button>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Skala saat ini: 1 : {dynamicScale.toLocaleString()}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" id="sf" checked={meta.isFormal} onChange={e => setMeta(m => ({ ...m, isFormal: e.target.checked }))} /><label htmlFor="sf" style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }}>MODE PETA FORMAL (B&W)</label></div><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" id="sg" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} /><label htmlFor="sg" style={{ fontSize: 12, cursor: 'pointer' }}>Grid koordinat</label></div></div>
                <div><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Info Peta</div>{([['title', 'Judul'], ['subtitle', 'Sub Judul'], ['author', 'Dibuat Oleh'], ['source', 'Sumber Data'], ['projection', 'Proyeksi'], ['datum', 'Datum'], ['date', 'Tanggal'], ['publisherName', 'Nama Instansi']] as [keyof MapMeta, string][]).map(([k, lbl]) => <div className="form-group" key={String(k)} style={{ marginBottom: 7 }}><label className="form-label" style={{ fontSize: 11 }}>{lbl}</label><input className="form-input" style={{ fontSize: 12 }} value={meta[k] as string} onChange={e => setMeta(m => ({ ...m, [k]: e.target.value }))} /></div>)}<div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>Logo</div><label style={{ display: 'block', padding: 10, border: '1px dashed var(--border)', borderRadius: 8, cursor: 'pointer', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{meta.logoUrl ? <img src={meta.logoUrl} alt="logo" style={{ height: 36, objectFit: 'contain' }} /> : '+ Upload Logo'}<input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => { if (e.target.files?.[0]) { const url = await toDataURL(e.target.files[0]); setMeta(m => ({ ...m, logoUrl: url })) } }} /></label>{meta.logoUrl && <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: 5 }} onClick={() => setMeta(m => ({ ...m, logoUrl: '' }))}>Hapus Logo</button>}</div>
              </>
            )}
            {tab === 'layers' && <LayerPanel layers={layers} selectedId={selId} onSelect={setSelId} onAdd={addLayer} onToggle={toggleLayer} onRemove={removeLayer} onUpdate={updateLayer} onApply={applyStyle} onReorder={reorderLayer} />}
            {tab === 'inset' && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Peta Inset / Lokasi</div><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" id="si" checked={showInset} onChange={e => setShowInset(e.target.checked)} /><label htmlFor="si" style={{ fontSize: 12, cursor: 'pointer' }}>Tampilkan peta inset</label></div>{showInset && <label style={{ display: 'block', padding: 12, border: '2px dashed var(--border)', borderRadius: 8, cursor: 'pointer', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}><Img size={20} style={{ display: 'block', margin: '0 auto 6px' }} />{insetUrl ? 'Ganti gambar inset' : 'Upload gambar inset (PNG/JPG)'}<input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => { if (e.target.files?.[0]) { const url = await toDataURL(e.target.files[0]); setInsetUrl(url) } }} /></label>}</div>}
            {tab === 'export' && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><button className="btn btn-primary" onClick={() => doExport('png')} disabled={exporting} style={{ justifyContent: 'center' }}>{exporting ? <RefreshCw size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Download size={13} />} Unduh PNG</button><button className="btn btn-secondary" onClick={() => doExport('pdf')} disabled={exporting} style={{ justifyContent: 'center' }}>{exporting ? <RefreshCw size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Download size={13} />} Unduh PDF</button></div>}
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', background: template === 'dark' ? '#0d1117' : '#dde3ea', padding: 20 }}><div style={{ maxWidth: '100%', display: 'flex', justifyContent: 'center' }}><div ref={wrapRef} style={{ position: 'relative', width: MAP_W, height: MAP_H, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', background: '#fff', overflow: 'hidden' }}><div ref={mapDivRef} style={{ ...mapStyle, position: 'absolute', zIndex: 1 }} /><div ref={frameRef} style={{ position: 'relative', zIndex: 10, width: '100%', height: '100%', pointerEvents: 'none' }}><MapFrame template={template} meta={meta} font={font} layers={layers} showInset={showInset} insetUrl={insetUrl} ticks={ticks} dynamicScale={dynamicScale} /></div></div></div></div>
      </div>
      <style>{`.leaflet-label-clean{background:transparent!important;border:none!important;box-shadow:none!important;padding:0!important;}`}</style>
    </div>
  )
}
