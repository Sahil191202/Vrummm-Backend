import https from 'https';
import crypto from 'crypto';
import { readFileSync } from 'fs';

// Load .env manually
const env = readFileSync('.env', 'utf8');
const vars = {};
for (const line of env.split('\n')) {
  const [k, ...v] = line.split('=');
  if (k && !k.startsWith('#')) vars[k.trim()] = v.join('=').trim();
}

const cloudName = vars.CLOUDINARY_CLOUD_NAME;
const apiKey = vars.CLOUDINARY_API_KEY;
const apiSecret = vars.CLOUDINARY_API_SECRET;

console.log('cloud_name :', cloudName);
console.log('api_key    :', apiKey, '| length:', apiKey?.length);
console.log('api_secret : [hidden] | length:', apiSecret?.length);

const timestamp = Math.floor(Date.now() / 1000);
const toSign = `timestamp=${timestamp}${apiSecret}`;
const signature = crypto.createHash('sha1').update(toSign).digest('hex');

const boundary = 'FormBoundary123456';
const CRLF = '\r\n';
const body = [
  `--${boundary}`,
  'Content-Disposition: form-data; name="file"',
  '',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=',
  `--${boundary}`,
  'Content-Disposition: form-data; name="api_key"',
  '',
  apiKey,
  `--${boundary}`,
  'Content-Disposition: form-data; name="timestamp"',
  '',
  String(timestamp),
  `--${boundary}`,
  'Content-Disposition: form-data; name="signature"',
  '',
  signature,
  `--${boundary}--`,
].join(CRLF);

const bodyBuf = Buffer.from(body);

const options = {
  hostname: 'api.cloudinary.com',
  path: `/v1_1/${cloudName}/image/upload`,
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': bodyBuf.length,
  },
};

console.log('\nPosting to:', `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => {
    console.log('\nSTATUS:', res.statusCode);
    try {
      console.log('RESPONSE:', JSON.stringify(JSON.parse(data), null, 2));
    } catch {
      console.log('RESPONSE (raw):', data);
    }
  });
});

req.on('error', (e) => console.error('REQUEST ERROR:', e.message));
req.write(bodyBuf);
req.end();