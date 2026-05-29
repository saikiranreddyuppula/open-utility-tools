'use client';

import { useCallback } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';

const SAMPLE = `<h1>Hello World</h1>
<p>A short <strong>demo</strong> of <em>HTML</em> with a <a href="https://example.com">link</a> and <code>inline code</code>.</p>
<h2>Features</h2>
<ul>
  <li>Lists</li>
  <li><strong>Bold</strong> and <em>italic</em></li>
</ul>
<ol>
  <li>First</li>
  <li>Second</li>
</ol>
<blockquote>A blockquote.</blockquote>
<pre><code>const x = 1;
console.log(x);</code></pre>
<img src="https://example.com/img.png" alt="alt text" />`;

function collapseWs(text: string): string {
  return text.replace(/\s+/g, ' ');
}

function walk(node: Node, listContext?: { ordered: boolean; index: number }): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return collapseWs(node.textContent ?? '');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  const childrenMd = (ctx?: { ordered: boolean; index: number }) =>
    Array.from(el.childNodes)
      .map((c) => walk(c, ctx))
      .join('');

  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const level = Number(tag.slice(1));
      return `\n\n${'#'.repeat(level)} ${childrenMd().trim()}\n\n`;
    }
    case 'p':
      return `\n\n${childrenMd().trim()}\n\n`;
    case 'br':
      return '  \n';
    case 'hr':
      return '\n\n---\n\n';
    case 'strong':
    case 'b': {
      const inner = childrenMd().trim();
      return inner ? `**${inner}**` : '';
    }
    case 'em':
    case 'i': {
      const inner = childrenMd().trim();
      return inner ? `*${inner}*` : '';
    }
    case 'del':
    case 's':
    case 'strike': {
      const inner = childrenMd().trim();
      return inner ? `~~${inner}~~` : '';
    }
    case 'code': {
      // Inline code (block code handled by <pre>)
      if (el.parentElement && el.parentElement.tagName.toLowerCase() === 'pre') {
        return el.textContent ?? '';
      }
      return `\`${el.textContent ?? ''}\``;
    }
    case 'pre': {
      const codeEl = el.querySelector('code');
      const content = (codeEl ? codeEl.textContent : el.textContent) ?? '';
      const langMatch = codeEl?.className.match(/language-([\w-]+)/);
      const lang = langMatch ? (langMatch[1] ?? '') : '';
      return `\n\n\`\`\`${lang}\n${content.replace(/\n$/, '')}\n\`\`\`\n\n`;
    }
    case 'a': {
      const href = el.getAttribute('href') ?? '';
      const title = el.getAttribute('title');
      const text = childrenMd().trim() || href;
      const t = title ? ` "${title}"` : '';
      return href ? `[${text}](${href}${t})` : text;
    }
    case 'img': {
      const src = el.getAttribute('src') ?? '';
      const alt = el.getAttribute('alt') ?? '';
      const title = el.getAttribute('title');
      const t = title ? ` "${title}"` : '';
      return `![${alt}](${src}${t})`;
    }
    case 'blockquote': {
      const inner = childrenMd().trim();
      const quoted = inner
        .split('\n')
        .map((l) => (l.trim() === '' ? '>' : `> ${l}`))
        .join('\n');
      return `\n\n${quoted}\n\n`;
    }
    case 'ul':
    case 'ol': {
      const ordered = tag === 'ol';
      const items = Array.from(el.children).filter(
        (c) => c.tagName.toLowerCase() === 'li',
      );
      const startAttr = el.getAttribute('start');
      let start = ordered && startAttr ? Number(startAttr) : 1;
      if (!Number.isFinite(start)) start = 1;
      const rendered = items.map((li, idx) => {
        const marker = ordered ? `${start + idx}.` : '-';
        const content = Array.from(li.childNodes)
          .map((c) => walk(c, { ordered, index: start + idx }))
          .join('')
          .trim();
        // Indent continuation lines (e.g. nested lists) under the marker.
        const indent = ' '.repeat(marker.length + 1);
        const indented = content
          .split('\n')
          .map((l, li2) => (li2 === 0 ? l : l === '' ? l : indent + l))
          .join('\n');
        return `${marker} ${indented}`;
      });
      return `\n\n${rendered.join('\n')}\n\n`;
    }
    case 'li':
      return childrenMd(listContext);
    case 'table': {
      const rows = Array.from(el.querySelectorAll('tr'));
      if (rows.length === 0) return '';
      const cellText = (cell: Element) =>
        collapseWs(walk(cell).trim()).replace(/\|/g, '\\|');
      const firstRow = rows[0];
      if (!firstRow) return '';
      const headerCells = Array.from(firstRow.children).map(cellText);
      const lines: string[] = [];
      lines.push(`| ${headerCells.join(' | ')} |`);
      lines.push(`| ${headerCells.map(() => '---').join(' | ')} |`);
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        const cells = Array.from(row.children).map(cellText);
        lines.push(`| ${cells.join(' | ')} |`);
      }
      return `\n\n${lines.join('\n')}\n\n`;
    }
    case 'script':
    case 'style':
    case 'head':
      return '';
    case 'span':
    case 'div':
    case 'section':
    case 'article':
    case 'main':
    case 'body':
    case 'html':
    default: {
      const inner = childrenMd(listContext);
      // Block-level wrappers get spacing; inline ones (span) do not.
      const blockTags = new Set(['div', 'section', 'article', 'main']);
      return blockTags.has(tag) ? `\n${inner}\n` : inner;
    }
  }
}

export default function HtmlToMarkdownTool() {
  const transform = useCallback((input: string) => {
    if (!input.trim()) return '';
    if (typeof DOMParser === 'undefined') {
      throw new Error('DOMParser is not available in this environment.');
    }
    const doc = new DOMParser().parseFromString(input, 'text/html');
    const body = doc.body;
    if (!body) throw new Error('Could not parse HTML.');
    let md = walk(body);
    // Normalize excessive blank lines and trim.
    md = md.replace(/\n{3,}/g, '\n\n').trim();
    return md;
  }, []);

  return (
    <TextToolLayout
      transform={transform}
      inputLabel="HTML"
      outputLabel="Markdown"
      inputPlaceholder="Paste HTML…"
      sample={SAMPLE}
      downloadName="output.md"
      downloadMime="text/markdown"
    />
  );
}
