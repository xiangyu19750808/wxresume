import { renderClassic, metadata as classicMeta } from './classic/index.js';
import { renderModern, metadata as modernMeta } from './modern/index.js';
import { loadFontCSS, describeFontSetup } from './shared-fonts/loader.js';
import { pickResume } from './shared/utils.js';

const TEMPLATE_REGISTRY = {
  classic: { ...classicMeta, render: renderClassic },
  modern: { ...modernMeta, render: renderModern }
};

export function listTemplates() {
  return Object.values(TEMPLATE_REGISTRY).map(({ id, name, description }) => ({ id, name, description }));
}

export function getTemplate(templateId = 'classic') {
  const id = templateId || 'classic';
  const template = TEMPLATE_REGISTRY[id];
  if (!template) {
    const available = Object.keys(TEMPLATE_REGISTRY).join(', ');
    throw new Error(`Unknown template '${templateId}'. Available templates: ${available}`);
  }
  return template;
}

function buildDocument({ title, styles, body }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
${styles}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

export async function render(data = {}, options = {}) {
  const templateId = options.templateId || 'classic';
  const template = getTemplate(templateId);
  const resume = pickResume(data);
  const { css: fontCSS, fontFamily, warnings: fontWarnings } = loadFontCSS();

  const { html: bodyHtml, css: templateCss, metadata } = template.render(resume, {
    templateId,
    fontFamily,
    options
  });

  const combinedCss = [fontCSS, templateCss].filter(Boolean).join('\n\n');
  const title = `${resume?.basics?.name ? `${resume.basics.name} · ` : ''}${template.name}`;
  const html = buildDocument({ title, styles: combinedCss, body: bodyHtml });

  return {
    html,
    metadata: {
      templateId,
      ...metadata,
      templateName: template.name,
      fontWarnings: fontWarnings || []
    }
  };
}

export { describeFontSetup };
