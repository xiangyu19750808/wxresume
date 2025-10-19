import {
  render as renderTemplatePackage,
  listTemplates,
  describeFontSetup
} from '../../../packages/templates/src/index.js';

export async function renderResumeHTML(resume = {}, templateId = 'classic') {
  const { html, metadata } = await renderTemplatePackage(resume, { templateId });
  return { html, metadata };
}

export { listTemplates, describeFontSetup };
