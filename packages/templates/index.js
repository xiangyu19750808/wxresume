import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname; // 当前文件夹即 packages/templates

export function listTemplates() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf-8"));
  return manifest.templates || [];
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
