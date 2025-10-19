#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.join(__dirname, 'fonts');
const CSS_ENDPOINT = 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;600&display=swap';

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(fetchText(res.headers.location));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Request failed: ${url} (status ${res.statusCode})`));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      })
      .on('error', reject);
  });
}

function fetchBinary(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(fetchBinary(res.headers.location));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Request failed: ${url} (status ${res.statusCode})`));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

function extractFontFaces(cssText) {
  const faces = [];
  const faceRegex = /@font-face\s*{[^}]+}/g;
  const matches = cssText.match(faceRegex) || [];
  for (const block of matches) {
    const weightMatch = block.match(/font-weight:\s*(\d+)/);
    const urlMatch = block.match(/url\(([^)]+)\)/);
    if (!urlMatch) continue;
    const url = urlMatch[1].replace(/["']/g, '').trim();
    const weight = weightMatch ? Number(weightMatch[1]) : 400;
    faces.push({ weight, url });
  }
  return faces;
}

async function main() {
  if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
  }

  console.log('[fonts] Fetching CSS manifest...');
  const css = await fetchText(CSS_ENDPOINT);
  const faces = extractFontFaces(css);
  if (!faces.length) {
    console.error('[fonts] No font definitions found. CSS response was:\n', css);
    process.exit(1);
  }

  for (const face of faces) {
    const filename = face.weight >= 600 ? 'NotoSansSC-SemiBold.woff2' : 'NotoSansSC-Regular.woff2';
    const target = path.join(fontsDir, filename);
    if (fs.existsSync(target)) {
      console.log(`[fonts] Skip existing ${filename}`);
      continue;
    }
    console.log(`[fonts] Downloading ${filename} ...`);
    const buffer = await fetchBinary(face.url);
    fs.writeFileSync(target, buffer);
  }

  console.log(`[fonts] Done. Files stored in ${fontsDir}`);
}

main().catch((err) => {
  console.error('[fonts] Failed to install fonts:', err);
  process.exit(1);
});
