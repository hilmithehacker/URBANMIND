const fs = require('fs');
const JSZip = require('jszip');
// Since shpjs is primarily a browser library, we might need a workaround for Node,
// but let's try to just use it if installed, or just simulate the parsing logic.
const shp = require('shpjs');

async function test() {
  const buf = fs.readFileSync('e:/TA BISMILLAH/URBANMIND/backend/uploads/general/53d4ca66-951c-46af-89a9-2a39fa0da731.zip');
  const zip = await JSZip.loadAsync(buf);
  
  const fileMap = {};
  Object.keys(zip.files).forEach(p => { if (!zip.files[p].dir) fileMap[p] = zip.files[p] });
  
  const groups = {};
  Object.entries(fileMap).forEach(([p, obj]) => {
    const ext = p.split('.').pop().toLowerCase();
    const base = p.replace(/\.[^/.]+$/, '');
    if (['shp','dbf','shx','prj','qml'].includes(ext || '')) {
      if (!groups[base]) groups[base] = {};
      groups[base][ext] = obj;
    }
  });

  console.log("Groups found:", Object.keys(groups));

  for (const [base, components] of Object.entries(groups)) {
    if (!components.shp) continue;
    console.log(`Processing: ${base}`);
    try {
      // JSZip returns ArrayBuffer for browser, but in Node it's NodeBuffer. arraybuffer works.
      const shpBuf = await components.shp.async('arraybuffer');
      const dbfBuf = components.dbf ? await components.dbf.async('arraybuffer') : undefined;
      
      console.log("SHP buf size:", shpBuf.byteLength);
      if (dbfBuf) console.log("DBF buf size:", dbfBuf.byteLength);

      let gj;
      if (dbfBuf) {
        const parsedShp = shp.parseShp(shpBuf);
        console.log("Parsed SHP feature count:", parsedShp.length);
        const parsedDbf = shp.parseDbf(dbfBuf);
        console.log("Parsed DBF feature count:", parsedDbf.length);
        gj = shp.combine([parsedShp, parsedDbf]);
      } else {
        gj = shp.parseShp(shpBuf);
      }
      console.log(`Success: ${base}, features: ${gj.features ? gj.features.length : 'unknown'}`);
    } catch (err) {
      console.error(`Gagal parse ${base}:`, err);
    }
  }
}

test();
