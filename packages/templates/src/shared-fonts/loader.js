import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.join(__dirname, 'fonts');

const FALLBACK_FONT_STACK = [
  "'WXResumeFallback'",
  "'Noto Sans CJK SC'",
  "'Source Han Sans SC'",
  "'Source Han Sans CN'",
  "'Microsoft YaHei'",
  "'PingFang SC'",
  "'Heiti SC'",
  "'WenQuanYi Micro Hei'",
  'sans-serif'
];

const BUNDLED_FONTS = [
  {
    id: 'regular',
    weight: 400,
    style: 'normal',
    filename: 'NotoSansSC-Regular.woff2'
  },
  {
    id: 'bold',
    weight: 600,
    style: 'normal',
    filename: 'NotoSansSC-SemiBold.woff2'
  }
];

function resolveFontFile(filename) {
  const candidate = path.join(fontsDir, filename);
  if (fs.existsSync(candidate)) return candidate;
  return null;
}

function bufferToDataUrl(buffer) {
  if (!buffer || buffer.length === 0) return null;
  const base64 = buffer.toString('base64');
  return `data:font/woff2;base64,${base64}`;
}

function collectSystemFontHints() {
  const platform = os.platform();
  if (platform === 'win32') {
    return [
      'C:/Windows/Fonts/msyh.ttc',
      'C:/Windows/Fonts/msyh.ttf',
      'C:/Windows/Fonts/NotoSansCJKsc-Regular.otf'
    ];
  }
  if (platform === 'darwin') {
    return [
      '/System/Library/Fonts/PingFang.ttc',
      '/System/Library/Fonts/Supplemental/NotoSansCJKsc-Regular.otf'
    ];
  }
  return [
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf',
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/noto/NotoSansCJKsc-Regular.otf'
  ];
}

export function describeFontSetup() {
  const hints = collectSystemFontHints().filter((p) => fs.existsSync(p));
  const bundled = BUNDLED_FONTS.map((f) => ({ ...f, available: Boolean(resolveFontFile(f.filename)) }));
  return {
    fontsDir,
    bundled,
    systemHints: hints
  };
}

export function loadFontCSS() {
  const warnings = [];
  const fontFaces = [];

  for (const entry of BUNDLED_FONTS) {
    const filePath = resolveFontFile(entry.filename);
    const localSources = [
      "local('Microsoft YaHei')",
      "local('PingFang SC')",
      "local('Heiti SC')",
      "local('Noto Sans CJK SC')",
      "local('Source Han Sans SC')",
      "local('Source Han Sans CN')"
    ];

    if (filePath) {
      const buffer = fs.readFileSync(filePath);
      const dataUrl = bufferToDataUrl(buffer);
      if (dataUrl) {
        localSources.push(`url('${dataUrl}') format('woff2')`);
      }
    } else {
      warnings.push(
        `Missing bundled font ${entry.filename}. Install fonts via packages/templates/src/shared-fonts/install.js or copy files into ${fontsDir}.`
      );
    }

    fontFaces.push(
      `@font-face {\n  font-family: 'WXResumeFallback';\n  font-style: ${entry.style};\n  font-weight: ${entry.weight};\n  font-display: swap;\n  src: ${localSources.join(',\n       ')};\n}`
    );
  }

  return {
    css: fontFaces.join('\n\n'),
    fontFamily: FALLBACK_FONT_STACK.join(', '),
    warnings
  };
}
