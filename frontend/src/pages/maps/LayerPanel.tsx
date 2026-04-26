import { useRef } from 'react'
import { Upload, Eye, EyeOff, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import type { MapLayer } from './mapsTypes'

interface Props {
  layers: MapLayer[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: (files: FileList) => void
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<MapLayer>) => void
  onApply: (id: string) => void
  onReorder: (id: string, dir: 'up' | 'down') => void
  mode?: 'compact' | 'full' | 'detail'
}

export default function LayerPanel({ layers, selectedId, onSelect, onAdd, onToggle, onRemove, onUpdate, onApply, onReorder, mode }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const sel = layers.find((l) => l.id === selectedId)
  const fields = sel ? Object.keys(sel.geojson?.features?.[0]?.properties || {}) : []
  const showList = mode !== 'detail'
  const showDetail = mode !== 'compact'

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="form-group" style={{ marginBottom: 8 }}>
      <label className="form-label" style={{ fontSize: 11 }}>{label}</label>
      {children}
    </div>
  )

  const PALETTE_PRESETS: Record<string, string[]> = {
    formal: ['#1f2937', '#2563eb', '#0f766e', '#7c3aed', '#f97316'],
    grayscale: ['#111827', '#374151', '#6b7280', '#9ca3af', '#d1d5db'],
    pastel: ['#f8b4d9', '#a7f3d0', '#fcd34d', '#93c5fd', '#fbbf24'],
    'high-contrast': ['#000000', '#dc2626', '#16a34a', '#0ea5e9', '#f59e0b'],
    'colorblind': ['#0072b2', '#d55e00', '#cc79a7', '#009e73', '#e69f00'],
  }

  const ColorInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: 8, alignItems: 'center' }}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', height: 32, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', padding: 0, background: 'transparent' }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', height: 32, border: '1px solid var(--border)', borderRadius: 8, padding: '0 10px', fontSize: 12 }}
      />
    </div>
  )

  const RangeInput = ({ value, min, max, step, onChange, unit }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; unit?: string }) => (
    <div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} style={{ width: '100%' }} />
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>{value}{unit}</div>
    </div>
  )

  const buildCategorizedMap = (layer: MapLayer, field: string) => {
    const map: Record<string, string> = {}
    const values = [...new Set((layer.geojson?.features || []).map((f: any) => String(f.properties?.[field] ?? 'N/A')))]
    values.forEach((val: string, idx: number) => {
      map[val] = PALETTE_PRESETS.formal[idx % PALETTE_PRESETS.formal.length]
    })
    return map
  }

  const buildGraduatedMap = (layer: MapLayer, field: string, breaks: number, ramp: string) => {
    const values = (layer.geojson?.features || []).map((f: any) => Number(f.properties?.[field])).filter((v: number) => !Number.isNaN(v)).sort((a: number, b: number) => a - b)
    if (!values.length) return {}
    const min = values[0]
    const max = values[values.length - 1]
    const step = Math.max((max - min) / Math.max(breaks, 1), 1)
    const palette = PALETTE_PRESETS[ramp] || PALETTE_PRESETS.formal
    const map: Record<string, string> = {}
    for (let i = 0; i < breaks; i += 1) {
      const rangeKey = `${Math.round(min + i * step)}-${Math.round(min + (i + 1) * step)}`
      map[rangeKey] = palette[i % palette.length]
    }
    return map
  }

  const applyPreset = (id: string, preset: MapLayer['stylePreset']) => {
    const patchByPreset: Record<MapLayer['stylePreset'], Partial<MapLayer>> = {
      custom: {},
      soft: { fillOpacity: 0.45, strokeWidth: 0.9, strokeDash: 'solid', pointRadius: 6, pointOpacity: 0.75, pointStrokeWidth: 1 },
      bold: { fillOpacity: 0.85, strokeWidth: 2.2, strokeDash: 'solid', pointRadius: 8, pointOpacity: 1, pointStrokeWidth: 2 },
      pastel: { fillOpacity: 0.55, strokeWidth: 1.2, strokeDash: 'dashed', pointRadius: 7, pointOpacity: 0.8, pointStrokeWidth: 1.2 },
      mono: { fillColor: '#64748b', strokeColor: '#0f172a', fillOpacity: 0.4, strokeWidth: 1.1, strokeDash: 'solid', pointOpacity: 0.85 },
    }
    onUpdate(id, { stylePreset: preset, ...patchByPreset[preset] })
    onApply(id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflowY: 'auto', paddingRight: 4 }}>
      {showList && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Upload Layer</div>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              padding: 12,
              border: '2px dashed var(--border)',
              borderRadius: 12,
              cursor: 'pointer',
              textAlign: 'center',
              fontSize: 12,
              color: 'var(--text-muted)',
              background: 'var(--bg-tertiary)'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <Upload size={18} style={{ display: 'block', margin: '0 auto 4px' }} />
            SHP (.zip) atau GeoJSON
            <div style={{ fontSize: 10, marginTop: 4 }}>Multi-upload didukung</div>
            <div style={{ fontSize: 10, marginTop: 2, opacity: 0.85 }}>ZIP ideal: .shp + .shx + .dbf (+ .prj)</div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".zip,.geojson,.json,.qml"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files) onAdd(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      )}

      {showList && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {layers.map((layer, idx) => (
          <div
            key={layer.id}
            onClick={() => onSelect(layer.id)}
            style={{
              padding: '8px 10px',
              borderRadius: 7,
              cursor: 'pointer',
              border: `1px solid ${selectedId === layer.id ? 'var(--accent)' : 'var(--border)'}`,
              background: selectedId === layer.id ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: layer.featureType === 'point' ? '50%' : 2,
                  background: layer.fillColor,
                  border: `2px solid ${layer.strokeColor}`,
                  flexShrink: 0,
                }}
              />
              <input
                style={{
                  fontSize: 12,
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  fontWeight: selectedId === layer.id ? 600 : 400,
                  padding: 0,
                }}
                value={layer.name}
                onChange={(e) => onUpdate(layer.id, { name: e.target.value })}
                onClick={(e) => e.stopPropagation()}
              />
              {layer.hasQml && (
                <span style={{ fontSize: 8, color: '#fff', background: 'var(--accent)', padding: '0px 4px', borderRadius: 3, fontWeight: 700 }}>
                  QML
                </span>
              )}
              <button onClick={(e) => { e.stopPropagation(); onReorder(layer.id, 'up') }} disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 1 }}><ArrowUp size={11} /></button>
              <button onClick={(e) => { e.stopPropagation(); onReorder(layer.id, 'down') }} disabled={idx === layers.length - 1} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 1 }}><ArrowDown size={11} /></button>
              <button onClick={(e) => { e.stopPropagation(); onToggle(layer.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: layer.visible ? 'var(--accent)' : 'var(--text-muted)', padding: 1 }}>
                {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); onRemove(layer.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: 1 }}><Trash2 size={12} /></button>
            </div>
            {(layer.featureCount !== undefined || layer.featureType) && (
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 8, paddingLeft: 20 }}>
                <span style={{ textTransform: 'capitalize' }}>{layer.featureType}</span>
                {layer.featureCount !== undefined && <span>{layer.featureCount} fitur</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      {showDetail && sel ? (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
            Atur: {sel.name}
          </div>
          <div style={{ fontSize: 9, color: 'var(--accent)', marginBottom: 12, fontWeight: 600 }}>
            {sel.featureType.toUpperCase()} � {sel.featureCount || 0} FITUR � {sel.fields?.length || 0} FIELD
          </div>

          <Row label="Style Preset">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
              <select className="form-input" value={sel.stylePreset} onChange={(e) => onUpdate(sel.id, { stylePreset: e.target.value as any })}>
                <option value="custom">Custom</option>
                <option value="soft">Soft</option>
                <option value="bold">Bold</option>
                <option value="pastel">Pastel</option>
                <option value="mono">Monochrome</option>
              </select>
              <button className="btn btn-secondary btn-sm" onClick={() => applyPreset(sel.id, sel.stylePreset)} style={{ padding: '0 10px' }}>Apply</button>
            </div>
          </Row>

          <Row label="Mode Klasifikasi">
            <select className="form-input" value={sel.classificationMode} onChange={(e) => {
              const mode = e.target.value as any
              onUpdate(sel.id, { classificationMode: mode, colorMode: mode === 'graduated' || mode === 'categorized' ? 'categorized' : 'single' })
            }}>
              <option value="single">Single</option>
              <option value="categorized">Per Kategori</option>
              <option value="graduated">Graduated</option>
            </select>
          </Row>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <Row label="Warna Isi"><ColorInput value={sel.fillColor} onChange={(v) => onUpdate(sel.id, { fillColor: v })} /></Row>
            <Row label="Warna Border"><ColorInput value={sel.strokeColor} onChange={(v) => onUpdate(sel.id, { strokeColor: v })} /></Row>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 12 }}>
            {Object.values(PALETTE_PRESETS).flat().slice(0, 10).map((c) => (
              <button key={c} title={c} onClick={() => onUpdate(sel.id, { fillColor: c })} style={{ height: 24, borderRadius: 6, border: '1px solid var(--border)', background: c, cursor: 'pointer' }} />
            ))}
          </div>

          {(sel.classificationMode === 'categorized' || sel.classificationMode === 'graduated') && (
            <div style={{ padding: 12, borderRadius: 12, background: 'rgba(15, 23, 42, 0.03)', border: '1px solid var(--border)', marginBottom: 12 }}>
              <Row label="Field Data">
                <select className="form-input" value={sel.colorField} onChange={(e) => onUpdate(sel.id, { colorField: e.target.value })}>
                  <option value="">� Pilih field �</option>
                  {fields.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Row>
              {sel.classificationMode === 'graduated' && (
                <>
                  <Row label="Breaks"><RangeInput value={sel.graduatedBreaks} min={3} max={9} step={1} onChange={(v) => onUpdate(sel.id, { graduatedBreaks: v })} unit="" /></Row>
                  <Row label="Color Ramp">
                    <select className="form-input" value={sel.colorRamp} onChange={(e) => onUpdate(sel.id, { colorRamp: e.target.value as any })}>
                      <option value="formal">Formal</option>
                      <option value="grayscale">Grayscale</option>
                      <option value="pastel">Pastel</option>
                      <option value="high-contrast">High Contrast</option>
                      <option value="colorblind">Colorblind</option>
                    </select>
                  </Row>
                </>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {(PALETTE_PRESETS[sel.colorRamp] || PALETTE_PRESETS.formal).slice(0, 5).map((c) => (
                  <span key={c} style={{ width: 24, height: 24, borderRadius: 6, background: c, border: '1px solid var(--border)' }} />
                ))}
              </div>
            </div>
          )}

          {sel.classificationMode === 'categorized' && sel.colorField && (
            <Row label="Palette Kategori">
              <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => onUpdate(sel.id, { colorMap: buildCategorizedMap(sel, sel.colorField) })}>Generate Palette</button>
            </Row>
          )}

          {sel.classificationMode === 'graduated' && sel.graduatedField && (
            <Row label="Palette Graduated">
              <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => onUpdate(sel.id, { colorMap: buildGraduatedMap(sel, sel.graduatedField, sel.graduatedBreaks, sel.colorRamp) })}>Generate Breaks</button>
            </Row>
          )}

          <Row label={`Opacity (${Math.round(sel.fillOpacity * 100)}%)`}>
            <RangeInput value={sel.fillOpacity} min={0} max={1} step={0.05} onChange={(v) => onUpdate(sel.id, { fillOpacity: v })} unit="%" />
          </Row>

          {sel.featureType === 'polygon' && (
            <>
              <Row label={`Ketebalan Border (${sel.strokeWidth}px)`}>
                <RangeInput value={sel.strokeWidth} min={0} max={6} step={0.5} onChange={(v) => onUpdate(sel.id, { strokeWidth: v })} unit="px" />
              </Row>
              <Row label="Garis Border">
                <select className="form-input" value={sel.strokeDash} onChange={(e) => onUpdate(sel.id, { strokeDash: e.target.value as any })}>
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
              </Row>
            </>
          )}

          {sel.featureType === 'line' && (
            <>
              <Row label={`Ketebalan (${sel.strokeWidth}px)`}>
                <RangeInput value={sel.strokeWidth} min={0.5} max={8} step={0.5} onChange={(v) => onUpdate(sel.id, { strokeWidth: v })} unit="px" />
              </Row>
              <Row label="Pola Garis">
                <select className="form-input" value={sel.strokeDash} onChange={(e) => onUpdate(sel.id, { strokeDash: e.target.value as any })}>
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed (--)</option>
                  <option value="dotted">Dotted (...)</option>
                </select>
              </Row>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Row label="Line Cap">
                  <select className="form-input" value={sel.lineCap} onChange={(e) => onUpdate(sel.id, { lineCap: e.target.value as any })}>
                    <option value="round">Round</option>
                    <option value="butt">Butt</option>
                    <option value="square">Square</option>
                  </select>
                </Row>
                <Row label="Line Join">
                  <select className="form-input" value={sel.lineJoin} onChange={(e) => onUpdate(sel.id, { lineJoin: e.target.value as any })}>
                    <option value="round">Round</option>
                    <option value="miter">Miter</option>
                    <option value="bevel">Bevel</option>
                  </select>
                </Row>
              </div>
            </>
          )}

          {sel.featureType === 'point' && (
            <>
              <Row label={`Ukuran Titik (${sel.pointRadius}px)`}>
                <RangeInput value={sel.pointRadius} min={3} max={20} step={1} onChange={(v) => onUpdate(sel.id, { pointRadius: v })} unit="px" />
              </Row>
              <Row label={`Opacity Titik (${Math.round(sel.pointOpacity * 100)}%)`}>
                <RangeInput value={sel.pointOpacity} min={0.1} max={1} step={0.05} onChange={(v) => onUpdate(sel.id, { pointOpacity: v })} unit="%" />
              </Row>
              <Row label={`Stroke Titik (${sel.pointStrokeWidth}px)`}>
                <RangeInput value={sel.pointStrokeWidth} min={0.5} max={4} step={0.5} onChange={(v) => onUpdate(sel.id, { pointStrokeWidth: v })} unit="px" />
              </Row>
              <Row label="Simbol">
                <select className="form-input" value={sel.pointSymbol} onChange={(e) => onUpdate(sel.id, { pointSymbol: e.target.value as any })}>
                  <option value="circle">Lingkaran</option>
                  <option value="square">Persegi</option>
                  <option value="triangle">Segitiga</option>
                  <option value="diamond">Diamond</option>
                  <option value="star">Bintang</option>
                </select>
              </Row>
            </>
          )}

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7 }}>Label</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
              <input type="checkbox" id="sl" checked={sel.showLabels} onChange={(e) => onUpdate(sel.id, { showLabels: e.target.checked })} />
              <label htmlFor="sl" style={{ fontSize: 12, cursor: 'pointer' }}>Tampilkan label</label>
            </div>
            {sel.showLabels && (
              <>
                <Row label="Field Label">
                  <select className="form-input" value={sel.labelField} onChange={(e) => onUpdate(sel.id, { labelField: e.target.value })}>
                    <option value="">� Pilih field �</option>
                    {fields.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Row>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Row label={`Ukuran (${sel.labelSize}px)`}>
                    <RangeInput value={sel.labelSize} min={8} max={22} step={1} onChange={(v) => onUpdate(sel.id, { labelSize: v })} unit="px" />
                  </Row>
                  <Row label="Warna Label"><ColorInput value={sel.labelColor} onChange={(v) => onUpdate(sel.id, { labelColor: v })} /></Row>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <input type="checkbox" id="lh" checked={sel.labelHalo} onChange={(e) => onUpdate(sel.id, { labelHalo: e.target.checked })} />
                  <label htmlFor="lh" style={{ fontSize: 12, cursor: 'pointer' }}>Halo putih di sekitar label</label>
                </div>
              </>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7 }}>Legenda</div>
            <Row label="Label di Legenda">
              <input className="form-input" value={sel.legendLabel} placeholder={sel.name} onChange={(e) => onUpdate(sel.id, { legendLabel: e.target.value })} />
            </Row>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <input type="checkbox" id="lg" checked={sel.legendShow} onChange={(e) => onUpdate(sel.id, { legendShow: e.target.checked })} />
              <label htmlFor="lg" style={{ fontSize: 12, cursor: 'pointer' }}>Tampilkan di legenda</label>
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', marginTop: 12, justifyContent: 'center' }} onClick={() => onApply(sel.id)}>
            Apply Perubahan Layer
          </button>
        </div>
      ) : showDetail ? (
        <div style={{ marginTop: 24, fontSize: 12, color: 'var(--text-muted)', padding: 12, borderRadius: 12, background: 'rgba(15,23,42,0.04)' }}>
          Pilih layer di daftar kiri untuk melihat panel style dan opsi klasifikasi.
        </div>
      ) : null}
    </div>
  )
}
