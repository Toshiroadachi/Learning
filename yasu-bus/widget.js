// 野洲駅行きバス ウィジェット（iPhone 用・Scriptable アプリで動かします）
// 村田製作所バス停 → 野洲駅北口行き / 野洲駅南口行き の「次の2本」を表示します。
// 時刻は Web アプリと同じ timetable.json を読み込みます（オフライン時は前回の内容を使用）。
//
// 使い方：
//   1. App Store で「Scriptable」（無料）をインストール
//   2. Scriptable で「＋」→ このファイルの中身を全部貼り付け → 名前を「野洲駅バス」にして保存
//   3. ホーム画面を長押し →「＋」→ Scriptable → 小 or 中サイズを追加
//   4. 追加したウィジェットを長押し →「ウィジェットを編集」→ Script で「野洲駅バス」を選ぶ
//   ロック画面（長方形）にも追加できます。

const BASE_URL = "https://toshiroadachi.github.io/Learning/yasu-bus/";
const DATA_URL = BASE_URL + "timetable.json";

const COLORS = {
  bg: Color.dynamic(new Color("#ffffff"), new Color("#171d2b")),
  fg: Color.dynamic(new Color("#141a2b"), new Color("#e7ebf5")),
  muted: Color.dynamic(new Color("#636b80"), new Color("#98a1b6")),
  north: Color.dynamic(new Color("#1d4ed8"), new Color("#6d95f5")),
  south: Color.dynamic(new Color("#0f766e"), new Color("#3fbfb0")),
};

const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

// ---- データ読み込み（失敗したらキャッシュ） ----
async function loadData() {
  const fm = FileManager.local();
  const cache = fm.joinPath(fm.documentsDirectory(), "yasu-bus-timetable.json");
  try {
    const req = new Request(DATA_URL + "?t=" + Date.now());
    req.timeoutInterval = 10;
    const json = await req.loadJSON();
    if (!json || !Array.isArray(json.routes)) throw new Error("bad data");
    fm.writeString(cache, JSON.stringify(json));
    return json;
  } catch (e) {
    if (fm.fileExists(cache)) return JSON.parse(fm.readString(cache));
    return { routes: [], closedDates: [], fromHour: 12 };
  }
}

function runsOn(data, d) {
  const w = d.getDay();
  if (w === 0 || w === 6) return false;
  return !(data.closedDates || []).includes(ymd(d));
}

// 今日のこれから発車する便（Date の配列）
function upcoming(data, route, now) {
  if (!runsOn(data, now)) return [];
  const from = (data.fromHour ?? 12) * 60;
  const cur = now.getHours() * 60 + now.getMinutes();
  return (route.times || [])
    .filter(t => toMin(t) >= from && toMin(t) >= cur)
    .sort((a, b) => toMin(a) - toMin(b))
    .map(t => { const d = new Date(now); d.setHours(...t.split(":").map(Number), 0, 0); return d; });
}

function statusText(data, route, now) {
  if (!(route.times || []).length) return "時刻未登録";
  if (!runsOn(data, now)) return "本日運行なし";
  return "本日終了";
}

const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// ---- ホーム画面ウィジェット（小・中） ----
function addRoute(stack, data, route, now, color, compact) {
  const col = stack.addStack();
  col.layoutVertically();
  col.spacing = compact ? 1 : 3;

  const title = col.addText(compact ? route.short : route.name);
  title.font = Font.boldSystemFont(compact ? 12 : 13);
  title.textColor = color;

  const buses = upcoming(data, route, now).slice(0, 2);
  if (!buses.length) {
    const t = col.addText(statusText(data, route, now));
    t.font = Font.systemFont(compact ? 13 : 15);
    t.textColor = COLORS.muted;
    return;
  }

  const row1 = col.addStack();
  row1.centerAlignContent();
  const t1 = row1.addText(hm(buses[0]));
  t1.font = Font.heavyMonospacedSystemFont(compact ? 22 : 30);
  t1.textColor = COLORS.fg;
  t1.minimumScaleFactor = 0.7;
  if (!compact) {
    row1.addSpacer(6);
    const rel = row1.addDate(buses[0]);   // 「5分後」のように自動で数え直す
    rel.applyRelativeStyle();
    rel.font = Font.systemFont(12);
    rel.textColor = COLORS.muted;
  }

  if (buses[1]) {
    const t2 = col.addText((compact ? "" : "次 ") + hm(buses[1]));
    t2.font = Font.semiboldMonospacedSystemFont(compact ? 14 : 17);
    t2.textColor = COLORS.muted;
  } else {
    const t2 = col.addText("最終");
    t2.font = Font.systemFont(compact ? 11 : 13);
    t2.textColor = COLORS.muted;
  }
}

