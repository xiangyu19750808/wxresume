export class JdParser {
  parse(jdText: string): any {
    // Extract requirements, responsibilities, and metadata from JD text
    return { requirements: [], responsibilities: [], raw: jdText };
  }
}
