// mapsTypes.ts
export type TemplateType = 'formal-big' | 'formal-simple' | 'nonformal' | 'dark' | 'minimal'
export type PaperSize = 'A4' | 'A3' | 'A2' | 'A1' | 'A0'

// LANDSCAPE ORIENTATION (W > H)
export const PAPER_SIZES: Record<PaperSize, { w: number; h: number; scale: number }> = {
  'A4': { w: 1123, h: 794,  scale: 1.0 },
  'A3': { w: 1587, h: 1123, scale: 1.4 },
  'A2': { w: 2245, h: 1587, scale: 2.0 },
  'A1': { w: 3179, h: 2245, scale: 2.8 },
  'A0': { w: 4494, h: 3179, scale: 4.0 }
}
export type ColorMode = 'single' | 'categorized'

export const FONTS = [
  { id: 'Arial, sans-serif', label: 'Arial' },
  { id: '"Times New Roman", serif', label: 'Times New Roman' },
  { id: 'Georgia, serif', label: 'Georgia' },
  { id: '"Open Sans", sans-serif', label: 'Open Sans' },
  { id: '"Trebuchet MS", sans-serif', label: 'Trebuchet MS' },
]

export const BASEMAPS = [
  { id: 'none',        label: 'Tanpa Basemap (BIG Standard)', url: '', attr: '' },
  { id: 'osm',         label: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',              attr: '© OSM' },
  { id: 'carto-light', label: 'CartoDB Positron (Light)', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attr: '© CartoDB' },
  { id: 'carto-dark',  label: 'CartoDB Dark Matter', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: '© CartoDB' },
  { id: 'carto-voyager', label: 'CartoDB Voyager', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attr: '© CartoDB' },
  { id: 'satellite',   label: 'Esri World Imagery', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '© Esri' },
  { id: 'toner',       label: 'Stadia Toner (B&W)', url: 'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}{r}.png', attr: '© Stadia' },
]

export const TEMPLATES: Record<TemplateType, { label: string; desc: string }> = {
  'formal-big':    { label: 'Formal BIG Standard', desc: 'Standar Badan Informasi Geospasial Indonesia' },
  'formal-simple': { label: 'Formal Sederhana',    desc: 'Panel kanan, border single' },
  'nonformal':     { label: 'Non-Formal / Modern', desc: 'Overlay legenda, header bersih' },
  'dark':          { label: 'Dark Mode',            desc: 'Latar gelap untuk presentasi' },
  'minimal':       { label: 'Minimal',              desc: 'Hanya peta dan judul' },
}

export const PALETTE = [
  '#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6',
  '#1abc9c','#e67e22','#34495e','#e91e63','#00bcd4',
  '#8bc34a','#ff5722','#607d8b','#795548','#ff9800',
]

export interface MapLayer {
  id: string
  name: string
  geojson: any
  featureType: 'polygon' | 'line' | 'point'
  visible: boolean
  // Style
  colorMode: ColorMode
  fillColor: string
  strokeColor: string
  fillOpacity: number
  strokeWidth: number
  strokeDash: 'solid' | 'dashed' | 'dotted'
  // Categorized
  colorField: string
  colorMap: Record<string, string>
  categoryLabels: Record<string, string>
  // Point-specific
  pointRadius: number
  pointSymbol: 'circle' | 'square' | 'triangle'
  // Labels
  labelField: string
  showLabels: boolean
  labelSize: number
  labelColor: string
  labelHalo: boolean
  // Legend
  legendLabel: string
  legendShow: boolean
  hasQml?: boolean
  // Metadata
  featureCount?: number
  fields?: string[]
  // Leaflet ref
  leafletLayer: any
}

export interface MapMeta {
  title: string; subtitle: string; author: string; source: string
  date: string; scale: string; projection: string; datum: string
  logoUrl: string; publisherName: string; isFormal: boolean; paperSize: PaperSize; orientation: 'landscape' | 'portrait'
}

export const DEFAULT_META: MapMeta = {
  title: 'PETA ADMINISTRASI', subtitle: '', author: '', source: 'BIG, OpenStreetMap',
  date: new Date().toLocaleDateString('id-ID'), scale: '50.000',
  projection: 'Geografis', datum: 'WGS 1984', logoUrl: '', publisherName: '', isFormal: false, paperSize: 'A4', orientation: 'landscape'
}

// Map area position per template (relative to landscape dimensions)
export interface MapRect { top: number; left: number; right: number; bottom: number }
export function getMapRect(template: TemplateType, orientation: 'landscape' | 'portrait' = 'landscape'): MapRect {
  const isPortrait = orientation === 'portrait'
  switch (template) {
    case 'formal-big':    
    case 'formal-simple': 
      return isPortrait ? { top: 0, left: 0, right: 0, bottom: 220 } : { top: 0, left: 0, right: 200, bottom: 0 }
    case 'dark':
    case 'nonformal':     return { top: 0, left: 0,  right: 0,   bottom: 0 }
    case 'minimal':       return { top: 0,  left: 0,  right: 0,   bottom: 0  }
    default:              return isPortrait ? { top: 0, left: 0, right: 0, bottom: 220 } : { top: 0, left: 0, right: 200, bottom: 0 }
  }
}

export function formatDeg(val: number, isLat: boolean): string {
  const abs = Math.abs(val); const deg = Math.floor(abs); const minF = (abs - deg) * 60; const min = Math.round(minF)
  const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W')
  return `${deg}°${min > 0 ? min + "'" : ''}${dir}`
}

export function calcScale(map: any): number {
  if (!map) return 50000
  const zoom = map.getZoom(); const lat = map.getCenter().lat
  const metersPerPx = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom)
  return Math.round(metersPerPx / 0.000264583)
}