function buildHomeWidget(data, now, family) {
  const w = new ListWidget();
  w.backgroundColor = COLORS.bg;
  w.url = BASE_URL;
  const compact = family === "small";
  w.setPadding(12, 14, 12, 14);

  const head = w.addStack();
  const h = head.addText(compact ? "村田製作所発" : "🚌 村田製作所 → 野洲駅");
  h.font = Font.semiboldSystemFont(compact ? 11 : 12);
  h.textColor = COLORS.muted;
  head.addSpacer();
  const clock = head.addText(hm(now));
  clock.font = Font.mediumMonospacedSystemFont(11);
  clock.textColor = COLORS.muted;
  w.addSpacer(compact ? 4 : 8);

  const routes = data.routes;
  const north = routes.find(r => r.id === "north") || routes[0];
  const south = routes.find(r => r.id === "south") || routes[1];

  if (compact) {
    // 小：上下に 北口 / 南口
    if (north) addRoute(w.addStack(), data, north, now, COLORS.north, true);
    w.addSpacer(6);
    if (south) addRoute(w.addStack(), data, south, now, COLORS.south, true);
  } else {
    // 中：左右に 北口 | 南口
    const row = w.addStack();
    row.topAlignContent();
    if (north) addRoute(row, data, north, now, COLORS.north, false);
    row.addSpacer();
    if (south) addRoute(row, data, south, now, COLORS.south, false);
    row.addSpacer();
  }
  w.addSpacer();
  return w;
}

// ---- ロック画面ウィジェット ----
function buildAccessory(data, now, family) {
  const w = new ListWidget();
  w.url = BASE_URL;
  const routes = data.routes.slice(0, 2);
  if (family === "accessoryInline") {
    const parts = routes.map(r => {
      const b = upcoming(data, r, now)[0];
      return `${r.short} ${b ? hm(b) : "—"}`;
    });
    w.addText("🚌 " + parts.join(" / "));
    return w;
  }
  // accessoryRectangular / Circular
  for (const r of routes) {
    const b = upcoming(data, r, now).slice(0, 2);
    const t = w.addText(`${r.short} ${b.length ? b.map(hm).join(" ") : statusText(data, r, now)}`);
    t.font = Font.semiboldMonospacedSystemFont(14);
    t.minimumScaleFactor = 0.6;
  }
  return w;
}

// ---- 次に表示を更新する時刻：次の発車の直後（最大15分後） ----
function nextRefresh(data, now) {
  let soonest = new Date(now.getTime() + 15 * 60 * 1000);
  for (const r of data.routes) {
    const b = upcoming(data, r, now)[0];
    if (b) {
      const after = new Date(b.getTime() + 60 * 1000);
      if (after < soonest) soonest = after;
    }
  }
  return soonest;
}

// ---- 実行 ----
const data = await loadData();
const now = new Date();
const family = config.widgetFamily || "medium";
const widget = family.startsWith("accessory")
  ? buildAccessory(data, now, family)
  : buildHomeWidget(data, now, family);
widget.refreshAfterDate = nextRefresh(data, now);

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();   // Scriptable アプリ内で実行したときのプレビュー
}
Script.complete();
