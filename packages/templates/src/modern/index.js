import { escapeHtml, ensureArray, pickResume } from '../shared/utils.js';

export const metadata = {
  id: 'modern',
  name: 'OpenResume Pro Photo',
  description: '1:1 像素级复刻官方视觉（带头像+左侧短线）'
};

export function renderModern(data = {}, ctx = {}) {
  const resume = pickResume(data);
  const basics = resume.basics || {};
  const themeColor = "#0ea5e9"; 

  const css = `
    @page { size: A4; margin: 0; }
    body {
      margin: 0;
      padding: 15mm 15mm; 
      font-family: ${ctx.fontFamily || "sans-serif"};
      color: #374151;
      font-size: 10.5pt;
      line-height: 1.5;
    }
    
    .top-bar {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 4.5pt;
      background-color: ${themeColor};
    }

    /* 头像与文字的包裹器 */
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-top: 10pt;
    }

    .name { font-size: 26pt; font-weight: 800; color: #111827; letter-spacing: -1pt; line-height: 1.2; }
    .label { font-size: 12pt; color: #4b5563; margin-top: 2pt; font-weight: 500; }
    .contact-info { display: flex; gap: 10pt; margin-top: 10pt; font-size: 9.5pt; color: #6b7280; }

    /* COS 头像样式 */
    .profile-photo {
      width: 75pt;
      height: 75pt;
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid #e5e7eb;
    }

    .section-title-container { display: flex; align-items: center; margin-top: 20pt; margin-bottom: 10pt; }
    .section-title-line { width: 25pt; height: 3.5pt; background-color: ${themeColor}; margin-right: 10pt; }
    .section-title-text { font-size: 13pt; font-weight: 700; color: #111827; text-transform: uppercase; }

    .item { margin-bottom: 12pt; }
    .item-header { display: flex; justify-content: space-between; font-weight: 700; color: #111827; font-size: 11pt; }
    .item-sub { display: flex; justify-content: space-between; font-style: italic; color: #6b7280; font-size: 10pt; }
    .bullet-list { margin: 4pt 0 0 12pt; padding: 0; list-style-type: disc; }
    .bullet-list li { margin-bottom: 3pt; color: #374151; }
    .skills-section { font-size: 10.5pt; line-height: 1.6; color: #374151; margin-left: 35pt;}
  `;

  const html = `
    <div class="top-bar"></div>
    <div class="container">
      <div class="header-container">
        <header style="flex: 1;">
          <div class="name">${escapeHtml(basics.name || '姓名')}</div>
          <div class="label">${escapeHtml(basics.label || '')}</div>
          <div class="contact-info">
            ${basics.email ? `<span>${escapeHtml(basics.email)}</span>` : ''}
            ${basics.phone ? `<span>| ${escapeHtml(basics.phone)}</span>` : ''}
            ${basics.location?.city ? `<span>| ${escapeHtml(basics.location.city)}</span>` : ''}
          </div>
        </header>
        
        ${basics.image ? `
          <img src="${basics.image}" class="profile-photo" />
        ` : ''}
      </div>

      <div class="section-title-container">
        <div class="section-title-line"></div>
        <div class="section-title-text">Work Experience</div>
      </div>
      ${ensureArray(resume.work).map(item => `
        <div class="item">
          <div class="item-header">
            <span>${escapeHtml(item.name)}</span>
            <span>${escapeHtml(item.startDate || '')} ${item.endDate ? '- ' + escapeHtml(item.endDate) : ' - Present'}</span>
          </div>
          <div class="item-sub"><span>${escapeHtml(item.position)}</span></div>
          <ul class="bullet-list">
            ${ensureArray(item.highlights).map(h => `<li>${escapeHtml(h)}</li>`).join('')}
          </ul>
        </div>
      `).join('')}

      <div class="section-title-container">
        <div class="section-title-line"></div>
        <div class="section-title-text">Education</div>
      </div>
      ${ensureArray(resume.education).map(edu => `
        <div class="item">
          <div class="item-header">
            <span>${escapeHtml(edu.institution)}</span>
            <span>${escapeHtml(edu.endDate || '')}</span>
          </div>
          <div class="item-sub"><span>${escapeHtml(edu.area)}</span></div>
        </div>
      `).join('')}

      <div class="section-title-container">
        <div class="section-title-line"></div>
        <div class="section-title-text">Skills</div>
      </div>
      <div class="skills-section">
        ${ensureArray(resume.skills).map(s => `
          <div><strong>${escapeHtml(s.name)}:</strong> ${ensureArray(s.keywords).join(', ')}</div>
        `).join('')}
      </div>
    </div>
  `;

  return { html, css, metadata };
}