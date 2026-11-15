// 共通の小道具
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));


export function toast(msg, ms = 2200) {
  const d = document.createElement('div');
  d.className = 'toast'; d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), ms);
}

// ---------- 簡易マークダウン ----------
export function md(src) {
  const lines = String(src || '').split('\n');
  let html = '', i = 0;
  const inline = s => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      html += `<pre class="code"><code>${esc(buf.join('\n'))}</code></pre>`;
      continue;
    }
    if (/^#{1,4} /.test(l)) { const lv = Math.min(4, l.match(/^#+/)[0].length + (l.startsWith('###') ? 0 : 1)); html += `<h${lv === 4 ? 3 : 3}>${inline(l.replace(/^#+ /, ''))}</h3>`; i++; continue; }
    if (/^> /.test(l)) { html += `<div class="tip">${inline(l.slice(2))}</div>`; i++; continue; }
    if (/^\|/.test(l)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { if (!/^\|[\s\-:|]+\|$/.test(lines[i])) rows.push(lines[i]); i++; }
      html += '<table>' + rows.map((r, k) => '<tr>' + r.replace(/^\||\|$/g, '').split('|').map(c => k ? `<td>${inline(c.trim())}</td>` : `<th>${inline(c.trim())}</th>`).join('') + '</tr>').join('') + '</table>';
      continue;
    }
    if (/^\s*[-*] /.test(l)) {
      html += '<ul>';
      while (i < lines.length && /^\s*[-*] /.test(lines[i])) html += `<li>${inline(lines[i++].replace(/^\s*[-*] /, ''))}</li>`;
      html += '</ul>'; continue;
    }
    if (/^\s*\d+\. /.test(l)) {
      html += '<ol>';
      while (i < lines.length && /^\s*\d+\. /.test(lines[i])) html += `<li>${inline(lines[i++].replace(/^\s*\d+\. /, ''))}</li>`;
      html += '</ol>'; continue;
    }
    if (!l.trim()) { i++; continue; }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,4} |> |\||\s*[-*] |\s*\d+\. )/.test(lines[i])) buf.push(inline(lines[i++]));
    html += `<p>${buf.join('<br>')}</p>`;
  }
  return html;
}

