export class CosFakeAdapter {
  constructor(opts = { publicBase: "", localDir: "" }) {
    this.publicBase = opts.publicBase;
    this.localDir = opts.localDir;
  }
  async putObject() { return { etag: "fake-etag" }; }
  async getSignedUrl({ key, expiresInSec }) {
    const exp = Math.floor(Date.now() / 1000) + (expiresInSec || 180);
    return `${this.publicBase}/${encodeURIComponent(key)}?exp=${exp}`;
  }
  async headObject() { return { exists: true, size: 0, contentType: "application/octet-stream" }; }
}
