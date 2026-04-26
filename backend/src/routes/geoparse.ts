/**
 * geoparse.ts — Backend ZIP parser untuk UrbanMind
 * Endpoint: POST /api/geoparse/zip
 * - Menerima file ZIP via multipart
 * - Extract, group shapefile components
 * - Detect geometry type & atribut via shpjs
 * - Parse QML (fuzzy matching ke layer basename)
 * - Balas daftar layer dengan metadata + style dari QML
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import JSZip from 'jszip';

const router = Router();

// ── Multer: simpan sementara di memory (maks 100MB) ─────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'].includes(file.mimetype)
      || file.originalname.toLowerCase().endsWith('.zip');
    if (ok) cb(null, true);
    else cb(new Error('Hanya file ZIP yang didukung'));
  }
});

// ── Interfaces ───────────────────────────────────────────────────────────────
export interface QMLStyle {
  type: 'single' | 'categorized' | 'rulebased';
  field?: string | null;
  colorMap?: Record<string, string>;
  fillColor?: string | null;
  strokeColor?: string | null;
  strokeWidth?: number | null;
  dash?: string | null;
  opacity?: number | null;
}

export interface LayerInfo {
  id: string;
  name: string;
  featureType: 'polygon' | 'line' | 'point' | 'unknown';
  featureCount: number;
  fields: string[];
  valid: boolean;
  errors: string[];
  warnings: string[];
  hasQml: boolean;
  qmlStyle?: QMLStyle;
  geojson?: any;
  supportingFiles: string[];
}

// ── QML Parser ───────────────────────────────────────────────────────────────
function parseQMLXml(xml: string): QMLStyle | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DOMParser: XmlDOMParser } = require('@xmldom/xmldom');
    const parser = new XmlDOMParser();
    const doc = parser.parseFromString(xml, 'text/xml') as any;

    // Cek error parse
    const parseError = doc.getElementsByTagName('parsererror');
    if (parseError.length > 0) {
      console.warn('[QML] XML parse error:', parseError[0].textContent?.slice(0, 200));
      return null;
    }

    const renderer = doc.getElementsByTagName('renderer-v2')[0];
    if (!renderer) {
      console.warn('[QML] Tidak ada renderer-v2 dalam QML');
      return null;
    }

    const parseColor = (c: string | null | undefined): string | null => {
      if (!c) return null;
      // Format QGIS: "R,G,B,A" atau "R,G,B"
      if (/^\d+,\d+,\d+(,\d+)?$/.test(c.trim())) {
        const parts = c.trim().split(',');
        const r = parseInt(parts[0]), g = parseInt(parts[1]), b = parseInt(parts[2]);
        const a = parts[3] !== undefined ? parseInt(parts[3]) / 255 : 1;
        return `rgba(${r},${g},${b},${a.toFixed(2)})`;
      }
      // Format HEX
      if (/^#[0-9a-fA-F]{3,8}$/.test(c.trim())) return c.trim();
      return c.trim() || null;
    };

    const getSymbolStyle = (sym: any | null): Partial<QMLStyle> => {
      if (!sym) return {};
      const getProp = (key: string): string | null => {
        const props = sym.getElementsByTagName('prop');
        for (let i = 0; i < props.length; i++) {
          if (props[i].getAttribute('k') === key) return props[i].getAttribute('v');
        }
        // Coba juga data_defined_properties
        const ddProps = sym.getElementsByTagName('Option');
        for (let i = 0; i < ddProps.length; i++) {
          if (ddProps[i].getAttribute('name') === key) return ddProps[i].getAttribute('value');
        }
        return null;
      };

      // Beberapa key yang berbeda tergantung versi QGIS
      const fill = getProp('color') || getProp('fill_color') || getProp('fillColor');
      const stroke = getProp('outline_color') || getProp('line_color') || getProp('border_color') || getProp('color');
      const sw = getProp('outline_width') || getProp('line_width') || getProp('width') || getProp('stroke_width');
      const opacityStr = getProp('opacity');

      const lineStyle = getProp('line_style') || getProp('customdash');
      let dash: string | null = null;
      if (lineStyle === 'dash' || lineStyle === 'dashed') dash = '8,4';
      else if (lineStyle === 'dot' || lineStyle === 'dotted') dash = '2,4';
      else if (lineStyle && lineStyle.includes(',')) dash = lineStyle;

      return {
        fillColor: parseColor(fill),
        strokeColor: parseColor(stroke !== fill ? stroke : null), // hindari duplikat
        strokeWidth: sw ? parseFloat(sw) * 2.0 : null,
        opacity: opacityStr ? parseFloat(opacityStr) : null,
        dash
      };
    };

    const rendererType = renderer.getAttribute('type') || 'singleSymbol';

    if (rendererType === 'categorizedSymbol') {
      const attrField = renderer.getAttribute('attr') || renderer.getAttribute('field');
      const categories = Array.from(doc.getElementsByTagName('category')) as any[];
      const symbols = Array.from(doc.getElementsByTagName('symbol')) as any[];

      const colorMap: Record<string, string> = {};
      categories.forEach(cat => {
        const val = cat.getAttribute('value');
        const symName = cat.getAttribute('symbol');
        const sym = symbols.find(s => s.getAttribute('name') === symName) || null;
        const style = getSymbolStyle(sym);
        if (val !== null && style.fillColor) colorMap[val] = style.fillColor;
      });

      const firstStyle = getSymbolStyle(symbols[0] || null);
      return { type: 'categorized', field: attrField, colorMap, ...firstStyle };
    }

    if (rendererType === 'RuleRenderer' || rendererType === 'rulebased') {
      const sym = doc.getElementsByTagName('symbol')[0] || null;
      return { type: 'rulebased', ...getSymbolStyle(sym) };
    }

    // singleSymbol (default)
    const sym = doc.getElementsByTagName('symbol')[0] || null;
    return { type: 'single', ...getSymbolStyle(sym) };
  } catch (e: any) {
    console.error('[QML] Parse exception:', e.message);
    return null;
  }
}

// ── Geometry type detector dari GeoJSON ─────────────────────────────────────
function detectGeometryType(geojson: any): 'polygon' | 'line' | 'point' | 'unknown' {
  const features = geojson?.features || (geojson?.type === 'Feature' ? [geojson] : []);
  if (!features.length) return 'unknown';

  const type: string = features[0]?.geometry?.type || '';
  if (type.includes('Polygon')) return 'polygon';
  if (type.includes('Line') || type.includes('String')) return 'line';
  if (type.includes('Point')) return 'point';

  // Coba dari semua fitur
  for (const f of features.slice(0, 10)) {
    const t: string = f?.geometry?.type || '';
    if (t.includes('Polygon')) return 'polygon';
    if (t.includes('Line') || t.includes('String')) return 'line';
    if (t.includes('Point')) return 'point';
  }
  return 'unknown';
}

// ── Normalize base path (hapus folder prefix, ambil nama file saja) ──────────
function getBaseName(filePath: string): string {
  // Ambil hanya nama file tanpa ekstensi, tanpa folder
  return path.basename(filePath, path.extname(filePath)).toLowerCase();
}

// ── Main parse endpoint ───────────────────────────────────────────────────────
router.post('/zip', upload.single('file'), async (req: Request, res: Response) => {
  const errors: string[] = [];
  const layers: LayerInfo[] = [];

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Tidak ada file ZIP yang diunggah' });
    }

    // ── 1. Buka ZIP ──────────────────────────────────────────────────────────
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(req.file.buffer);
    } catch (e: any) {
      return res.status(400).json({ success: false, error: `ZIP rusak atau tidak valid: ${e.message}` });
    }

    // ── 2. Daftar semua file dalam ZIP ────────────────────────────────────────
    const allFiles: Record<string, JSZip.JSZipObject> = {};
    zip.forEach((relativePath, file) => {
      if (!file.dir) allFiles[relativePath] = file;
    });

    if (Object.keys(allFiles).length === 0) {
      return res.status(400).json({ success: false, error: 'ZIP kosong — tidak ada file di dalamnya' });
    }

    console.log('[GEOParse] Files in ZIP:', Object.keys(allFiles));

    // ── 3. Group file berdasarkan basename (case-insensitive) ─────────────────
    interface ShapeGroup {
      shp?: JSZip.JSZipObject;
      dbf?: JSZip.JSZipObject;
      shx?: JSZip.JSZipObject;
      prj?: JSZip.JSZipObject;
      cpg?: JSZip.JSZipObject;
      qml?: JSZip.JSZipObject;
      originalPath: string;
    }

    // groups key = lowercase basename
    const shapeGroups: Record<string, ShapeGroup> = {};
    // QML index: lowercase basename → JSZipObject (bisa cocok ke layer mana saja)
    const qmlIndex: Record<string, JSZip.JSZipObject> = {};

    const shapeExts = new Set(['shp', 'dbf', 'shx', 'prj', 'cpg']);
    const allExts = new Set([...shapeExts, 'qml']);

    for (const [filePath, fileObj] of Object.entries(allFiles)) {
      const ext = path.extname(filePath).slice(1).toLowerCase();
      if (!allExts.has(ext)) continue;

      const baseName = getBaseName(filePath);

      if (ext === 'qml') {
        qmlIndex[baseName] = fileObj;
        continue;
      }

      if (shapeExts.has(ext)) {
        if (!shapeGroups[baseName]) shapeGroups[baseName] = { originalPath: filePath };
        (shapeGroups[baseName] as any)[ext] = fileObj;
      }
    }

    console.log('[GEOParse] Shape groups found:', Object.keys(shapeGroups));
    console.log('[GEOParse] QML files found:', Object.keys(qmlIndex));

    if (Object.keys(shapeGroups).length === 0) {
      // Cek apakah ada GeoJSON
      const geojsonFiles = Object.keys(allFiles).filter(p =>
        ['.json', '.geojson'].includes(path.extname(p).toLowerCase())
      );
      if (geojsonFiles.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Tidak ada shapefile (.shp) atau GeoJSON dalam ZIP',
          detail: `File yang ditemukan: ${Object.keys(allFiles).join(', ')}`
        });
      }
    }

    // ── 4. Proses setiap grup shapefile ─────────────────────────────────────
    // Import shpjs secara dynamic
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const shpjs = require('shpjs');

    for (const [baseName, group] of Object.entries(shapeGroups)) {
      const layerId = `layer_${Date.now()}_${baseName}`;
      const layerInfo: LayerInfo = {
        id: layerId,
        name: baseName,
        featureType: 'unknown',
        featureCount: 0,
        fields: [],
        valid: false,
        errors: [],
        warnings: [],
        hasQml: false,
        supportingFiles: [group.originalPath]
      };

      // Validasi komponen wajib
      if (!group.shp) { layerInfo.errors.push('.shp tidak ditemukan'); layers.push(layerInfo); continue; }
      if (!group.dbf) layerInfo.warnings.push('.dbf tidak ditemukan — atribut tidak tersedia');
      if (!group.shx) layerInfo.warnings.push('.shx tidak ditemukan — mungkin gagal dibaca');

      // Catat file pendukung
      if (group.dbf) layerInfo.supportingFiles.push(group.dbf.name);
      if (group.shx) layerInfo.supportingFiles.push(group.shx.name);
      if (group.prj) layerInfo.supportingFiles.push(group.prj.name);

      try {
        // ── Buat mini-zip bersih untuk shpjs ──────────────────────────────
        const miniZip = new JSZip();
        const cleanName = 'layer';

        miniZip.file(`${cleanName}.shp`, await group.shp.async('nodebuffer'));
        if (group.dbf) miniZip.file(`${cleanName}.dbf`, await group.dbf.async('nodebuffer'));
        if (group.shx) miniZip.file(`${cleanName}.shx`, await group.shx.async('nodebuffer'));
        if (group.prj) miniZip.file(`${cleanName}.prj`, await group.prj.async('nodebuffer'));

        const miniZipBuf = await miniZip.generateAsync({ type: 'nodebuffer' });

        // ── Parse shapefile ke GeoJSON ─────────────────────────────────────
        let geojson: any;
        try {
          geojson = await shpjs(miniZipBuf);
        } catch (shpErr: any) {
          layerInfo.errors.push(`Gagal parse shapefile: ${shpErr.message}`);
          layers.push(layerInfo);
          continue;
        }

        // shpjs kadang balas array (multi-layer dalam 1 zip)
        if (Array.isArray(geojson)) geojson = geojson[0];

        if (!geojson || !geojson.features) {
          layerInfo.errors.push('Shapefile tidak menghasilkan GeoJSON valid');
          layers.push(layerInfo);
          continue;
        }

        layerInfo.geojson = geojson;
        layerInfo.featureType = detectGeometryType(geojson);
        layerInfo.featureCount = geojson.features.length;
        layerInfo.fields = geojson.features.length > 0
          ? Object.keys(geojson.features[0].properties || {})
          : [];
        layerInfo.valid = true;

        console.log(`[GEOParse] Layer "${baseName}": ${layerInfo.featureCount} fitur, type=${layerInfo.featureType}`);
      } catch (e: any) {
        layerInfo.errors.push(`Exception saat proses: ${e.message}`);
        layers.push(layerInfo);
        continue;
      }

      // ── 5. Cocokkan QML (fuzzy matching) ─────────────────────────────────
      // Prioritas: baseName sama persis → nama mengandung baseName → baseName pertama jika cuma 1 QML
      let qmlObj: JSZip.JSZipObject | null = null;

      if (qmlIndex[baseName]) {
        // Exact match
        qmlObj = qmlIndex[baseName];
      } else {
        // Fuzzy: cari QML yang namanya mengandung baseName (atau sebaliknya)
        for (const [qmlBase, obj] of Object.entries(qmlIndex)) {
          if (qmlBase.includes(baseName) || baseName.includes(qmlBase)) {
            qmlObj = obj;
            break;
          }
        }
        // Fallback: jika cuma 1 QML dan 1 layer, pakai saja
        if (!qmlObj && Object.keys(qmlIndex).length === 1 && Object.keys(shapeGroups).length === 1) {
          qmlObj = Object.values(qmlIndex)[0];
        }
      }

      if (qmlObj) {
        try {
          const qmlText = await qmlObj.async('text');
          const qmlStyle = parseQMLXml(qmlText);
          if (qmlStyle) {
            layerInfo.hasQml = true;
            layerInfo.qmlStyle = qmlStyle;
            layerInfo.supportingFiles.push(qmlObj.name);
            console.log(`[GEOParse] QML applied to "${baseName}":`, qmlStyle.type, qmlStyle.fillColor);
          } else {
            layerInfo.warnings.push('QML ditemukan tapi gagal di-parse');
          }
        } catch (qmlErr: any) {
          layerInfo.warnings.push(`Gagal baca QML: ${qmlErr.message}`);
        }
      }

      layers.push(layerInfo);
    }

    // ── 6. Proses GeoJSON langsung jika tidak ada shapefile ───────────────────
    if (layers.length === 0) {
      for (const [filePath, fileObj] of Object.entries(allFiles)) {
        const ext = path.extname(filePath).toLowerCase();
        if (!['.json', '.geojson'].includes(ext)) continue;

        try {
          const text = await fileObj.async('text');
          const geojson = JSON.parse(text);
          const baseName = getBaseName(filePath);

          layers.push({
            id: `layer_${Date.now()}_${baseName}`,
            name: baseName,
            featureType: detectGeometryType(geojson),
            featureCount: geojson.features?.length || 0,
            fields: geojson.features?.[0] ? Object.keys(geojson.features[0].properties || {}) : [],
            valid: true,
            errors: [],
            warnings: [],
            hasQml: false,
            supportingFiles: [filePath],
            geojson
          });
        } catch (e: any) {
          errors.push(`Gagal baca ${filePath}: ${e.message}`);
        }
      }
    }

    // ── 7. Summary ────────────────────────────────────────────────────────────
    const validCount = layers.filter(l => l.valid).length;
    const invalidCount = layers.filter(l => !l.valid).length;

    console.log(`[GEOParse] Done: ${validCount} valid, ${invalidCount} invalid`);

    return res.json({
      success: true,
      summary: {
        totalFiles: Object.keys(allFiles).length,
        layersFound: layers.length,
        validLayers: validCount,
        invalidLayers: invalidCount
      },
      layers,
      errors
    });

  } catch (e: any) {
    console.error('[GEOParse] Fatal error:', e);
    return res.status(500).json({ success: false, error: `Server error: ${e.message}` });
  }
});

export { router as geoparseRouter };
