const http = require('http');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function run() {
  // Buat shapefile polygon minimal dengan 1 fitur
  // SHP: file length = (50 + 2 + 20) words = 72 words (records section)
  // Record header: content-length in 16-bit words
  // 1 polygon record: record header (8) + shape type (4) + bbox (32) + part count (4) + point count (4) + ring offset (4) + 4 points (4*16) = 120 bytes content
  // Total: 100 (header) + 8 (rec header) + 120 (record) = 228 bytes -> file length = 228/2 = 114 words

  const shp = Buffer.alloc(228, 0);
  // File header
  shp.writeInt32BE(9994, 0);       // file code
  shp.writeInt32BE(114, 24);       // file length (16-bit words)
  shp.writeInt32LE(1000, 28);      // version
  shp.writeInt32LE(5, 32);         // shape type: 5 = polygon
  shp.writeDoubleLE(0, 36);        // bbox minX
  shp.writeDoubleLE(0, 44);        // bbox minY
  shp.writeDoubleLE(1, 52);        // bbox maxX
  shp.writeDoubleLE(1, 60);        // bbox maxY

  // Record 1 header (big-endian)
  shp.writeInt32BE(1, 100);        // record number (1-based)
  shp.writeInt32BE(60, 104);       // content length in words (120 bytes / 2 = 60)

  // Record 1 content
  shp.writeInt32LE(5, 108);        // shape type: 5 = polygon
  shp.writeDoubleLE(0, 112);       // bbox minX
  shp.writeDoubleLE(0, 120);       // bbox minY
  shp.writeDoubleLE(1, 128);       // bbox maxX
  shp.writeDoubleLE(1, 136);       // bbox maxY
  shp.writeInt32LE(1, 144);        // num parts = 1
  shp.writeInt32LE(4, 148);        // num points = 4
  shp.writeInt32LE(0, 152);        // parts[0] = 0

  // 4 points (ring): (0,0), (1,0), (1,1), (0,0) - exterior ring
  shp.writeDoubleLE(0, 156); shp.writeDoubleLE(0, 164); // (0,0)
  shp.writeDoubleLE(1, 172); shp.writeDoubleLE(0, 180); // (1,0)
  shp.writeDoubleLE(1, 188); shp.writeDoubleLE(1, 196); // (1,1)
  shp.writeDoubleLE(0, 204); shp.writeDoubleLE(0, 212); // (0,0) close

  // SHX (100 header + 8 per record = 108 bytes = 54 words)
  const shx = Buffer.alloc(108, 0);
  shx.writeInt32BE(9994, 0);
  shx.writeInt32BE(54, 24);
  shx.writeInt32LE(1000, 28);
  shx.writeInt32LE(5, 32);
  shx.writeInt32BE(50, 100);  // offset of record 1 in 16-bit words (100/2=50)
  shx.writeInt32BE(60, 104);  // content length of record 1

  // DBF minimal: 1 record, 1 field "NAMA" (character, length 20)
  // Header: 32 bytes
  // Field descriptor: 32 bytes per field
  // Header terminator: 1 byte (0x0D)
  // Record: 1 byte (space = not deleted) + 20 bytes field = 21 bytes
  const dbf = Buffer.alloc(32 + 32 + 1 + 1 + 20, 0x20); // fill with spaces
  dbf.writeUInt8(3, 0);            // version
  dbf.writeUInt8(26, 1); dbf.writeUInt8(4, 2); dbf.writeUInt8(23, 3); // date
  dbf.writeInt32LE(1, 4);          // num records = 1
  dbf.writeInt16LE(65, 8);         // header bytes = 32 + 32 + 1 = 65
  dbf.writeInt16LE(21, 10);        // record bytes = 1 + 20 = 21
  // Field: NAMA
  dbf.write('NAMA', 32, 'ascii');
  dbf[36+11] = 67;                 // field type: C (character)
  dbf[36+16] = 20;                 // field length: 20
  dbf[64] = 0x0D;                  // header terminator
  // Record 1: deletion flag + value
  dbf[65] = 0x20;                  // not deleted
  dbf.write('Jalan Raya'.padEnd(20), 66, 'ascii');

  // QML for this layer
  const qml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE qgis PUBLIC 'http://mrcc.com/qgis.dtd' 'SYSTEM'>
<qgis version="3.22.0">
  <renderer-v2 type="singleSymbol">
    <symbols>
      <symbol name="0" type="fill" alpha="0.8">
        <layer class="SimpleFill">
          <prop k="color" v="52,152,219,204"/>
          <prop k="outline_color" v="23,93,145,255"/>
          <prop k="outline_width" v="0.5"/>
        </layer>
      </symbol>
    </symbols>
  </renderer-v2>
</qgis>`;

  // Buat ZIP dengan layer + QML
  const zip = new JSZip();
  zip.file('jalan.shp', shp);
  zip.file('jalan.shx', shx);
  zip.file('jalan.dbf', dbf);
  zip.file('jalan.qml', qml);

  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync('test_layer_qml.zip', buf);
  console.log('ZIP created:', buf.length, 'bytes');

  // Test endpoint
  const boundary = 'boundary_' + Date.now();
  const CRLF = '\r\n';
  const body = Buffer.concat([
    Buffer.from('--' + boundary + CRLF),
    Buffer.from('Content-Disposition: form-data; name="file"; filename="test_layer_qml.zip"' + CRLF),
    Buffer.from('Content-Type: application/zip' + CRLF + CRLF),
    buf,
    Buffer.from(CRLF + '--' + boundary + '--' + CRLF)
  ]);

  const options = {
    hostname: 'localhost', port: 3001, path: '/api/geoparse/zip', method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
      'Content-Length': body.length
    }
  };

  const req = http.request(options, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const parsed = JSON.parse(data);
      console.log('\n=== GEOPARSE RESULT ===');
      console.log('Status:', res.statusCode);
      console.log('Success:', parsed.success);
      console.log('Summary:', JSON.stringify(parsed.summary));
      if (parsed.layers) {
        parsed.layers.forEach(l => {
          console.log('\nLayer:', l.name);
          console.log('  type:', l.featureType);
          console.log('  valid:', l.valid);
          console.log('  features:', l.featureCount);
          console.log('  fields:', l.fields);
          console.log('  hasQml:', l.hasQml);
          if (l.hasQml) console.log('  qmlStyle:', JSON.stringify(l.qmlStyle));
          if (l.errors.length) console.log('  ERRORS:', l.errors);
          if (l.warnings.length) console.log('  WARNINGS:', l.warnings);
        });
      }
      if (parsed.error) console.log('Error:', parsed.error);
    });
  });
  req.on('error', e => console.log('REQ ERROR:', e.message));
  req.write(body);
  req.end();
}

run().catch(console.error);
