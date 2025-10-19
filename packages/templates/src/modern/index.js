import { escapeHtml, ensureArray, pickResume } from '../shared/utils.js';

export const metadata = {
  id: 'modern',
  name: 'Modern 双栏版',
  description: '双色信息块，强调技能与成果'
};

function renderList(items = [], emptyText = '暂无内容', mapper = (value) => `<li>${escapeHtml(value)}</li>`) {
  if (!items.length) return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  return `<ul>${items.map((item) => mapper(item)).join('')}</ul>`;
}

function renderExperience(experiences = []) {
  if (!experiences.length) {
    return '<p class="muted">暂无经历</p>';
  }
  return experiences
    .map((exp) => {
      const company = escapeHtml(exp.name || '公司未填');
      const position = escapeHtml(exp.position || '角色未填');
      const highlights = ensureArray(exp.highlights)
        .map((h) => `<li>${escapeHtml(h)}</li>`)
        .join('');
      const period = [exp.startDate, exp.endDate || '至今']
        .filter(Boolean)
        .map((v) => escapeHtml(v))
        .join(' - ');
      return `
        <article>
          <header>
            <div>
              <strong>${position}</strong>
              <span class="muted">${company}</span>
            </div>
            ${period ? `<span class="muted">${period}</span>` : ''}
          </header>
          ${highlights ? `<ul>${highlights}</ul>` : ''}
        </article>
      `;
    })
    .join('\n');
}

export function renderModern(data = {}, ctx = {}) {
  const resume = pickResume(data);
  const basics = resume.basics || {};
  const name = escapeHtml(basics.name || '匿名候选人');
  const title = escapeHtml(basics.label || '');
  const summary = escapeHtml(basics.summary || '');
  const contact = [basics.email, basics.phone, basics.website]
    .filter((v) => v)
    .map((value) => `<li>${escapeHtml(value)}</li>`)
    .join('');

  const languages = ensureArray(resume.languages).map((lang) => {
    const language = escapeHtml(lang.language || '语言未填');
    const fluency = escapeHtml(lang.fluency || '');
    return `<li><strong>${language}</strong>${fluency ? `<span class="muted"> · ${fluency}</span>` : ''}</li>`;
  });

  const interests = ensureArray(resume.interests).map((interest) => escapeHtml(interest.name || interest));

  const css = `
    body {
      margin: 0;
      background: linear-gradient(120deg, #ecfeff 0%, #f8fafc 60%, #eef2ff 100%);
      font-size: 14px;
      line-height: 1.6;
      color: #1e293b;
      font-family: ${ctx.fontFamily || "'WXResumeFallback', 'Noto Sans CJK SC', 'Source Han Sans SC', sans-serif"};
    }
    .sheet {
      max-width: 960px;
      margin: 32px auto;
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 32px;
      background: #ffffff;
      box-shadow: 0 25px 45px rgba(30, 64, 175, 0.15);
      border-radius: 24px;
      overflow: hidden;
    }
    aside {
      background: linear-gradient(180deg, #1e40af, #1d4ed8);
      color: #f8fafc;
      padding: 32px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    aside h2 {
      font-size: 16px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin: 0 0 8px;
    }
    aside ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    aside li + li {
      margin-top: 6px;
    }
    main {
      padding: 40px 48px;
      display: flex;
      flex-direction: column;
      gap: 32px;
    }
    header.hero {
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 24px;
    }
    header.hero h1 {
      font-size: 32px;
      margin: 0;
      color: #1d4ed8;
    }
    header.hero p {
      margin: 8px 0 0;
      font-size: 16px;
      color: #475569;
    }
    section h2 {
      margin: 0 0 12px;
      font-size: 18px;
      color: #1e293b;
      letter-spacing: 0.05em;
    }
    section article {
      background: #f8fafc;
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.2);
      margin-bottom: 16px;
    }
    section article header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 8px;
    }
    section article ul {
      margin: 0 0 0 18px;
    }
    .tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 0;
      margin: 0;
      list-style: none;
    }
    .tag-list li {
      background: rgba(59, 130, 246, 0.12);
      color: #1d4ed8;
      padding: 4px 10px;
      border-radius: 999px;
      font-weight: 600;
      letter-spacing: 0.03em;
    }
    .muted {
      color: rgba(148, 163, 184, 0.9);
      font-weight: 400;
    }
    @media (max-width: 900px) {
      .sheet {
        grid-template-columns: 1fr;
      }
      aside {
        flex-direction: row;
        flex-wrap: wrap;
        gap: 16px;
      }
      aside section {
        flex: 1 1 200px;
      }
    }
  `;

  const skills = ensureArray(resume.skills).map((skill) => {
    const name = escapeHtml(skill.name || '');
    const keywords = ensureArray(skill.keywords).map((k) => `<li>${escapeHtml(k)}</li>`).join('');
    return `
      <section>
        <h2>${name || '技能模块'}</h2>
        ${keywords ? `<ul class="tag-list">${keywords}</ul>` : '<p class="muted">未填写关键字</p>'}
      </section>
    `;
  });

  const html = `
    <div class="sheet modern">
      <aside>
        <section>
          <h2>联系</h2>
          <ul>${contact || '<li>请在简历中补充联系方式</li>'}</ul>
        </section>
        <section>
          <h2>语言</h2>
          ${languages.length ? `<ul>${languages.join('')}</ul>` : '<p class="muted">暂无语言信息</p>'}
        </section>
        <section>
          <h2>兴趣</h2>
          ${interests.length ? `<ul>${interests.map((i) => `<li>${i}</li>`).join('')}</ul>` : '<p class="muted">暂无兴趣标签</p>'}
        </section>
      </aside>
      <main>
        <header class="hero">
          <h1>${name}</h1>
          ${title ? `<p>${title}</p>` : ''}
        </header>
        ${summary ? `<section><h2>简介</h2><p>${summary}</p></section>` : ''}
        <section>
          <h2>工作经历</h2>
          ${renderExperience(ensureArray(resume.work))}
        </section>
        <section>
          <h2>技能矩阵</h2>
          ${skills.length ? skills.join('\n') : '<p class="muted">暂无技能矩阵</p>'}
        </section>
        <section>
          <h2>荣誉与证书</h2>
          ${renderList(ensureArray(resume.awards), '暂无荣誉', (award) => {
            const title = escapeHtml(award.title || '奖项未填');
            const awarder = escapeHtml(award.awarder || '');
            const date = escapeHtml(award.date || '');
            return `<li><strong>${title}</strong>${awarder ? `<span class="muted"> · ${awarder}</span>` : ''}${date ? `<span class="muted"> · ${date}</span>` : ''}</li>`;
          })}
        </section>
      </main>
    </div>
  `;

  return {
    html,
    css,
    metadata
  };
}
