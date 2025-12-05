export interface ExportResult {
  fileId: string | null;
  url: string | null;
}

export class ExportService {
  async exportToPdf(resumeText: string): Promise<ExportResult> {
    // Call /v1/render/pdf then upload to COS
    return { fileId: null, url: null };
  }
}
