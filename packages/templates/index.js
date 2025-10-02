import fs from "fs";
import path from "path";
const root = path.resolve(process.cwd(), "packages/templates");

export function listTemplates() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json")));
  return manifest.templates;
}

export async function validateResume(data) {
  if (!data || !data.basics) throw new Error("Invalid resume");
  return true;
}

export async function renderPDF({ templateId, resume }) {
  await validateResume(resume);
  const content = `PDF<${templateId}> - ${resume?.basics?.name || "NoName"}`;
  return Buffer.from(content);
}
