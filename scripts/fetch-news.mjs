#!/usr/bin/env node
// 海外ニュースの RSS を取得して data/news.json を更新する（GitHub Actions で毎日実行）
// 依存パッケージなし（Node.js 20+ の fetch を使用）。記事本文は転載せず、見出し・要約・リンクのみ保存。
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'data', 'news.json');

export const FEEDS = [
  { source: 'BBC News', category: 'World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { source: 'BBC News', category: 'Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { source: 'BBC News', category: 'Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { source: 'NPR', category: 'World', url: 'https://feeds.npr.org/1004/rss.xml' },
  { source: 'NPR', category: 'Business', url: 'https://feeds.npr.org/1006/rss.xml' },
  { source: 'The Guardian', category: 'World', url: 'https://www.theguardian.com/world/rss' },
  { source: 'The Guardian', category: 'Business', url: 'https://www.theguardian.com/uk/business/rss' },
  { source: 'Al Jazeera', category: 'World', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { source: 'CNBC', category: 'Business', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
];

const PER_FEED = 6;      // 1フィードあたりの最大取得件数
const KEEP_DAYS = 14;    // アーカイブ保持日数

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
export function decode(s = '') {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z0-9#]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/<[^>]+>/g, ' ')  // エンティティ化されていたタグも除去
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
}

export function parseFeed(xml, feed) {
  const items = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    const title = decode(tag(b, 'title'));
    let link = decode(tag(b, 'link'));
    if (!link) { const m = b.match(/<link[^>]*href="([^"]+)"/i); link = m ? m[1] : ''; }
    const summary = decode(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content'));
    const dateRaw = decode(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date'));
    const d = new Date(dateRaw);
    const thumb = (b.match(/<media:(?:thumbnail|content)[^>]*url="([^"]+)"/i) || [])[1] || '';
    if (!title || !link) continue;
    items.push({
      id: hash(link),
      source: feed.source,
      category: feed.category,
      title,
      summary: summary.length > 600 ? summary.slice(0, 600).replace(/\s\S*$/, '') + '…' : summary,
      link,
      thumb,
      published: isNaN(d) ? new Date().toISOString() : d.toISOString(),
    });
  }
  return items;
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

async function fetchFeed(feed) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(feed.url, { signal: ctrl.signal, headers: { 'User-Agent': 'toeic-news-reader/1.0 (+RSS reader)' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseFeed(xml, feed)
      .filter(it => it.summary.split(' ').length >= 6)  // 要約が短すぎるものは除外
      .slice(0, PER_FEED);
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  let prev = { items: [] };
  try { prev = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* 初回 */ }

  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const fresh = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') { fresh.push(...r.value); console.log(`✓ ${FEEDS[i].source} ${FEEDS[i].category}: ${r.value.length}`); }
    else console.warn(`✗ ${FEEDS[i].source} ${FEEDS[i].category}: ${r.reason?.message}`);
  });
  if (!fresh.length) { console.error('No feeds could be fetched; keeping existing file.'); process.exit(1); }

  const fetchedAt = new Date().toISOString();
  const byId = new Map();
  for (const it of prev.items || []) byId.set(it.id, it);
  for (const it of fresh) byId.set(it.id, { ...byId.get(it.id), ...it, fetchedAt: byId.get(it.id)?.fetchedAt || fetchedAt });

  const cutoff = Date.now() - KEEP_DAYS * 86400000;
  const items = [...byId.values()]
    .filter(it => new Date(it.fetchedAt || it.published).getTime() >= cutoff)
    .sort((a, b) => b.published.localeCompare(a.published));

  await writeFile(OUT, JSON.stringify({ updated: fetchedAt, sources: [...new Set(FEEDS.map(f => f.source))], items }, null, 1) + '\n');
  console.log(`Saved ${items.length} items (${fresh.length} fetched now).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
