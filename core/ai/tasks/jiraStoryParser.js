/**
 * core/ai/tasks/jiraStoryParser.js
 * Pure JavaScript utility for cleaning Jira Wiki Markup and Confluence HTML into standard Markdown.
 * Strict ceiling <= 150 lines.
 */

function extractJiraKey(text = '') {
  if (!text) return null;
  // AC-xxx / TC-xxx are the framework's traceability IDs, not Jira issues.
  const keys = String(text).match(/\b[A-Z][A-Z0-9]+-\d+\b/g) || [];
  return keys.find((key) => !['AC', 'TC'].includes(key.split('-')[0])) || null;
}

function cleanConfluenceHtml(html = '') {
  if (!html || typeof html !== 'string') return '';
  let md = html;
  // Convert headings
  md = md.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, lvl, content) => `${'#'.repeat(Number(lvl))} ${content.trim()}\n\n`);
  // Convert bold, italic, strikethrough, code
  md = md.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**');
  md = md.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*');
  md = md.replace(/<(?:del|s|strike)[^>]*>([\s\S]*?)<\/(?:del|s|strike)>/gi, '~~$1~~');
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');
  // Convert lists
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<\/?(?:ul|ol)[^>]*>/gi, '\n');
  // Convert paragraphs and linebreaks
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  // Strip remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');
  // Unescape HTML entities
  md = md.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return md;
}

function parseJiraMarkupToMarkdown(raw = '') {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw;

  // If text contains HTML tags from Confluence, clean them first
  if (/<[a-z][\s\S]*>/i.test(text)) {
    text = cleanConfluenceHtml(text);
  }

  // 1. Code blocks: {code:lang}...{code} or {code}...{code}
  text = text.replace(/\{code(?::([a-z]+))?\}([\s\S]*?)\{code\}/gi, (_, lang, code) => {
    return `\`\`\`${lang || ''}\n${code.trim()}\n\`\`\`\n`;
  });

  // 2. Preformatted: {noformat}...{noformat}
  text = text.replace(/\{noformat\}([\s\S]*?)\{noformat\}/gi, (_, code) => {
    return `\`\`\`\n${code.trim()}\n\`\`\`\n`;
  });

  // 3. Quotes: {quote}...{quote} or bq.
  text = text.replace(/\{quote\}([\s\S]*?)\{quote\}/gi, (_, q) => {
    return q.trim().split('\n').map((l) => `> ${l}`).join('\n') + '\n\n';
  });
  text = text.replace(/^bq\.\s*(.+)$/gm, '> $1');

  // 4. Bullet & numbered lists in Jira markup: * item or # item
  text = text.replace(/^(\s*)#+\s+/gm, '$11. ');
  text = text.replace(/^(\s*)\*\s+/gm, '$1- ');

  // 5. Headings: h1. to h6.
  text = text.replace(/^h([1-6])\.\s*(.+)$/gm, (_, lvl, title) => `${'#'.repeat(Number(lvl))} ${title.trim()}`);

  // 6. Text styles: *bold*, _italic_, -strikethrough-, +underline+, {{inline code}}
  text = text.replace(/(^|[\s(])\*([^\s*][^*]*[^\s*])\*([\s).,!?:]|$)/g, '$1**$2**$3');
  text = text.replace(/(^|[\s(])_([^\s_][^_]*[^\s_])_([\s).,!?:]|$)/g, '$1*$2*$3');
  text = text.replace(/(^|[\s(])-([^\s-][^-]*[^\s-])-([\s).,!?:]|$)/g, '$1~~$2~~$3');
  text = text.replace(/\{\{([^{}]+)\}\}/g, '`$1`');

  // 7. Links: [text|url] or [url]
  text = text.replace(/\[([^|\]]+)\|([^\]]+)\]/g, '[$1]($2)');
  text = text.replace(/\[([a-z]+:\/\/[^\]]+)\]/g, '<$1>');

  // 8. Jira Tables: ||hdr 1||hdr 2|| and |cell 1|cell 2|
  const lines = text.split('\n');
  const resultLines = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('||') && line.endsWith('||')) {
      const headers = line.slice(2, -2).split('||').map((h) => h.trim());
      resultLines.push(`| ${headers.join(' | ')} |`);
      resultLines.push(`| ${headers.map(() => '---').join(' | ')} |`);
      inTable = true;
    } else if (line.startsWith('|') && line.endsWith('|') && !line.startsWith('||')) {
      const cells = line.slice(1, -1).split('|').map((c) => c.trim());
      resultLines.push(`| ${cells.join(' | ')} |`);
      inTable = true;
    } else {
      if (inTable) inTable = false;
      resultLines.push(lines[i]);
    }
  }

  return resultLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = {
  extractJiraKey,
  cleanConfluenceHtml,
  parseJiraMarkupToMarkdown
};
