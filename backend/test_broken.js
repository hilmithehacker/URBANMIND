const http = require('http');
const boundary = 'b_' + Date.now();
const CRLF = '\r\n';
const fakeZip = Buffer.from('THIS IS NOT A ZIP FILE AT ALL');
const body = Buffer.concat([
  Buffer.from('--' + boundary + CRLF),
  Buffer.from('Content-Disposition: form-data; name="file"; filename="broken.zip"' + CRLF),
  Buffer.from('Content-Type: application/zip' + CRLF + CRLF),
  fakeZip,
  Buffer.from(CRLF + '--' + boundary + '--' + CRLF)
]);
const req = http.request({
  hostname: 'localhost', port: 3001, path: '/api/geoparse/zip', method: 'POST',
  headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary, 'Content-Length': body.length }
}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const r = JSON.parse(d);
    console.log('=== BROKEN ZIP TEST ===');
    console.log('Status:', res.statusCode);
    console.log('Success:', r.success);
    console.log('Error:', r.error || '-');
  });
});
req.on('error', e => console.log('ERR:', e.message));
req.write(body);
req.end();
