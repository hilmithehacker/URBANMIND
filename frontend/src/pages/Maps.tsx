import { useState, useEffect, useRef } from 'react'
import { Layers, Image as Img, Download, RefreshCw, Settings, Map as MapIcon } from 'lucide-react'
import MapFrame from './maps/MapFrame'
import LayerPanel from './maps/LayerPanel'
import type { LayoutItem, LayoutMode, MapLayer, MapMeta, TemplateType, PaperSize } from './maps/mapsTypes'
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

let _lid = 0
const uid = () => `l${++_lid}`

const MAP_STORAGE_KEY = 'urbanmind_maps_project'

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max)
}

function getDefaultLayoutItems(mapW: number, mapH: number): LayoutItem[] {
  return [
    { id: 'title', label: 'Judul Peta', visible: true, top: 24, left: 24, width: 420, height: 100, zIndex: 130, locked: false },
    { id: 'legend', label: 'Legenda', visible: true, top: 24, left: mapW - 284, width: 260, height: 250, zIndex: 120, locked: false },
    { id: 'northArrow', label: 'North Arrow', visible: true, top: 144, left: 24, width: 120, height: 120, zIndex: 110, locked: false },
    { id: 'scaleBar', label: 'Skala', visible: true, top: 280, left: 24, width: 220, height: 70, zIndex: 100, locked: false },
    { id: 'inset', label: 'Inset', visible: true, top: mapH - 170, left: mapW - 224, width: 200, height: 150, zIndex: 90, locked: false },
    { id: 'source', label: 'Sumber', visible: true, top: mapH - 92, left: Math.max(24, (mapW - 240) / 2), width: 240, height: 70, zIndex: 80, locked: false }
  ]
}

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
function buildGraduatedMap(gj: any, field: string, breaks: number, ramp: string): Record<string, string> {
  const values = (gj.features || [])
    .map((f: any) => Number(f.properties?.[field]))
    .filter((v: number) => !Number.isNaN(v))
    .sort((a: number, b: number) => a - b)
  if (!values.length) return {}

  const colors = getRampColors(ramp, breaks)
  const min = values[0]
  const max = values[values.length - 1]
  const step = Math.max((max - min) / Math.max(breaks, 1), 1)
  const map: Record<string, string> = {}

  for (const feature of gj.features || []) {
    const value = Number(feature.properties?.[field])
    if (Number.isNaN(value)) continue
    const bucket = Math.min(Math.floor((value - min) / step), breaks - 1)
    const key = `${Math.round(min + bucket * step)}-${Math.round(min + (bucket + 1) * step)}`
    map[key] = colors[bucket]
  }
  return map
}
function getRampColors(ramp: string, count: number) {
  const palettes: Record<string, string[]> = {
    formal: ['#1f2937', '#3f51b5', '#2563eb', '#0ea5e9', '#22c55e'],
    grayscale: ['#111827', '#374151', '#6b7280', '#9ca3af', '#d1d5db'],
    pastel: ['#f8b4d9', '#a7f3d0', '#fcd34d', '#93c5fd', '#fbbf24'],
    'high-contrast': ['#000000', '#d97706', '#dc2626', '#0f766e', '#2563eb'],
    colorblind: ['#0072b2', '#d55e00', '#cc79a7', '#009e73', '#e69f00'],
    custom: PALETTE,
  }
  const palette = palettes[ramp] || palettes.formal
  return Array.from({ length: count }, (_, i) => palette[i % palette.length])
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

type Tab = 'compose' | 'layers' | 'inset' | 'export'

export default function Maps() {
  const mapDivRef = useRef<HTMLDivElement>(null); const frameRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null); const mapInst = useRef<any>(null); const baseTile = useRef<any>(null)
  const [ready, setReady] = useState(false)
  const [template, setTemplate] = useState<TemplateType>('formal-big'); const [basemap, setBasemap] = useState('none')
  const [font, setFont] = useState('Arial, sans-serif'); const [meta, setMeta] = useState<MapMeta>(DEFAULT_META)
  const [layers, setLayers] = useState<MapLayer[]>([]); const [selId, setSelId] = useState<string | null>(null)
  const [showInset, setShowInset] = useState(true); const [insetUrl, setInsetUrl] = useState('')
  const [showGrid, setShowGrid] = useState(true); const [ticks, setTicks] = useState<any[]>([])
  const [dynamicScale, setDynamicScale] = useState(50000);
  const [targetScale, setTargetScale] = useState(50000);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('template')
  const [layoutItems, setLayoutItems] = useState<LayoutItem[]>(() => getDefaultLayoutItems(PAPER_SIZES.A4.w, PAPER_SIZES.A4.h))
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [mapZoom, setMapZoom] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false); const [msg, setMsg] = useState('')
  const [tab, setTab] = useState<'compose' | 'layers' | 'inset' | 'export'>('compose')
  const selectedLayer = layers.find(l => l.id === selId) || null
  const sel = selectedLayer
  const [msgType, setMsgType] = useState<'info' | 'success' | 'warning' | 'error'>('info')
  const [msgAction, setMsgAction] = useState<(() => void) | null>(null)

  const showMessage = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', action: (() => void) | null = null) => {
    setMsg(message)
    setMsgType(type)
    setMsgAction(() => action)
  }

  const refreshMap = () => {
    if (!mapInst.current) return
    showMessage('⏳ Sinkronisasi komponen peta...', 'info')
    
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
    showMessage('✅ Peta berhasil disinkronisasi', 'success')
  }

  // Muat seluruh state proyek Maps dari localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MAP_STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        if (data.template) setTemplate(data.template)
        if (data.basemap) setBasemap(data.basemap)
        if (data.font) setFont(data.font)
        if (data.meta) setMeta(prev => ({ ...prev, ...data.meta }))
        if (data.layers) setLayers((data.layers as MapLayer[]).map(layer => ({ ...layer, leafletLayer: null })))
        if (data.selId) setSelId(data.selId)
        if (data.showInset !== undefined) setShowInset(data.showInset)
        if (data.insetUrl) setInsetUrl(data.insetUrl)
        if (data.showGrid !== undefined) setShowGrid(data.showGrid)
        if (data.targetScale) setTargetScale(data.targetScale)
        if (data.layoutMode) setLayoutMode(data.layoutMode)
        if (Array.isArray(data.layoutItems)) setLayoutItems(data.layoutItems)
        if (data.mapCenter) setMapCenter(data.mapCenter)
        if (data.mapZoom) setMapZoom(data.mapZoom)
      }
    } catch (error) {
      console.warn('Gagal memuat state Maps:', error)
    }
  }, [])

  // Simpan state proyek Maps ke localStorage setiap kali berubah
  useEffect(() => {
    try {
      localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify({
        template,
        basemap,
        font,
        meta,
        layers: layers.map((layer) => ({ ...layer, leafletLayer: null })),
        selId,
        showInset,
        insetUrl,
        showGrid,
        targetScale,
        layoutMode,
        layoutItems,
        mapCenter,
        mapZoom,
      }))
    } catch (error) {
      console.warn('Gagal menyimpan state Maps:', error)
    }
  }, [template, basemap, font, meta, layers, selId, showInset, insetUrl, showGrid, targetScale, layoutMode, layoutItems, mapCenter, mapZoom])

  useEffect(() => { if (meta.isFormal) setBasemap('none') }, [meta.isFormal])
  const paper = PAPER_SIZES[meta.paperSize || 'A4']
  const isPortrait = meta.orientation === 'portrait'
  const MAP_W = isPortrait ? paper.h : paper.w
  const MAP_H = isPortrait ? paper.w : paper.h
  const rect = getMapRect(template, meta.orientation)
  useEffect(() => {
    setLayoutItems(prev => prev.map(item => ({
      ...item,
      left: clamp(item.left, 16, MAP_W - item.width - 16),
      top: clamp(item.top, 16, MAP_H - item.height - 16)
    })))
  }, [MAP_W, MAP_H])
  const mapStyle: React.CSSProperties = { top: rect.top * paper.scale, left: rect.left * paper.scale, right: rect.right * paper.scale, bottom: rect.bottom * paper.scale }

  useEffect(() => { loadLeaflet(typeof L !== 'undefined' ? L : undefined).then(() => setReady(true)) }, [])
  useEffect(() => {
    if (!ready || !mapDivRef.current || mapInst.current) return
    const initialCenter = mapCenter ? [mapCenter.lat, mapCenter.lng] : [-2, 118]
    const initialZoom = mapZoom ?? 5
    const m = window.L.map(mapDivRef.current, { 
      zoomControl: false, 
      attributionControl: false,
      inertia: true,
      inertiaDeceleration: 2500,
      inertiaMaxSpeed: 2200,
      zoomSnap: 0.01,
      zoomDelta: 0.01,
      wheelPxPerZoomLevel: 150
    }).setView(initialCenter, initialZoom)
    mapInst.current = m
    m.on('moveend zoomend', () => {
      setDynamicScale(calcScale(m)); updateTicks(m)
      const c = m.getCenter(); setMapCenter({ lat: c.lat, lng: c.lng }); setMapZoom(m.getZoom())
    })
    updateTicks(m)
  }, [ready, mapCenter, mapZoom])

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
    const createStyle = (feature: any) => {
      const props = feature.properties || {}
      let fill = l.fillColor
      if (l.classificationMode === 'categorized' && l.colorField) {
        fill = l.colorMap[String(props[l.colorField] ?? 'N/A')] || fill
      } else if (l.classificationMode === 'graduated' && l.graduatedField && l.colorMap) {
        const value = Number(props[l.graduatedField])
        if (!Number.isNaN(value)) {
          const buckets = Object.keys(l.colorMap)
          const match = buckets.find(key => {
            const [min, max] = key.split('-').map(Number)
            return !Number.isNaN(min) && !Number.isNaN(max) && value >= min && value <= max
          })
          if (match) fill = l.colorMap[match]
        }
      }
      return {
        color: l.strokeColor,
        weight: l.strokeWidth,
        fillColor: fill,
        fillOpacity: l.featureType === 'point' ? l.pointOpacity : l.fillOpacity,
        dashArray: dashArray(l.strokeDash),
        lineCap: l.lineCap,
        lineJoin: l.lineJoin
      }
    }

    const mainLayer = window.L.geoJSON(l.geojson, {
      style: createStyle,
      pointToLayer: (feature: any, latlng: any) => {
        const props = feature.properties || {}
        let fill = l.fillColor
        if (l.classificationMode === 'categorized' && l.colorField) fill = l.colorMap[String(props[l.colorField] ?? 'N/A')] || fill
        if (l.classificationMode === 'graduated' && l.graduatedField && l.colorMap) {
          const value = Number(props[l.graduatedField])
          if (!Number.isNaN(value)) {
            const buckets = Object.keys(l.colorMap)
            const match = buckets.find(key => {
              const [min, max] = key.split('-').map(Number)
              return !Number.isNaN(min) && !Number.isNaN(max) && value >= min && value <= max
            })
            if (match) fill = l.colorMap[match]
          }
        }

        const size = l.pointRadius * 2
        const symbol = l.pointSymbol
        if (symbol === 'square') {
          return window.L.marker(latlng, {
            icon: window.L.divIcon({
              className: 'um-point-icon',
              html: `<div style="width:${size}px;height:${size}px;background:${fill};border:${l.pointStrokeWidth}px solid ${l.strokeColor};opacity:${l.pointOpacity};border-radius:6px"></div>`,
              iconSize: [size, size],
              iconAnchor: [l.pointRadius, l.pointRadius]
            })
          })
        }
        if (symbol === 'triangle') {
          return window.L.marker(latlng, {
            icon: window.L.divIcon({
              className: 'um-point-icon',
              html: `<div style="width:0;height:0;border-left:${size / 2}px solid transparent;border-right:${size / 2}px solid transparent;border-bottom:${size}px solid ${fill};opacity:${l.pointOpacity}"></div>`,
              iconSize: [size, size],
              iconAnchor: [l.pointRadius, l.pointRadius]
            })
          })
        }
        if (symbol === 'diamond') {
          return window.L.marker(latlng, {
            icon: window.L.divIcon({
              className: 'um-point-icon',
              html: `<div style="width:${size}px;height:${size}px;background:${fill};border:${l.pointStrokeWidth}px solid ${l.strokeColor};transform:rotate(45deg);opacity:${l.pointOpacity}"></div>`,
              iconSize: [size, size],
              iconAnchor: [l.pointRadius, l.pointRadius]
            })
          })
        }
        if (symbol === 'star') {
          return window.L.marker(latlng, {
            icon: window.L.divIcon({
              className: 'um-point-icon',
              html: `<div style="width:${size}px;height:${size}px;clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);background:${fill};border:${l.pointStrokeWidth}px solid ${l.strokeColor};opacity:${l.pointOpacity}"></div>`,
              iconSize: [size, size],
              iconAnchor: [l.pointRadius, l.pointRadius]
            })
          })
        }
        return window.L.circleMarker(latlng, {
          radius: l.pointRadius,
          fillColor: fill,
          color: l.strokeColor,
          weight: l.pointStrokeWidth,
          fillOpacity: l.pointOpacity
        })
      },
      onEachFeature: (feature: any, lyr: any) => {
        if (l.showLabels && l.labelField && feature.properties?.[l.labelField] != null) {
          const txt = String(feature.properties[l.labelField]); const halo = l.labelHalo ? `text-shadow:0 0 3px #fff,0 0 3px #fff;` : ''
          lyr.bindTooltip(`<span style="font-size:${l.labelSize}px;color:${l.labelColor};${halo}font-weight:600">${txt}</span>`, { permanent: true, direction: 'center', className: 'leaflet-label-clean', offset: [0, 0] })
        }
      }
    })

    if (l.outerStrokeWidth > 0 && l.featureType !== 'point') {
      const outlineLayer = window.L.geoJSON(l.geojson, {
        style: () => ({
          color: l.outerStrokeColor,
          weight: l.outerStrokeWidth,
          opacity: 1,
          fillOpacity: 0,
          lineCap: l.lineCap,
          lineJoin: l.lineJoin
        })
      })
      return window.L.layerGroup([outlineLayer, mainLayer]).addTo(mapInst.current)
    }
    return mainLayer.addTo(mapInst.current)
  }

  const applyStyle = (id: string) => {
    setLayers(prev => prev.map(l => {
      if (l.id !== id) return l
      if (l.leafletLayer) mapInst.current?.removeLayer(l.leafletLayer)
      let cm = l.colorMap; if (l.colorMode === 'categorized' && l.colorField && !Object.keys(cm).length) cm = buildColorMap(l.geojson, l.colorField)
      const upd = { ...l, colorMap: cm, categoryLabels: l.categoryLabels || {} }; return { ...upd, leafletLayer: renderLayer(upd) }
    }))
    showMessage('✅ Style diterapkan', 'success')
  }

  useEffect(() => {
    if (!mapInst.current) return
    layers.forEach(l => {
      if (l.leafletLayer && l.visible && l.leafletLayer.setStyle) {
        l.leafletLayer.setStyle((f: any) => {
          let fill = l.fillColor; let stroke = l.strokeColor; let weight = l.strokeWidth; let opac = l.fillOpacity
          if (l.classificationMode === 'categorized' && l.colorField) {
            fill = l.colorMap[String(f.properties?.[l.colorField] ?? 'N/A')] || fill
          } else if (l.classificationMode === 'graduated' && l.graduatedField && l.colorMap) {
            const value = Number(f.properties?.[l.graduatedField])
            if (!Number.isNaN(value)) {
              const buckets = Object.keys(l.colorMap)
              const match = buckets.find(key => {
                const [min, max] = key.split('-').map(Number)
                return !Number.isNaN(min) && !Number.isNaN(max) && value >= min && value <= max
              })
              if (match) fill = l.colorMap[match]
            }
          } else if (meta.isFormal) {
            if (l.featureType === 'polygon') { fill = '#f1f5f9'; stroke = '#000000'; weight = 0.5; opac = 0.4 }
            else if (l.featureType === 'line') { stroke = '#000000'; weight = 0.8 }
            else { fill = '#000000'; stroke = '#ffffff'; weight = 0.8 }
          }
          return {
            color: stroke,
            weight: weight,
            fillColor: fill,
            fillOpacity: l.featureType === 'point' ? l.pointOpacity : opac,
            dashArray: dashArray(l.strokeDash),
            lineCap: l.lineCap,
            lineJoin: l.lineJoin
          }
        })
      }
    })
  }, [layers, meta.isFormal])

  // ── addLayer: kirim ke backend, fallback ke client-side jika offline ──────
  const addLayer = async (files: FileList) => {
    showMessage('⏳ Memproses file...', 'info')
    const results: { name: string; gj: any; qml?: any }[] = []

    for (const file of Array.from(files)) {
      try {
        // ── ZIP: coba backend parser dulu ──────────────────────────────────
        if (file.name.toLowerCase().endsWith('.zip')) {
          showMessage(`⏳ Mengirim ${file.name} ke parser...`, 'info')
          const backendResult = await parseZipViaBackend(file)

          if (backendResult.success && backendResult.layers && backendResult.layers.length > 0) {
            // ── Backend berhasil ────────────────────────────────────────────
            const validLayers = backendResult.layers.filter((l: BackendLayerInfo) => l.valid && l.geojson)
            const invalidLayers = backendResult.layers.filter((l: BackendLayerInfo) => !l.valid)

            if (invalidLayers.length > 0) {
              const errMsgs = invalidLayers.map((l: BackendLayerInfo) =>
                `${l.name}: ${l.errors.join(', ')}`
              ).join(' | ')
              showMessage(`⚠️ ${invalidLayers.length} layer invalid: ${errMsgs}`, 'warning')
            }

            if (validLayers.length === 0) {
              showMessage(`❌ Tidak ada layer valid dalam ${file.name}. ${backendResult.layers.map((l: BackendLayerInfo) => l.errors.join(', ')).join(' | ')}`, 'error')
              continue
            }

            // Tambah setiap valid layer
            for (const bl of validLayers) {
              results.push({ name: bl.name, gj: bl.geojson, qml: bl.qmlStyle ? { _parsed: bl.qmlStyle } : undefined })
            }
            showMessage(`✅ Backend: ${validLayers.length} layer ditemukan dalam ${file.name}`, 'success')
            continue
          }

          // Backend gagal/offline — fallback ke client-side
          const backendErr = backendResult.error || 'Backend tidak tersedia'
          console.warn('[addLayer] Backend parse failed, fallback client:', backendErr)
          showMessage(`⚠️ Backend offline, parsing lokal: ${file.name}...`, 'warning')

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
              showMessage(`⏳ Parsing ${base}...`, 'info')
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
                showMessage(`❌ Gagal parse ${base}: ${err.message}`, 'error')
              }
            }
          } catch (clientErr: any) {
            showMessage(`❌ Gagal parse ${file.name}: ${clientErr.message}`, 'error')
            continue
          }

        } else if (file.name.endsWith('.json') || file.name.endsWith('.geojson')) {
          // ── GeoJSON langsung ──────────────────────────────────────────────
          const text = await file.text()
          results.push({ name: file.name.replace(/\.[^.]+$/, ''), gj: JSON.parse(text) })
        }
      } catch (e: any) {
        showMessage(`❌ Gagal memuat ${file.name}: ${e.message}`, 'error')
      }
    }

    if (!results.length) {
      showMessage('⚠️ Tidak ada layer valid yang ditemukan. Pastikan ZIP berisi .shp beserta .dbf dan .shx.', 'warning')
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
          classificationMode: 'single',
          colorRamp: 'formal',
          graduatedField: '',
          graduatedBreaks: 5,
          outerStrokeColor: '#ffffff',
          outerStrokeWidth: 0,
          patternFill: 'none',
          fillColor: PALETTE[(prev.length + idx) % PALETTE.length],
          strokeColor: '#000000', fillOpacity: 0.65, strokeWidth: 1, strokeDash: 'solid',
          lineCap: 'round', lineJoin: 'round', stylePreset: 'custom',
          colorField: '', colorMap: {}, categoryLabels: {}, pointRadius: 5, pointSymbol: 'circle',
          pointStrokeWidth: 1.2, pointOpacity: 0.85,
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

    showMessage(`✅ ${results.length} layer berhasil dimuat ke peta`, 'success')
  }

  const updateLayer = (id: string, patch: Partial<MapLayer>) => setLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  const toggleLayer = (id: string) => setLayers(prev => prev.map(l => { if (l.id !== id) return l; if (l.leafletLayer) { if (l.visible) mapInst.current?.removeLayer(l.leafletLayer); else l.leafletLayer.addTo(mapInst.current) }; return { ...l, visible: !l.visible } }))
  const removeLayer = (id: string) => { setLayers(prev => { const l = prev.find(x => x.id === id); if (l?.leafletLayer) mapInst.current?.removeLayer(l.leafletLayer); return prev.filter(x => x.id !== id) }); if (selId === id) setSelId(null) }
  const reorderLayer = (id: string, dir: 'up' | 'down') => setLayers(prev => { const i = prev.findIndex(l => l.id === id); if (i < 0) return prev; const arr = [...prev]; const sw = dir === 'up' ? i - 1 : i + 1; if (sw < 0 || sw >= arr.length) return prev;[arr[i], arr[sw]] = [arr[sw], arr[i]]; return arr })

  const doExport = async (fmt: 'jpg' | 'pdf' | 'png') => {
    if (!wrapRef.current) return
    setExporting(true); showMessage('⏳ Mengekspor...', 'info')
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
      showMessage('✅ Berhasil diunduh', 'success')
    } catch (e: any) { showMessage('❌ ' + e.message, 'error') } finally { setExporting(false) }
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
      {msg && <div className={`alert ${msgType === 'success' ? 'alert-success' : msgType === 'error' ? 'alert-error' : msgType === 'warning' ? 'alert-warning' : 'alert-info'}`} style={{ margin: 0, borderRadius: 0, fontSize: 12, padding: '6px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>{msg}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {msgAction && msgType === 'error' && <button className="btn btn-sm btn-secondary" onClick={() => msgAction()} style={{ padding: '4px 10px' }}>Retry</button>}
          <button onClick={() => { setMsg(''); setMsgAction(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 14 }}>×</button>
        </div>
      </div>}
      <div style={{ display: 'grid', flex: 1, gridTemplateColumns: '320px 1fr 320px', gap: 16, overflow: 'hidden', padding: 20 }}>
        <aside style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 20, padding: 18, gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Map Designer</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Layout & Controls</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setTab('compose')} style={{ whiteSpace: 'nowrap' }}>Quick Reset</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
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

                  <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>Mode Layout</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      {(['template', 'composer'] as LayoutMode[]).map(mode => (
                        <button key={mode} onClick={() => setLayoutMode(mode)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${layoutMode === mode ? 'var(--accent)' : 'var(--border)'}`, background: layoutMode === mode ? 'var(--accent-dim)' : 'var(--bg-tertiary)', color: layoutMode === mode ? 'var(--accent)' : 'var(--text)', fontSize: 11, fontWeight: 700 }}>{mode === 'composer' ? 'Composer' : 'Template'}</button>
                      ))}
                    </div>
                    {layoutMode === 'composer' && (
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>Atur Elemen Layout</div>
                          <button className="btn btn-secondary btn-sm" style={{ padding: '6px 10px' }} onClick={() => setLayoutItems(getDefaultLayoutItems(MAP_W, MAP_H))}>Reset Layout</button>
                        </div>
                        {layoutItems.map(item => (
                          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 8, padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>{item.label}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>L {Math.round(item.left)} · T {Math.round(item.top)} · W {Math.round(item.width)} · H {Math.round(item.height)}</div>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}><input type="checkbox" checked={item.visible} onChange={(e) => setLayoutItems(prev => prev.map(i => i.id === item.id ? { ...i, visible: e.target.checked } : i))} />Tampil</label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}><input type="checkbox" checked={item.locked} onChange={(e) => setLayoutItems(prev => prev.map(i => i.id === item.id ? { ...i, locked: e.target.checked } : i))} />Kunci</label>
                          </div>
                        ))}
                      </div>
                    )}
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
        </aside>
        <main style={{ position: 'relative', overflow: 'auto', background: template === 'dark' ? '#111821' : '#f2f6fb', padding: 20, borderRadius: 20, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div ref={wrapRef} style={{ position: 'relative', width: MAP_W, height: MAP_H, minWidth: 0, minHeight: 0, boxShadow: '0 30px 80px rgba(0,0,0,0.18)', borderRadius: 20, overflow: 'hidden', background: '#fff' }}>
            <div ref={mapDivRef} style={{ ...mapStyle, position: 'absolute', inset: 0, zIndex: 1 }} />
            <div ref={frameRef} style={{ position: 'relative', zIndex: 10, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <MapFrame template={template} meta={meta} font={font} layers={layers} showInset={showInset} insetUrl={insetUrl} ticks={ticks} dynamicScale={dynamicScale} layoutMode={layoutMode} layoutItems={layoutItems} onLayoutChange={(item) => setLayoutItems(prev => prev.map(i => i.id === item.id ? item : i))} />
            </div>
          </div>
        </main>
        <aside style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 20, padding: 18, gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Inspector</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>{sel ? sel.name : 'Map Summary'}</div>
          </div>
          {sel ? (
            <div style={{ display: 'grid', gap: 12, padding: 14, borderRadius: 18, background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Layer type</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{sel.featureType.toUpperCase()}</div>
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Features</div>
                <div style={{ fontSize: 13 }}>{sel.featureCount ?? 0}</div>
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Visible</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: sel.visible ? 'var(--success)' : 'var(--text-muted)' }}>{sel.visible ? 'Yes' : 'Hidden'}</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelId(null)}>Deselect</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12, padding: 14, borderRadius: 18, background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Map details</div>
              <div style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                <div>Layers: {layers.length}</div>
                <div>Proj: {meta.projection || 'WGS84'}</div>
                <div>Grid: {showGrid ? 'On' : 'Off'}</div>
                <div>Paper: {meta.paperSize} / {meta.orientation}</div>
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 18, background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Quick export</div>
            <button className="btn btn-primary" onClick={() => doExport('png')} disabled={exporting} style={{ justifyContent: 'center' }}>{exporting ? <RefreshCw size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Download size={13} />} PNG</button>
            <button className="btn btn-secondary" onClick={() => doExport('pdf')} disabled={exporting} style={{ justifyContent: 'center' }}>{exporting ? <RefreshCw size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Download size={13} />} PDF</button>
          </div>
        </aside>
      </div>
      <style>{`
        .leaflet-label-clean{background:transparent!important;border:none!important;box-shadow:none!important;padding:0!important;}
        .um-point-icon{background:transparent!important;border:none!important;}
        .leaflet-interactive{transition: stroke 140ms ease, fill 140ms ease, opacity 140ms ease;}
      `}</style>
    </div>
  )
}
