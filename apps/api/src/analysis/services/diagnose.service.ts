export interface DiagnoseResult {
  scores: number[];
  anxietyCopy: string;
  radar: any;
}

export class DiagnoseService {
  async diagnose(resumeText: string, jdText: string): Promise<DiagnoseResult> {
    // Fast nine-dimension scoring entry point
    return {
      scores: [],
      anxietyCopy: '',
      radar: {},
    };
  }
}
