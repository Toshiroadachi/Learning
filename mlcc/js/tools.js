// 計算ツール（容量設計・インピーダンス・実効容量・エージング・加速係数と故障率・ターゲットインピーダンス・コード解読）
import { esc } from './util.js';

export const TOOLS = [
  { id: 'cap', icon: '🧮', name: '容量の設計計算', desc: 'εr・電極面積・層厚・層数から容量と電界強度' },
  { id: 'imp', icon: '📈', name: 'インピーダンス特性', desc: 'C・ESR・ESL から |Z|-f カーブ、SRF、並列接続と反共振' },
  { id: 'eff', icon: '📉', name: '実効容量の見積もり', desc: '公差・DC バイアス・温度・エージングを掛け合わせ' },
  { id: 'aging', icon: '⏳', name: 'エージング換算', desc: '経過時間の違う測定値を換算、係数を逆算' },
  { id: 'accel', icon: '🔥', name: '加速係数と故障率', desc: '温度・電圧の加速、カイ二乗で FIT の上限' },
  { id: 'pdn', icon: '⚡', name: 'ターゲットインピーダンス', desc: '電源の許容リップルから目標インピーダンス' },
  { id: 'code', icon: '🔤', name: 'コード解読', desc: '容量コード・公差・定格電圧・温度特性・サイズ換算' },
];

const $ = (s, el) => el.querySelector(s);
const num = v => { const x = parseFloat(String(v).replace(/,/g, '')); return isFinite(x) ? x : NaN; };

// ---------- 単位表示 ----------
export function fmtSI(v, unit, digits = 3) {
  if (!isFinite(v)) return '—';
  if (v === 0) return '0 ' + unit;
  const pre = [['T', 1e12], ['G', 1e9], ['M', 1e6], ['k', 1e3], ['', 1], ['m', 1e-3], ['µ', 1e-6], ['n', 1e-9], ['p', 1e-12], ['f', 1e-15]];
  const a = Math.abs(v);
  for (const [p, f] of pre) if (a >= f * 0.9995) return `${+(v / f).toPrecision(digits)} ${p}${unit}`;
  return `${v.toExponential(2)} ${unit}`;
}

