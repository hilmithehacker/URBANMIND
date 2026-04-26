// Test multi-layer ZIP (2 shapefiles: polygon + point, 1 QML untuk polygon, 1 QML untuk point)
const http = require('http');
const fs = require('fs');
const JSZip = require('jszip');

async function makeMinimalShp(shapeType, numFeatures) {
  // Shape types: 1=Point, 5=Polygon, 3=Polyline
  // Buat SHP minimal dengan 0 atau 1 record
  const shp = Buffer.alloc(100, 0);
  shp.writeInt32BE(9994, 0);
  shp.writeInt32BE(50, 24);     // file length (empty, 100 bytes = 50 words)
  shp.writeInt32LE(1000, 28);
  shp.writeInt32LE(shapeType, 32);
  shp.writeDoubleLE(0, 36); shp.writeDoubleLE(0, 44);
  shp.writeDoubleLE(1, 52); shp.writeDoubleLE(1, 60);

  const shx = Buffer.alloc(100, 0);
  shx.writeInt32BE(9994, 0);
  shx.writeInt32BE(50, 24);
  shx.writeInt32LE(1000, 28);
  shx.writeInt32LE(shapeType, 32);

  // DBF: 0 records, 1 field "NAME"
  const dbf = Buffer.alloc(32 + 32 + 1, 0);
  dbf.writeUInt8(3, 0);
  dbf.writeInt32LE(0, 4);          // num records = 0
  dbf.writeInt16LE(65, 8);         // header size = 32 + 32 + 1
  dbf.writeInt16LE(11, 10);        // record size = 1 + 10
  dbf.write('NAME', 32, 'ascii');
  dbf[32+11] = 67;                 // C = Character
  dbf[32+16] = 10;                 // length
  dbf[64] = 0x0D;                  // header terminator

  return { shp, shx, dbf };
}

async function run() {
  const polygon = await makeMinimalShp(5, 0);  // polygon
  const point = await makeMinimalShp(1, 0);    // point
  const line = await makeMinimalShp(3, 0);     // polyline

  // QML untuk bangunan (polygon)
  const qmlBangunan = `<?xml version="1.0" encoding="UTF-8"?>
<qgis version="3.22.0">
  <renderer-v2 type="singleSymbol">
    <symbols>
      <symbol name="0" type="fill" alpha="0.9">
        <layer class="SimpleFill">
          <prop k="color" v="231,76,60,230"/>
          <prop k="outline_color" v="120,20,10,255"/>
          <prop k="outline_width" v="0.3"/>
        </layer>
      </symbol>
    </symbols>
  </renderer-v2>
</qgis>`;

  // QML untuk fasilitas (point) - categorized
  const qmlFasilitas = `<?xml version="1.0" encoding="UTF-8"?>
<qgis version="3.22.0">
  <renderer-v2 type="categorizedSymbol" attr="NAME">
    <categories>
      <category value="Sekolah" symbol="0" label="Sekolah"/>
      <category value="Rumah Sakit" symbol="1" label="Rumah Sakit"/>
    </categories>
    <symbols>
      <symbol name="0" type="marker" alpha="1">
        <layer class="SimpleMarker">
          <prop k="color" v="46,204,113,255"/>
          <prop k="outline_color" v="27,120,66,255"/>
          <prop k="size" v="3"/>
        </layer>
      </symbol>
      <symbol name="1" type="marker" alpha="1">
        <layer class="SimpleMarker">
          <prop k="color" v="241,196,15,255"/>
          <prop k="outline_color" v="150,120,5,255"/>
          <prop k="size" v="4"/>
        </layer>
      </symbol>
    </symbols>
  </renderer-v2>
</qgis>`;

  // ZIP: 3 layer + 2 QML, dalam folder berbeda
  const zip = new JSZip();
  // Layer 1: bangunan (polygon), di subfolder
  zip.file('data/bangunan.shp', polygon.shp);
  zip.file('data/bangunan.shx', polygon.shx);
  zip.file('data/bangunan.dbf', polygon.dbf);
  zip.file('data/bangunan.qml', qmlBangunan);

  // Layer 2: fasilitas (point), di subfolder berbeda
  zip.file('layers/fasilitas.shp', point.shp);
  zip.file('layers/fasilitas.shx', point.shx);
  zip.file('layers/fasilitas.dbf', point.dbf);
  zip.file('layers/fasilitas.qml', qmlFasilitas);

  // Layer 3: jalan (line), di root, TANPA QML
  zip.file('jalan.shp', line.shp);
  zip.file('jalan.shx', line.shx);
  zip.file('jalan.dbf', line.dbf);

  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync('test_multilayer.zip', buf);
  console.log('Multi-layer ZIP created:', buf.length, 'bytes');

  const boundary = 'boundary_' + Date.now();
  const CRLF = '\r\n';
  const body = Buffer.concat([
    Buffer.from('--' + boundary + CRLF),
    Buffer.from('Content-Disposition: form-data; name="file"; filename="test_multilayer.zip"' + CRLF),
    Buffer.from('Content-Type: application/zip' + CRLF + CRLF),
    buf,
    Buffer.from(CRLF + '--' + boundary + '--' + CRLF)
  ]);

  const req = http.request({
    hostname: 'localhost', port: 3001, path: '/api/geoparse/zip', method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary, 'Content-Length': body.length }
  }, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      const r = JSON.parse(data);
      console.log('\n=== MULTI-LAYER TEST ===');
      console.log('Success:', r.success);
      console.log('Summary:', JSON.stringify(r.summary));
      console.log('');
      if (r.layers) r.layers.forEach(l => {
        console.log(`[${l.valid ? 'OK' : 'FAIL'}] ${l.name.padEnd(15)} type=${l.featureType.padEnd(8)} hasQml=${l.hasQml} features=${l.featureCount}`);
        if (l.hasQml) console.log(`         qml.type=${l.qmlStyle.type} fill=${l.qmlStyle.fillColor || '-'} colorField=${l.qmlStyle.field || '-'}`);
        if (l.errors.length) console.log(`         ERRORS:`, l.errors);
      });
    });
  });
  req.on('error', e => console.log('ERR:', e.message));
  req.write(body);
  req.end();
}

run().catch(console.error);
