'use client';

import { useCallback } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';

function htmlToText(html: string): string {
  if (!html) return '';
  if (typeof document === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Insert line breaks for block elements before extracting text.
  doc.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  doc.querySelectorAll('p, div, li, tr, h1, h2, h3, h4, h5, h6').forEach((el) => {
    el.append('\n');
  });
  const text = doc.body.textContent ?? '';
  return text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
}

export default function HtmlToTextTool() {
  const transform = useCallback((input: string) => htmlToText(input), []);
  return (
    <TextToolLayout
      transform={transform}
      inputLabel="HTML"
      outputLabel="Text"
      sample={'<h1>Title</h1>\n<p>Hello <b>world</b> &amp; friends.</p>\n<ul><li>One</li><li>Two</li></ul>'}
      downloadName="text.txt"
    />
  );
}