// ---------- 両対数グラフ（SVG） ----------
function logPlot(series, { xmin, xmax, ymin, ymax, xlabel, ylabel, marks = [] }) {
  const W = 340, H = 220, L = 44, R = 10, T = 10, B = 30;
  const lx = x => L + (Math.log10(x) - Math.log10(xmin)) / (Math.log10(xmax) - Math.log10(xmin)) * (W - L - R);
  const ly = y => T + (1 - (Math.log10(y) - Math.log10(ymin)) / (Math.log10(ymax) - Math.log10(ymin))) * (H - T - B);
  let g = '';
  for (let e = Math.ceil(Math.log10(xmin)); e <= Math.floor(Math.log10(xmax)); e++) {
    const x = lx(10 ** e);
    g += `<line x1="${x}" y1="${T}" x2="${x}" y2="${H - B}" class="gl"/><text x="${x}" y="${H - B + 14}" class="ax" text-anchor="middle">${fmtSI(10 ** e, 'Hz', 1).replace(' ', '')}</text>`;
  }
  for (let e = Math.ceil(Math.log10(ymin)); e <= Math.floor(Math.log10(ymax)); e++) {
    const y = ly(10 ** e);
    g += `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" class="gl"/><text x="${L - 4}" y="${y + 3}" class="ax" text-anchor="end">${fmtSI(10 ** e, 'Ω', 1).replace(' ', '')}</text>`;
  }
  const paths = series.map(s => {
    const d = s.pts.filter(([x, y]) => y > 0).map(([x, y], i) => `${i ? 'L' : 'M'}${lx(x).toFixed(1)},${ly(Math.min(ymax, Math.max(ymin, y))).toFixed(1)}`).join('');
    return `<path d="${d}" class="ln ${s.cls || ''}" ${s.dash ? 'stroke-dasharray="4 3"' : ''}/>`;
  }).join('');
  const mk = marks.map(m => `<line x1="${L}" y1="${ly(m.y)}" x2="${W - R}" y2="${ly(m.y)}" class="tgt"/><text x="${W - R - 2}" y="${ly(m.y) - 3}" class="ax tg" text-anchor="end">${esc(m.label)}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="plot" role="img" aria-label="${esc(ylabel)} と ${esc(xlabel)} の両対数グラフ">${g}${mk}${paths}
    <text x="${(W + L) / 2}" y="${H - 2}" class="ax" text-anchor="middle">${esc(xlabel)}</text></svg>`;
}

function field(label, id, value, unit = '', attrs = '') {
  return `<label>${label}<span class="inunit"><input id="${id}" type="number" inputmode="decimal" value="${value}" step="any" ${attrs}>${unit ? `<span>${unit}</span>` : ''}</span></label>`;
}

// ---------- 各ツール ----------
const RENDER = {
  cap(el) {
    el.innerHTML = `<p class="small muted">C = ε0·εr·S·n / t。S は内部電極の重なり面積（有効面積）。</p>
      <div class="form two">
        ${field('比誘電率 εr', 'er', 3000)}
        ${field('有効層数 n', 'n', 300, '層')}
        ${field('電極の重なり 長さ', 'L', 0.8, 'mm')}
        ${field('電極の重なり 幅', 'Wd', 0.4, 'mm')}
        ${field('誘電体1層の厚み t', 't', 1.0, 'µm')}
        ${field('印加電圧（電界強度の計算用）', 'V', 6.3, 'V')}
      </div><div class="calc-out"></div>`;
    const calc = () => {
      const er = num($('#er', el).value), n = num($('#n', el).value), S = num($('#L', el).value) * num($('#Wd', el).value) * 1e-6, t = num($('#t', el).value) * 1e-6, V = num($('#V', el).value);
      const C1 = 8.854e-12 * er * S / t, C = C1 * n, E = V / (t * 1e6);
      const stack = n * t * 1e6;
      $('.calc-out', el).innerHTML = `<div class="result-big">${fmtSI(C, 'F')}</div>
        <table class="cmp"><tr><td>1層あたりの容量</td><td>${fmtSI(C1, 'F')}</td></tr>
        <tr><td>電界強度 E = V/t</td><td>${isFinite(E) ? E.toFixed(2) : '—'} V/µm（= ${isFinite(E) ? (E).toFixed(2) : '—'} kV/mm）</td></tr>
        <tr><td>誘電体の総厚み（n × t）</td><td>${isFinite(stack) ? stack.toFixed(0) : '—'} µm（電極・カバー層は別）</td></tr></table>
        <p class="small muted">層厚を半分・層数を2倍にすると容量は4倍、電界強度は2倍になります。電界強度が大きいほど DC バイアスによる容量低下と寿命の面で厳しくなります。</p>`;
    };
    el.oninput = calc; calc();
  },

  imp(el) {
    el.innerHTML = `<p class="small muted">直列 RLC モデル：|Z| = √(ESR² + (ωL − 1/ωC)²)。2つ目のコンデンサを並列に加えると反共振が見られます。</p>
      <div class="form two">
        ${field('容量 C1', 'c1', 1, 'µF')}${field('ESR1', 'r1', 5, 'mΩ')}
        ${field('ESL1', 'l1', 0.5, 'nH')}${field('個数（同じ品種を並列）', 'k1', 1, '個', 'min="1" step="1"')}
      </div>
      <label class="small row" style="margin:8px 0"><input type="checkbox" id="use2"> 2つ目のコンデンサを並列に加える</label>
      <div class="form two" id="p2">
        ${field('容量 C2', 'c2', 0.01, 'µF')}${field('ESR2', 'r2', 30, 'mΩ')}
        ${field('ESL2', 'l2', 0.3, 'nH')}${field('個数', 'k2', 1, '個', 'min="1" step="1"')}
      </div>
      <div class="form two">${field('DC バイアスでの容量低下（C1・C2 に適用）', 'dcb', 0, '%')}${field('目標インピーダンス（任意）', 'zt', '', 'mΩ')}</div>
      <div class="calc-out"></div>`;
    const calc = () => {
      const g = id => num($('#' + id, el).value);
      const dcb = 1 - (g('dcb') || 0) / 100;
      const use2 = $('#use2', el).checked;
      $('#p2', el).style.opacity = use2 ? 1 : .45;
      const caps = [{ C: g('c1') * 1e-6 * dcb, R: g('r1') * 1e-3, L: g('l1') * 1e-9, k: Math.max(1, Math.round(g('k1') || 1)) }];
      if (use2) caps.push({ C: g('c2') * 1e-6 * dcb, R: g('r2') * 1e-3, L: g('l2') * 1e-9, k: Math.max(1, Math.round(g('k2') || 1)) });
      if (caps.some(c => !(c.C > 0 && c.R >= 0 && c.L > 0))) { $('.calc-out', el).innerHTML = '<div class="result ng">値を正しく入力してください（C・ESL は 0 より大きく）</div>'; return; }
      const zOne = (c, f) => { const w = 2 * Math.PI * f; return { re: c.R / c.k, im: (w * c.L - 1 / (w * c.C)) / c.k }; };
      const par = (a, b) => { // a*b/(a+b)（複素数）
        const nr = a.re * b.re - a.im * b.im, ni = a.re * b.im + a.im * b.re, dr = a.re + b.re, di = a.im + b.im, dd = dr * dr + di * di;
        return { re: (nr * dr + ni * di) / dd, im: (ni * dr - nr * di) / dd };
      };
      const fs = []; for (let e = 3; e <= 9.0001; e += 0.02) fs.push(10 ** e);
      const mag = z => Math.hypot(z.re, z.im);
      const s1 = fs.map(f => [f, mag(zOne(caps[0], f))]);
      const series = [{ pts: s1, cls: use2 ? 'c1 thin' : 'c1', dash: use2 }];
      let tot = s1;
      if (use2) {
        const s2 = fs.map(f => [f, mag(zOne(caps[1], f))]);
        tot = fs.map(f => [f, mag(par(zOne(caps[0], f), zOne(caps[1], f)))]);
        series.push({ pts: s2, cls: 'c2 thin', dash: true }, { pts: tot, cls: 'tot' });
      }
      const all = series.flatMap(s => s.pts.map(p => p[1])).filter(v => v > 0);
      const ymin = 10 ** Math.floor(Math.log10(Math.min(...all))), ymax = 10 ** Math.ceil(Math.log10(Math.max(...all)));
      const zt = g('zt') * 1e-3;
      const srf = c => 1 / (2 * Math.PI * Math.sqrt(c.L * c.C));
      let peak = null;
      if (use2) { // 反共振ピーク（2つの SRF の間の最大値）
        const [fa, fb] = [srf(caps[0]), srf(caps[1])].sort((a, b) => a - b);
        for (const [f, z] of tot) if (f > fa && f < fb && (!peak || z > peak[1])) peak = [f, z];
      }
      const minZ = tot.reduce((a, b) => b[1] < a[1] ? b : a);
      const overT = zt > 0 ? tot.filter(p => p[1] > zt) : [];
      $('.calc-out', el).innerHTML = `${logPlot(series, { xmin: 1e3, xmax: 1e9, ymin: Math.max(ymin, 1e-5), ymax, xlabel: '周波数', ylabel: '|Z|', marks: zt > 0 ? [{ y: zt, label: '目標 ' + fmtSI(zt, 'Ω') }] : [] })}
        <div class="legend small">${use2 ? '<span class="lg c1">C1</span><span class="lg c2">C2</span><span class="lg tot">合成</span>' : '<span class="lg c1">C1</span>'}</div>
        <table class="cmp">
          <tr><td>SRF（C1）</td><td>${fmtSI(srf(caps[0]), 'Hz')}（|Z| = ESR/個数 = ${fmtSI(caps[0].R / caps[0].k, 'Ω')}）</td></tr>
          ${use2 ? `<tr><td>SRF（C2）</td><td>${fmtSI(srf(caps[1]), 'Hz')}</td></tr>
          <tr><td>反共振ピーク</td><td>${peak ? `${fmtSI(peak[0], 'Hz')} で ${fmtSI(peak[1], 'Ω')}` : '—'}</td></tr>` : ''}
          <tr><td>合成 |Z| の最小</td><td>${fmtSI(minZ[1], 'Ω')}（${fmtSI(minZ[0], 'Hz')}）</td></tr>
          ${zt > 0 ? `<tr><td>目標を超える帯域</td><td>${overT.length ? `${fmtSI(overT[0][0], 'Hz')} 〜 など（グラフで確認）` : 'なし（1 kHz〜1 GHz で目標以下）'}</td></tr>` : ''}
        </table>
        <p class="small muted">同じ品種を k 個並列にすると ESR・ESL は 1/k、容量は k 倍。実装のインダクタンス（パッド・ビア）は ESL に加えて考えます。</p>`;
    };
    el.oninput = calc; el.onchange = calc; calc();
  },

  eff(el) {
    el.innerHTML = `<p class="small muted">実効容量 = 公称容量 ×（1 − 公差下限）×（1 − DC バイアス低下）×（1 − 温度での低下）×（1 − エージング低下）</p>
      <div class="form two">
        ${field('公称容量', 'c', 10, 'µF')}${field('公差の下限（K なら 10）', 'tol', 10, '%')}
        ${field('DC バイアスによる低下', 'dc', 45, '%')}${field('温度による低下', 'tc', 10, '%')}
        ${field('エージング係数', 'k', 2, '%/decade')}${field('基準からの経過（何 decade か）', 'dec', 1.5, 'decade')}
        ${field('必要な容量（任意）', 'need', 10, 'µF')}
      </div><div class="calc-out"></div>`;
    const calc = () => {
      const g = id => num($('#' + id, el).value) || 0;
      const fac = [1 - g('tol') / 100, 1 - g('dc') / 100, 1 - g('tc') / 100, 1 - g('k') * g('dec') / 100];
      const eff = g('c') * fac.reduce((a, b) => a * b, 1);
      const need = g('need');
      const nPar = need > 0 && eff > 0 ? Math.ceil(need / eff) : null;
      $('.calc-out', el).innerHTML = `<div class="result-big">${eff.toFixed(2)} µF <small>（公称の ${(eff / g('c') * 100).toFixed(0)} %）</small></div>
        <table class="cmp"><tr><th>要因</th><th>係数</th></tr>
        ${['公差下限', 'DC バイアス', '温度', 'エージング'].map((n, i) => `<tr><td>${n}</td><td>× ${fac[i].toFixed(3)}</td></tr>`).join('')}</table>
        ${nPar ? `<div class="result ${nPar === 1 ? 'ok' : 'ng'}">必要容量 ${need} µF に対し、この品種なら <b>${nPar} 個</b>の並列が必要です。${nPar > 1 ? 'サイズや定格電圧の大きい品種（DC バイアス特性の良い品種）も比較しましょう。' : ''}</div>` : ''}
        <p class="small muted">DC バイアス・温度の値は、品番ごとにメーカーの特性データ（設計支援ツール）で確認します。DC バイアス下の温度特性は、両者の単純な掛け算と一致しないこともあります。</p>`;
    };
    el.oninput = calc; calc();
  },

  aging(el) {
    el.innerHTML = `<p class="small muted">C(t) = C(t0)·[1 − k·log10(t/t0)]（t はデエージング＝熱処理からの経過時間）</p>
      <h3>① 換算</h3><div class="form two">
        ${field('基準時刻 t0', 't0', 24, '時間')}${field('t0 での容量', 'c0', 4.7, 'µF')}
        ${field('エージング係数 k', 'k', 2, '%/decade')}${field('換算したい時刻 t', 't', 2400, '時間')}
      </div><div class="out-a"></div>
      <h3>② 係数の逆算</h3><div class="form two">
        ${field('時刻 t1', 'ta', 1, '時間')}${field('t1 での容量', 'ca', 10, 'µF')}
        ${field('時刻 t2', 'tb', 1000, '時間')}${field('t2 での容量', 'cb', 9.55, 'µF')}
      </div><div class="out-b"></div>`;
    const calc = () => {
      const g = id => num($('#' + id, el).value);
      const d = Math.log10(g('t') / g('t0'));
      const c = g('c0') * (1 - g('k') / 100 * d);
      $('.out-a', el).innerHTML = `<div class="result-big">${isFinite(c) ? c.toFixed(3) : '—'} µF</div><p class="small muted">${isFinite(d) ? d.toFixed(2) : '—'} decade（${d >= 0 ? '低下' : '基準より前なので高め'}）。${g('t') / 24 >= 1 ? `t は約 ${(g('t') / 24).toFixed(1)} 日` : ''}</p>`;
      const kk = (g('ca') - g('cb')) / g('ca') / Math.log10(g('tb') / g('ta')) * 100;
      $('.out-b', el).innerHTML = `<div class="result-big">k = ${isFinite(kk) ? kk.toFixed(2) : '—'} %/decade</div>`;
    };
    el.oninput = calc; calc();
  },

  accel(el) {
    el.innerHTML = `<p class="small muted">t_use / t_test = (V_test/V_use)^n · exp[(Ea/k)(1/T_use − 1/T_test)]（Prokopowicz-Vaskas 式）。n・Ea は材料・構造で異なるので、自社品の実測値を使います。</p>
      <div class="form two">
        ${field('試験温度', 'Tt', 150, '℃')}${field('使用温度', 'Tu', 85, '℃')}
        ${field('試験電圧', 'Vt', 12.6, 'V')}${field('使用電圧', 'Vu', 6.3, 'V')}
        ${field('電圧加速指数 n', 'n', 3)}${field('活性化エネルギー Ea', 'Ea', 1.3, 'eV')}
      </div><div class="out-a"></div>
      <h3>試験結果から故障率の上限（カイ二乗）</h3><div class="form two">
        ${field('試験個数', 'N', 1000, '個')}${field('試験時間', 'H', 1000, '時間')}
        <label>故障数<select id="r"><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></label>
        <label>信頼水準<select id="cl"><option value="60">60 %</option><option value="90">90 %</option></select></label>
      </div><div class="out-b"></div>`;
    const CHI = { 60: [0.916, 2.022, 3.105, 4.175], 90: [2.303, 3.890, 5.322, 6.681] };   // χ²(CL, 2r+2)/2
    const calc = () => {
      const g = id => num($('#' + id, el).value);
      const Tt = g('Tt') + 273.15, Tu = g('Tu') + 273.15;
      const av = (g('Vt') / g('Vu')) ** g('n');
      const at = Math.exp(g('Ea') / 8.617e-5 * (1 / Tu - 1 / Tt));
      const af = av * at;
      $('.out-a', el).innerHTML = `<div class="result-big">AF ≈ ${fmtNum(af)}</div>
        <table class="cmp"><tr><td>電圧加速</td><td>${fmtNum(av)}</td></tr><tr><td>温度加速</td><td>${fmtNum(at)}</td></tr>
        <tr><td>試験 1000 時間は使用条件で</td><td>約 ${fmtNum(1000 * af)} 時間（約 ${fmtNum(1000 * af / 8760)} 年）</td></tr></table>`;
      const r = +$('#r', el).value, cl = $('#cl', el).value;
      const T = g('N') * g('H') * af;
      const lam = CHI[cl][r] / T;
      $('.out-b', el).innerHTML = `<div class="result-big">λ ≤ ${fmtNum(lam * 1e9)} FIT</div>
        <p class="small muted">使用条件換算の総部品時間 T = ${fmtNum(T)}。λ = χ²(${cl} %, ${2 * r + 2}) / (2T) = ${CHI[cl][r]} / T。顧客に提示するときは、信頼水準・n・Ea・使用条件を必ず添えましょう。</p>`;
    };
    el.oninput = calc; el.onchange = calc; calc();
  },

  pdn(el) {
    el.innerHTML = `<p class="small muted">Z_target = V_DD × 許容リップル率 / 過渡電流 ΔI</p>
      <div class="form two">${field('電源電圧 V_DD', 'v', 0.8, 'V')}${field('許容リップル', 'rp', 3, '%')}${field('過渡電流 ΔI', 'di', 20, 'A')}${field('使う MLCC の ESR（SRF での |Z|）', 'esr', 3, 'mΩ')}</div>
      <div class="calc-out"></div>`;
    const calc = () => {
      const g = id => num($('#' + id, el).value);
      const z = g('v') * g('rp') / 100 / g('di');
      const k = Math.ceil(g('esr') * 1e-3 / z);
      $('.calc-out', el).innerHTML = `<div class="result-big">${fmtSI(z, 'Ω')}</div>
        <p class="small">SRF 付近だけで見ても、ESR ${g('esr')} mΩ の MLCC なら <b>${isFinite(k) ? k : '—'} 個以上</b>の並列が必要（実際は周波数帯ごとに、ESL・実装インダクタンス・反共振も含めて検討）。</p>
        <p class="small muted">「インピーダンス特性」ツールで、目標インピーダンスを入れて並列数を変えてみましょう。</p>`;
    };
    el.oninput = calc; calc();
  },

  code(el) {
    el.innerHTML = `<p class="small muted">型番や仕様書によく出るコードを解読します（JIS・EIA の一般的な表記。各社の型番体系は各社のカタログを確認）。</p>
      <div class="form">
        <label>容量コード（例 104、475、4R7、R50）<input id="cc" value="475" autocapitalize="characters"></label><div class="o-cc"></div>
        <label>温度特性コード（例 X7R、X5R、C0G、Y5V）<input id="tc" value="X7R" autocapitalize="characters"></label><div class="o-tc"></div>
        <label>定格電圧コード（JIS 例 0J、1A、1C、1E、1H、2A）<input id="vc" value="1H" autocapitalize="characters"></label><div class="o-vc"></div>
        <label>容量公差記号（例 K、M、J、C）<input id="tl" value="K" autocapitalize="characters"></label><div class="o-tl"></div>
        <label>サイズ（例 1005、0402、0603）<input id="sz" value="0603"></label><div class="o-sz"></div>
      </div>`;
    const calc = () => {
      $('.o-cc', el).innerHTML = res(capCode($('#cc', el).value));
      $('.o-tc', el).innerHTML = res(tempCode($('#tc', el).value));
      $('.o-vc', el).innerHTML = res(voltCode($('#vc', el).value));
      $('.o-tl', el).innerHTML = res(tolCode($('#tl', el).value));
      $('.o-sz', el).innerHTML = res(sizeCode($('#sz', el).value));
    };
    el.oninput = calc; calc();
  },
};
const res = r => r ? `<div class="result ${r.ok ? 'ok' : 'ng'}">${r.text}</div>` : '';
function fmtNum(v) {
  if (!isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e6 || (a < 0.01 && a > 0)) return v.toExponential(2).replace('e+', '×10^').replace('e-', '×10^-');
  return a >= 100 ? Math.round(v).toLocaleString() : (+v.toPrecision(3)).toString();
}

// ---------- コード解読（テストからも使う） ----------
export function capCode(s) {
  s = String(s).trim().toUpperCase();
  if (!s) return null;
  let pf;
  if (/^\d*R\d+$/.test(s)) pf = parseFloat(s.replace('R', '.') || '0');
  else if (/^\d{3}$/.test(s)) pf = +s.slice(0, 2) * 10 ** +s[2];
  else if (/^\d{2}$/.test(s)) pf = +s;
  else return { ok: false, text: '3桁の数字（例 104）か、R を小数点とした表記（例 4R7）で入力してください。' };
  return { ok: true, text: `${fmtSI(pf * 1e-12, 'F')}（${pf.toLocaleString()} pF）`, pf };
}
const T_LOW = { X: -55, Y: -30, Z: 10 };
const T_HIGH = { 4: 65, 5: 85, 6: 105, 7: 125, 8: 150, 9: 200 };
const T_CHG = { P: '±10 %', R: '±15 %', S: '±22 %', T: '+22/−33 %', U: '+22/−56 %', V: '+22/−82 %' };
const C1_CODES = { C0G: '0 ± 30 ppm/℃（Class 1、JIS の CH 相当）', NP0: '0 ± 30 ppm/℃（C0G の旧称・通称）', C0H: '0 ± 60 ppm/℃', U2J: '−750 ± 120 ppm/℃', P2H: '−150 ± 60 ppm/℃', R2H: '−220 ± 60 ppm/℃', S2H: '−330 ± 60 ppm/℃', T2H: '−470 ± 60 ppm/℃', CH: '0 ± 60 ppm/℃（JIS）', B: 'JIS B 特性：−25〜+85 ℃で ±10 %', F: 'JIS F 特性：−25〜+85 ℃で +30/−80 %' };
export function tempCode(s) {
  s = String(s).trim().toUpperCase();
  if (!s) return null;
  if (C1_CODES[s]) return { ok: true, text: C1_CODES[s] };
  const m = s.match(/^([XYZ])(\d)([A-Z])$/);
  if (!m || T_HIGH[m[2]] == null || !T_CHG[m[3]]) return { ok: false, text: 'EIA の3文字（例 X7R、X5R、X6S、Y5V）や C0G を入力してください。' };
  return { ok: true, text: `Class 2：${T_LOW[m[1]]} 〜 +${T_HIGH[m[2]]} ℃で容量変化 ${T_CHG[m[3]]}（25 ℃基準、DC バイアスなし）`, low: T_LOW[m[1]], high: T_HIGH[m[2]] };
}
const V_CODES = { '0E': 2.5, '0G': 4, '0J': 6.3, '1A': 10, '1C': 16, '1E': 25, '1V': 35, '1H': 50, '1J': 63, '1K': 80, '2A': 100, '2D': 200, '2E': 250, '2H': 500, '2J': 630, '3A': 1000, '3D': 2000, '3F': 3150 };
export function voltCode(s) {
  s = String(s).trim().toUpperCase();
  if (!s) return null;
  if (V_CODES[s] == null) return { ok: false, text: `知らないコードです。主なコード：${Object.entries(V_CODES).slice(0, 12).map(([k, v]) => `${k}=${v}V`).join('、')}` };
  return { ok: true, text: `定格電圧 ${V_CODES[s]} V DC`, v: V_CODES[s] };
}
const TOL = { A: '±0.05 pF', B: '±0.1 pF', C: '±0.25 pF', D: '±0.5 pF', F: '±1 %', G: '±2 %', J: '±5 %', K: '±10 %', M: '±20 %', Z: '+80/−20 %', W: '±0.05 pF' };
export function tolCode(s) {
  s = String(s).trim().toUpperCase();
  if (!s) return null;
  return TOL[s] ? { ok: true, text: `容量公差 ${TOL[s]}${'ABCDW'.includes(s) ? '（小容量の Class 1 に使う絶対値の公差）' : ''}` } : { ok: false, text: '主な記号：B C D F G J K M Z' };
}
const SIZES = [['0201', '008004', '0.25×0.125'], ['0402', '01005', '0.4×0.2'], ['0603', '0201', '0.6×0.3'], ['1005', '0402', '1.0×0.5'], ['1608', '0603', '1.6×0.8'], ['2012', '0805', '2.0×1.25'], ['3216', '1206', '3.2×1.6'], ['3225', '1210', '3.2×2.5'], ['4532', '1812', '4.5×3.2'], ['5750', '2220', '5.7×5.0']];
export function sizeCode(s) {
  s = String(s).trim();
  if (!s) return null;
  const asM = SIZES.find(x => x[0] === s), asI = SIZES.find(x => x[1] === s);
  if (!asM && !asI) return { ok: false, text: `主なサイズ：${SIZES.map(x => x[0] + 'M').join('、')}` };
  const parts = [];
  if (asM) parts.push(`メトリック ${asM[0]} なら ${asM[2]} mm（インチ表記 ${asM[1]}）`);
  if (asI) parts.push(`インチ ${asI[1]} なら ${asI[2]} mm（メトリック表記 ${asI[0]}）`);
  return { ok: true, text: parts.join('<br>') + (asM && asI ? '<br><b>⚠ 同じ数字で別のサイズです。どちらの表記か確認しましょう。</b>' : '') };
}

export function renderTool(id, el) {
  (RENDER[id] || RENDER.cap)(el);
}
