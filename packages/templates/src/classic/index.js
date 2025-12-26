import { escapeHtml, joinSafe, ensureArray, formatDateRange, pickResume } from '../shared/utils.js';

export const metadata = {
  id: 'classic',
  name: 'Classic 简洁版',
  description: '单栏结构，突出关键信息的稳妥排版'
};

function renderWorkSection(work = []) {
  if (!work.length) {
    return '<p class="muted">暂无工作经历</p>';
  }
  return work
    .map((item) => {
      const role = escapeHtml(item.position || item.name || '');
      const company = escapeHtml(item.name || '');
      const highlights = ensureArray(item.highlights)
        .map((h) => `<li>${escapeHtml(h)}</li>`)
        .join('');
      const dateRange = formatDateRange({ startDate: item.startDate, endDate: item.endDate });
      return `
      <article>
        <header>
          <div>
            <strong>${role || '角色未填'}</strong>
            ${company ? `<span class="muted"> @ ${company}</span>` : ''}
          </div>
          ${dateRange ? `<span class="muted">${dateRange}</span>` : ''}
        </header>
        ${highlights ? `<ul>${highlights}</ul>` : ''}
      </article>
    `;
    })
    .join('\n');
}

function renderEducationSection(education = []) {
  if (!education.length) {
    return '<p class="muted">暂无教育经历</p>';
  }
  return education
    .map((item) => {
      const institution = escapeHtml(item.institution || '学校未填');
      const area = escapeHtml(item.area || '专业未填');
      const studyType = escapeHtml(item.studyType || '');
      const dateRange = formatDateRange({ startDate: item.startDate, endDate: item.endDate });
      return `
      <article>
        <header>
          <div>
            <strong>${institution}</strong>
            ${studyType ? `<span class="muted"> · ${studyType}</span>` : ''}
          </div>
          ${dateRange ? `<span class="muted">${dateRange}</span>` : ''}
        </header>
        <p>${area}</p>
      </article>
    `;
    })
    .join('\n');
}

function renderProjects(projects = []) {
  if (!projects.length) {
    return '';
  }
  return `
    <section>
      <h2>项目经历</h2>
      ${projects
        .map((project) => {
          const name = escapeHtml(project.name || '项目名称未填');
          const description = escapeHtml(project.description || '');
          const highlights = ensureArray(project.highlights)
            .map((h) => `<li>${escapeHtml(h)}</li>`)
            .join('');
          return `
            <article>
              <header>
                <strong>${name}</strong>
                ${project.url ? `<a class="muted" href="${escapeHtml(project.url)}">${escapeHtml(project.url)}</a>` : ''}
              </header>
              ${description ? `<p>${description}</p>` : ''}
              ${highlights ? `<ul>${highlights}</ul>` : ''}
            </article>
          `;
        })
        .join('\n')}
    </section>
  `;
}

export function renderClassic(data = {}, ctx = {}) {
  const resume = pickResume(data);
  const basics = resume.basics || {};
  const name = escapeHtml(basics.name || '未命名');
  const label = escapeHtml(basics.label || '');
  const email = escapeHtml(basics.email || '');
  const phone = escapeHtml(basics.phone || '');
  const location = basics.location ? joinSafe([basics.location.city, basics.location.region]) : '';
  const summary = escapeHtml(basics.summary || '');

  const skills = ensureArray(resume.skills).map((skill) => {
    const keywords = joinSafe(ensureArray(skill.keywords));
    return `<li><strong>${escapeHtml(skill.name || '')}</strong>${keywords ? `<span class="muted"> · ${keywords}</span>` : ''}</li>`;
  });

  const html = `
    <main class="page classic">
      <header class="hero">
        <div>
          <h1>${name}</h1>
          ${label ? `<p class="subtitle">${label}</p>` : ''}
        </div>
        <ul class="meta">
          ${email ? `<li>${email}</li>` : ''}
          ${phone ? `<li>${phone}</li>` : ''}
          ${location ? `<li>${location}</li>` : ''}
        </ul>
      </header>
      ${summary ? `<section><h2>个人简介</h2><p>${summary}</p></section>` : ''}
      <section>
        <h2>技能特长</h2>
        ${skills.length ? `<ul class="plain">${skills.join('')}</ul>` : '<p class="muted">暂无技能标签</p>'}
      </section>
      <section>
        <h2>工作经历</h2>
        ${renderWorkSection(ensureArray(resume.work))}
      </section>
      <section>
        <h2>教育背景</h2>
        ${renderEducationSection(ensureArray(resume.education))}
      </section>
      ${renderProjects(ensureArray(resume.projects))}
    </main>
  `;

  const css = `
    body {
      margin: 0;
      padding: 0;
      font-size: 14px;
      line-height: 1.6;
      color: #1f2937;
      background: #fff;
      /* 🎯 重点：将 Noto Sans CJK SC 置于首位，确保 Linux 渲染中文 */
      font-family: "Noto Sans CJK SC", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .page {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
      padding: 40px 48px;
    }
    h1 {
      font-size: 28px;
      margin: 0;
      letter-spacing: 0.02em;
    }
    h2 {
      font-size: 16px;
      margin: 24px 0 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #0f172a;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 4px;
    }
    p {
      margin: 0 0 8px;
    }
    ul {
      margin: 0 0 8px 20px;
      padding: 0;
    }
    ul.plain {
      margin-left: 0;
      list-style: none;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 4px 12px;
      padding: 0;
    }
    .hero {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 16px;
    }
    .subtitle {
      margin: 4px 0 0;
      font-size: 16px;
      color: #334155;
    }
    .meta {
      list-style: none;
      padding: 0;
      margin: 0;
      font-size: 12px;
      color: #475569;
      text-align: right;
    }
    section article {
      margin-bottom: 16px;
    }
    section article header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      font-size: 14px;
      font-weight: 600;
      color: #111827;
    }
    .muted {
      color: #64748b;
      font-weight: 400;
    }
  `;

  return {
    html,
    css,
    metadata
  };
}