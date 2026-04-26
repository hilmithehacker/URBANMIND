// mapUtils.ts — Fixed: tidak ada race condition saat load library
// Setiap library track promise-nya sendiri, tidak ada early-resolve

let leafletPromise: Promise<void> | null = null
let shpPromise: Promise<void> | null = null
let jszipPromise: Promise<void> | null = null

/** Load script tag dan tunggu sampai benar-benar selesai (onload) */
function loadScript(id: string, src: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // Jika sudah ada dan sudah selesai (tidak ada flag loading)
    const existing = document.getElementById(id)
    if (existing && !(existing as any)._loading) {
      resolve()
      return
    }
    if (existing) {
      // Sudah ada tapi masih loading — tunggu
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error(`Gagal load ${src}`)))
      return
    }

    const s = document.createElement('script')
    s.id = id;
    (s as any)._loading = true
    s.src = src
    s.onload = () => { (s as any)._loading = false; resolve() }
    s.onerror = () => reject(new Error(`Gagal load script: ${src}`))
    document.head.appendChild(s)
  })
}

export async function loadLeaflet(_unused?: any): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).L) return

  if (!leafletPromise) {
    leafletPromise = (async () => {
      // CSS dulu
      if (!document.getElementById('leaflet-css')) {
        const lnk = document.createElement('link')
        lnk.id = 'leaflet-css'
        lnk.rel = 'stylesheet'
        lnk.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(lnk)
      }
      await loadScript('leaflet-js', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js')
    })()
  }

  return leafletPromise
}

export async function loadShp(): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).shp) return

  if (!shpPromise) {
    shpPromise = loadScript('shp-js', 'https://unpkg.com/shpjs@4.0.2/dist/shp.js')
  }

  return shpPromise
}

export async function loadJSZip(): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).JSZip) return

  if (!jszipPromise) {
    jszipPromise = loadScript('jszip-js', 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js')
  }

  return jszipPromise
}

/** Parse ZIP langsung via backend — lebih reliabel untuk file besar */
export async function parseZipViaBackend(file: File): Promise<{
  success: boolean
  layers?: BackendLayerInfo[]
  error?: string
  detail?: string
  summary?: { totalFiles: number; layersFound: number; validLayers: number; invalidLayers: number }
}> {
  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await fetch('http://localhost:3001/api/geoparse/zip', {
      method: 'POST',
      body: formData
    })
    const json = await res.json()
    return json
  } catch (e: any) {
    return { success: false, error: `Tidak dapat menghubungi backend: ${e.message}` }
  }
}

/** Interface layer dari backend */
export interface BackendLayerInfo {
  id: string
  name: string
  featureType: 'polygon' | 'line' | 'point' | 'unknown'
  featureCount: number
  fields: string[]
  valid: boolean
  errors: string[]
  warnings: string[]
  hasQml: boolean
  qmlStyle?: {
    type: 'single' | 'categorized' | 'rulebased'
    field?: string | null
    colorMap?: Record<string, string>
    fillColor?: string | null
    strokeColor?: string | null
    strokeWidth?: number | null
    dash?: string | null
    opacity?: number | null
  }
  geojson?: any
  supportingFiles: string[]
}
