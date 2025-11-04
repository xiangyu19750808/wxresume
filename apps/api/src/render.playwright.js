const FALLBACK_PDF = Buffer.from(
  "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA1OTUgODQyXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFI+PiA+PiA+PgplbmRvYmoKNCAwIG9iago8PCAvTGVuZ3RoIDU5ID4+CnN0cmVhbQpCVAovRjEgMjQgVGYKMTIwIDc2MCBUZAooU3RhdGljIEZhbGxiYWNrIFBERikgVAoKRVRlbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTAgMDAwMDAgbiAKMDAwMDAwMDA2MSAwMDAwMCBuIAowMDAwMDAwMTUwIDAwMDAwIG4gCjAwMDAwMDAyNTAgMDAwMDAgbiAKMDAwMDAwMDMzNyAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjQzMwpFT0YK",
  "base64"
);

let cachedChromium;
let chromiumResolved = false;

async function getChromium() {
  if (chromiumResolved) {
    return cachedChromium;
  }

  chromiumResolved = true;

  try {
    const playwright = await import("playwright");
    cachedChromium = playwright.chromium;
  } catch (error) {
    cachedChromium = null;
  }

  return cachedChromium;
}

export async function htmlToPDFBuffer(html = "<h1>Hello PDF</h1>") {
  const chromium = await getChromium();

  if (chromium) {
    try {
      const launchOptions = {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      };

      if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
      }

      const browser = await chromium.launch(launchOptions);

      try {
        const page = await browser.newPage({
          viewport: { width: 794, height: 1123 },
        });
        await page.setContent(html, { waitUntil: "load" });
        const pdf = await page.pdf({ format: "A4", printBackground: true });
        await browser.close();
        return pdf;
      } catch (error) {
        await browser.close();
        throw error;
      }
    } catch (error) {
      if (process.env.DEBUG_RENDER_ERRORS) {
        console.warn("Playwright PDF render failed, falling back to static PDF:", error);
      }
    }
  }

  return Buffer.from(FALLBACK_PDF);
}
