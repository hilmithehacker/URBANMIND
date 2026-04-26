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
}

export default function LayerPanel({ layers, selectedId, onSelect, onAdd, onToggle, onRemove, onUpdate, onApply, onReorder }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const sel = layers.find(l => l.id === selectedId)
  const fields = sel ? Object.keys(sel.geojson?.features?.[0]?.properties || {}) : []

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="form-group" style={{ marginBottom: 8 }}>
      <label className="form-label" style={{ fontSize: 11 }}>{label}</label>
      {children}
    </div>
  )

  const ColorInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input type="color" value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', height: 30, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0 }} />
  )

  const RangeInput = ({ value, min, max, step, onChange, unit }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; unit?: string }) => (
    <div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)} style={{ width: '100%' }} />
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>{value}{unit}</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflowY: 'auto', paddingRight: 4 }}>
      {/* Upload */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Upload Layer</div>
        <div onClick={() => fileRef.current?.click()}
          style={{ padding: 12, border: '2px dashed var(--border)', borderRadius: 8, cursor: 'pointer', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
          <Upload size={18} style={{ display: 'block', margin: '0 auto 4px' }} />
          SHP (.zip) · GeoJSON
          <div style={{ fontSize: 10, marginTop: 2 }}>Multi-upload didukung</div>
        </div>
        <input ref={fileRef} type="file" accept=".zip,.geojson,.json,.qml" multiple style={{ display: 'none' }}
          onChange={e => { if (e.target.files) onAdd(e.target.files); e.target.value = '' }} />
      </div>

      {/* Layer list */}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {layers.map((layer, idx) => (
          <div key={layer.id} onClick={() => onSelect(layer.id)}
            style={{ padding: '8px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${selectedId === layer.id ? 'var(--accent)' : 'var(--border)'}`, background: selectedId === layer.id ? 'var(--accent-dim)' : 'var(--bg-tertiary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 13, height: 13, borderRadius: layer.featureType === 'point' ? '50%' : 2, background: layer.fillColor, border: `2px solid ${layer.strokeColor}`, flexShrink: 0 }} />
              <input style={{ fontSize: 12, flex: 1, background: 'none', border: 'none', color: 'inherit', fontWeight: selectedId === layer.id ? 600 : 400, padding: 0 }}
                value={layer.name} onChange={e => onUpdate(layer.id, { name: e.target.value })} onClick={e => e.stopPropagation()} />
              {layer.hasQml && <span style={{ fontSize: 8, color: '#fff', background: 'var(--accent)', padding: '0px 4px', borderRadius: 3, fontWeight: 700 }}>QML</span>}
              <button onClick={e => { e.stopPropagation(); onReorder(layer.id, 'up') }} disabled={idx === 0}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 1 }}><ArrowUp size={11} /></button>
              <button onClick={e => { e.stopPropagation(); onReorder(layer.id, 'down') }} disabled={idx === layers.length - 1}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 1 }}><ArrowDown size={11} /></button>
              <button onClick={e => { e.stopPropagation(); onToggle(layer.id) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: layer.visible ? 'var(--accent)' : 'var(--text-muted)', padding: 1 }}>
                {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
              <button onClick={e => { e.stopPropagation(); onRemove(layer.id) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: 1 }}><Trash2 size={12} /></button>
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

      {/* Style editor */}
      {sel && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
            ✏️ Atur: {sel.name}
          </div>
          <div style={{ fontSize: 9, color: 'var(--accent)', marginBottom: 12, fontWeight: 600 }}>
            {sel.featureType.toUpperCase()} • {sel.featureCount || 0} FITUR • {sel.fields?.length || 0} FIELD
          </div>

          {/* Color mode */}
          <Row label="Mode Warna">
            <select className="form-input" value={sel.colorMode} onChange={e => onUpdate(sel.id, { colorMode: e.target.value as any })}>
              <option value="single">Warna Tunggal</option>
              <option value="categorized">Per Kategori (Field)</option>
            </select>
          </Row>

          {sel.colorMode === 'single' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Row label="Warna Isi"><ColorInput value={sel.fillColor} onChange={v => onUpdate(sel.id, { fillColor: v })} /></Row>
              <Row label="Warna Border"><ColorInput value={sel.strokeColor} onChange={v => onUpdate(sel.id, { strokeColor: v })} /></Row>
            </div>
          ) : (
            <Row label="Field Kategori">
              <select className="form-input" value={sel.colorField} onChange={e => onUpdate(sel.id, { colorField: e.target.value })}>
                <option value="">— Pilih field —</option>
                {fields.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              {sel.colorField && Object.entries(sel.colorMap).length > 0 && (
                <div style={{ marginTop: 8, maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 2px' }}>
                  {Object.entries(sel.colorMap).map(([val, color]) => (
                    <div key={val} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="color" value={color} 
                        onChange={e => onUpdate(sel.id, { colorMap: { ...sel.colorMap, [val]: e.target.value } })}
                        style={{ width: 28, height: 22, border: 'none', borderRadius: 4, padding: 0, cursor: 'pointer', flexShrink: 0 }} />
                      <input className="form-input" style={{ fontSize: 11, height: 24, padding: '2px 6px', flex: 1 }} 
                        value={sel.categoryLabels?.[val] ?? val} 
                        onChange={e => onUpdate(sel.id, { categoryLabels: { ...sel.categoryLabels, [val]: e.target.value } })} 
                        placeholder={val} />
                    </div>
                  ))}
                </div>
              )}
            </Row>
          )}

          <Row label={`Opacity (${Math.round(sel.fillOpacity * 100)}%)`}>
            <RangeInput value={sel.fillOpacity} min={0} max={1} step={0.05} onChange={v => onUpdate(sel.id, { fillOpacity: v })} unit="%" />
          </Row>

          {/* Polygon-specific */}
          {sel.featureType === 'polygon' && (
            <>
              <Row label={`Ketebalan Border (${sel.strokeWidth}px)`}>
                <RangeInput value={sel.strokeWidth} min={0} max={6} step={0.5} onChange={v => onUpdate(sel.id, { strokeWidth: v })} unit="px" />
              </Row>
              <Row label="Garis Border">
                <select className="form-input" value={sel.strokeDash} onChange={e => onUpdate(sel.id, { strokeDash: e.target.value as any })}>
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
              </Row>
            </>
          )}

          {/* Line-specific */}
          {sel.featureType === 'line' && (
            <>
              <Row label={`Ketebalan (${sel.strokeWidth}px)`}>
                <RangeInput value={sel.strokeWidth} min={0.5} max={8} step={0.5} onChange={v => onUpdate(sel.id, { strokeWidth: v })} unit="px" />
              </Row>
              <Row label="Pola Garis">
                <select className="form-input" value={sel.strokeDash} onChange={e => onUpdate(sel.id, { strokeDash: e.target.value as any })}>
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed (--)</option>
                  <option value="dotted">Dotted (···)</option>
                </select>
              </Row>
            </>
          )}

          {/* Point-specific */}
          {sel.featureType === 'point' && (
            <>
              <Row label={`Ukuran Titik (${sel.pointRadius}px)`}>
                <RangeInput value={sel.pointRadius} min={3} max={20} step={1} onChange={v => onUpdate(sel.id, { pointRadius: v })} unit="px" />
              </Row>
              <Row label="Simbol">
                <select className="form-input" value={sel.pointSymbol} onChange={e => onUpdate(sel.id, { pointSymbol: e.target.value as any })}>
                  <option value="circle">● Lingkaran</option>
                  <option value="square">■ Persegi</option>
                  <option value="triangle">▲ Segitiga</option>
                </select>
              </Row>
            </>
          )}

          {/* Labels */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7 }}>Label</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
              <input type="checkbox" id="sl" checked={sel.showLabels} onChange={e => onUpdate(sel.id, { showLabels: e.target.checked })} />
              <label htmlFor="sl" style={{ fontSize: 12, cursor: 'pointer' }}>Tampilkan label</label>
            </div>
            {sel.showLabels && (
              <>
                <Row label="Field Label">
                  <select className="form-input" value={sel.labelField} onChange={e => onUpdate(sel.id, { labelField: e.target.value })}>
                    <option value="">— Pilih field —</option>
                    {fields.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Row>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Row label={`Ukuran (${sel.labelSize}px)`}>
                    <RangeInput value={sel.labelSize} min={8} max={22} step={1} onChange={v => onUpdate(sel.id, { labelSize: v })} unit="px" />
                  </Row>
                  <Row label="Warna Label"><ColorInput value={sel.labelColor} onChange={v => onUpdate(sel.id, { labelColor: v })} /></Row>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <input type="checkbox" id="lh" checked={sel.labelHalo} onChange={e => onUpdate(sel.id, { labelHalo: e.target.checked })} />
                  <label htmlFor="lh" style={{ fontSize: 12, cursor: 'pointer' }}>Halo putih di sekitar label</label>
                </div>
              </>
            )}
          </div>

          {/* Legend config */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7 }}>Legenda</div>
            <Row label="Label di Legenda">
              <input className="form-input" value={sel.legendLabel} placeholder={sel.name}
                onChange={e => onUpdate(sel.id, { legendLabel: e.target.value })} />
            </Row>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <input type="checkbox" id="lg" checked={sel.legendShow} onChange={e => onUpdate(sel.id, { legendShow: e.target.checked })} />
              <label htmlFor="lg" style={{ fontSize: 12, cursor: 'pointer' }}>Tampilkan di legenda</label>
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', marginTop: 12, justifyContent: 'center' }} onClick={() => onApply(sel.id)}>
            ✓ Terapkan Perubahan
          </button>
        </div>
      )}
    </div>
  )
}
