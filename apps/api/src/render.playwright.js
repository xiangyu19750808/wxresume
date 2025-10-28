let cachedChromium = null;
let attemptedLoad = false;

async function loadChromium() {
  if (!attemptedLoad) {
    attemptedLoad = true;
    try {
      const mod = await import("playwright");
      cachedChromium = mod.chromium;
    } catch (err) {
      console.warn("[render.playwright] playwright not available, falling back to stub PDF:", err?.message);
    }
  }
  return cachedChromium;
}

function createStubPDFBuffer() {
  const minimalPdf = "%PDF-1.4\n% wxresume-fallback\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF";
  return Buffer.from(minimalPdf, "utf8");
}

export async function htmlToPDFBuffer(html = "<h1>Hello PDF</h1>") {
  const chromium = await loadChromium();
  if (!chromium) {
    return createStubPDFBuffer();
  }

  let browser;
  try {
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();
    return pdf;
  } catch (err) {
    console.warn("[render.playwright] failed to render PDF, returning stub buffer:", err?.message);
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.warn("[render.playwright] failed to close browser:", closeErr?.message);
      }
    }
    return createStubPDFBuffer();
  }
}
