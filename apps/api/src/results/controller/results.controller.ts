import { ResultsService } from '../service/results.service';

export class ResultsController {
  private resultsService = new ResultsService();

  async list(req, res) {
    // Placeholder for GET /v1/results
    const results = await this.resultsService.listResults(req.user?.id);
    res.json({ status: 'pending', results });
  }

  async getById(req, res) {
    // Placeholder for GET /v1/results/:rid
    const result = await this.resultsService.getResultById(req.params.rid);
    res.json({ status: 'pending', result });
  }
}
