export class ExportController {
  async handleExport(req, res) {
    res.json({ status: 'pending', fileId: null, url: null });
  }
}
