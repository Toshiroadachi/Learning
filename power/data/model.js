// Power BI 演習用のサンプルモデル（架空の会社「みどり商事」の販売データ）
// 乱数は固定シードなので、毎回同じデータになる。
import { ddate } from '../js/dax.js';

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export const PRODUCTS = [
  ['P01', 'コーヒー豆', 'ドリンク', 1500, 800],
  ['P02', '紅茶ティーバッグ', 'ドリンク', 600, 300],
  ['P03', '緑茶ボトル', 'ドリンク', 150, 60],
  ['P04', 'チョコレート', '菓子', 300, 120],
  ['P05', 'クッキー', '菓子', 450, 200],
  ['P06', 'ポテトチップス', '菓子', 180, 80],
  ['P07', 'ノート', '文具', 220, 90],
  ['P08', 'ボールペン', '文具', 120, 50],
  ['P09', 'ファイル', '文具', 200, 70],
  ['P10', 'マグカップ', '雑貨', 1200, 500],
];
export const CUSTOMERS = [
  ['C01', '青葉商事', '東京', '法人'],
  ['C02', 'さくら食品', '大阪', '法人'],
  ['C03', 'みなと文具店', '東京', '法人'],
  ['C04', '山田 太郎', '名古屋', '個人'],
  ['C05', '北斗物産', '札幌', '法人'],
  ['C06', '佐藤 花子', '福岡', '個人'],
  ['C07', '東西ホールディングス', '東京', '法人'],
  ['C08', '鈴木 一郎', '大阪', '個人'],
];
export const STAFF = ['田中', '伊藤', '渡辺', '小林'];

export function buildModel() {
  const r = rng(20250401);
  // カレンダー：2025/1/1〜2026/6/30
  const cal = [];
  for (let t = Date.UTC(2025, 0, 1); t <= Date.UTC(2026, 5, 30); t += 86400000) {
    const d = new Date(t); const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
    const fy = m >= 4 ? y : y - 1;
    cal.push({ 日付: ddate(y, m, d.getUTCDate()), 年: y, 月: m, 年月: `${y}-${String(m).padStart(2, '0')}`, 四半期: 'Q' + Math.ceil(m / 3), 曜日: '日月火水木金土'[d.getUTCDay()], 会計年度: 'FY' + fy });
  }
  const sales = [];
  let id = 1001;
  for (let mi = 0; mi < 18; mi++) {
    const y = 2025 + Math.floor(mi / 12), m = mi % 12 + 1;
    const n = 9 + Math.floor(r() * 4) + (y === 2026 ? 2 : 0) + (m === 12 ? 3 : 0);
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (let k = 0; k < n; k++) {
      let p = PRODUCTS[Math.floor(r() * PRODUCTS.length)];
      if (p[0] === 'P09' && y === 2025 && m < 7) p = PRODUCTS[7];          // ファイルは2025年7月発売
      let c = CUSTOMERS[Math.floor(r() * CUSTOMERS.length)];
      if (c[0] === 'C06' && y === 2026) c = CUSTOMERS[5 - 4];               // 佐藤さんは2026年は購入なし
      const qty = p[3] >= 1000 ? 1 + Math.floor(r() * 4) : 2 + Math.floor(r() * 18);
      const price = r() < 0.15 ? Math.round(p[3] * 0.9) : p[3];
      sales.push({ 注文ID: id++, 日付: ddate(y, m, 1 + Math.floor(r() * days)), 顧客ID: c[0], 商品ID: p[0], 担当者: STAFF[Math.floor(r() * STAFF.length)], 数量: qty, 単価: price, 金額: qty * price });
    }
  }
  sales.sort((a, b) => a.日付.ms - b.日付.ms || a.注文ID - b.注文ID);
  sales.forEach((s, i) => { s.注文ID = 1001 + i; });
  return {
    tables: {
      売上: { cols: ['注文ID', '日付', '顧客ID', '商品ID', '担当者', '数量', '単価', '金額'], rows: sales },
      商品: { cols: ['商品ID', '商品名', 'カテゴリ', '標準単価', '原価'], rows: PRODUCTS.map(p => ({ 商品ID: p[0], 商品名: p[1], カテゴリ: p[2], 標準単価: p[3], 原価: p[4] })) },
      顧客: { cols: ['顧客ID', '顧客名', '地域', '区分'], rows: CUSTOMERS.map(c => ({ 顧客ID: c[0], 顧客名: c[1], 地域: c[2], 区分: c[3] })) },
      カレンダー: { cols: ['日付', '年', '月', '年月', '四半期', '曜日', '会計年度'], rows: cal },
      目標: { cols: ['年', 'カテゴリ', '目標金額'], rows: [] },
    },
    rels: [
      { from: '売上', fromCol: '商品ID', to: '商品', toCol: '商品ID' },
      { from: '売上', fromCol: '顧客ID', to: '顧客', toCol: '顧客ID' },
      { from: '売上', fromCol: '日付', to: 'カレンダー', toCol: '日付' },
    ],
    dateTable: 'カレンダー', dateCol: '日付',
  };
}
// 目標テーブルは使わない（シンプルにするため削除）
export function getModel() {
  const m = buildModel();
  delete m.tables.目標;
  return m;
}
