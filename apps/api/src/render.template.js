export function resumeToHTML(resume = {}, templateId = "classic") {
  const name = resume?.basics?.name || "未命名";
  const skills = (resume?.skills || []).map(s => s.name).join(" · ");
  const works = (resume?.work || []).map(w => `<li>${w.position || ""} — ${(w.highlights||[]).join("、")}</li>`).join("");
  return `
  <html><head><meta charset="utf-8"/>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans CJK SC","PingFang SC","Microsoft Yahei",Arial,sans-serif;padding:36px;}
    h1{margin:0 0 8px 0}.meta{color:#555;margin-bottom:12px}
    h2{margin:18px 0 8px 0;border-bottom:1px solid #ddd;padding-bottom:4px}
    ul{margin:6px 0 0 18px}.tpl{position:fixed;right:36px;top:36px;font-size:12px;color:#999}
  </style></head>
  <body>
    <div class="tpl">Template: ${templateId}</div>
    <h1>${name}</h1>
    <div class="meta">${resume?.basics?.label || ""}</div>
    <h2>技能</h2><div>${skills || "（未填写）"}</div>
    <h2>经历亮点</h2><ul>${works || "<li>（未填写）</li>"}</ul>
  </body></html>`;
}
