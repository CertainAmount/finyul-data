#!/usr/bin/env node
// 연봉 구간별 월 실수령액 표 (work/annual-salary-take-home-table-3000-to-1eok-2026)
// 사용: node scripts/oneoff/annual-salary-table-calc.js [--json]
// calculators.js의 netpay 계산을 그대로 옮겼다(2026.7~ 요율, 10원 미만 절사, 간이세액표 별표 2 = gansei-2026.js).
// 가정: 연봉 = 월 고정급 x 12(퇴직금 별도, 상여·성과급 없음), 식대 월 20만 원 비과세 포함, 한 달 근무.
const fs = require('fs');
const path = require('path');
// 공개 저장소(finyul-data)에서는 gansei-2026.js가 이 파일 옆에 있다.
const GANSEI = [path.join(__dirname, 'gansei-2026.js'), path.join(__dirname, '../../wordpress/finyul-articles/assets/gansei-2026.js')].find((f) => fs.existsSync(f));
const src = fs.readFileSync(GANSEI, 'utf8');
const G = new Function('globalThis', src + '; return globalThis.FINYUL_GANSEI;')({});
const f10 = (x) => Math.floor(Math.round(x * 1e6) / 1e6 / 10) * 10;
const fmt = (n) => Math.round(n).toLocaleString('en-US');

function net(annual, { meal = 200000, fam = 1, kids = 0, pct = 100 } = {}) {
  const gross = annual / 12;
  const m = Math.min(meal, 200000), W = gross - m;
  const B = Math.min(Math.max(Math.floor(W / 1000) * 1000, 410000), 6590000);
  const np = f10(B * 475 / 10000);
  const hi = Math.min(f10(W * 719 / 10000 / 2), 4591740);
  const ltc = f10(hi * 9448 / 71900);
  const ei = W * 9 / 1000;
  const ins = np + hi + ltc + ei;
  const k = W / 1000;
  let table = 0;
  if (k === 10000) table = G.row10000[fam - 1];
  else if (k >= 770) table = G.rows.find((r) => k >= r[0] && k < r[1])[1 + fam];
  const ded = kids <= 0 ? 0 : kids === 1 ? 20830 : 45830 + 33330 * (kids - 2);
  const tax = Math.floor(Math.max(table - ded, 0) * pct / 100), local = Math.floor(tax / 10);
  const total = ins + tax + local;
  return { annual, gross, W, B, np, hi, ltc, ei, ins, table, tax, local, total, net: gross - total, rate: total / gross, capped: W >= 6590000 };
}
module.exports = { net, G };
let prevA = 0;
if (require.main === module) {
  const annuals = [30e6, 35e6, 40e6, 45e6, 50e6, 55e6, 60e6, 70e6, 80e6, 90e6, 100e6];
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(annuals.map((a) => net(a)), null, 1));
    process.exit(0);
  }
  console.log('## 기본(식대 20만, 부양가족 1, 자녀 0)');
  console.log('연봉 | 월 세전 | 국민연금 | 건강 | 장기요양 | 고용 | 4대보험 | 소득세 | 지방세 | 공제합계 | 월 실수령 | 공제율 | 국민연금 상한');
  for (const a of annuals) { const r = net(a); console.log([fmt(a), fmt(r.gross), fmt(r.np), fmt(r.hi), fmt(r.ltc), fmt(r.ei), fmt(r.ins), fmt(r.tax), fmt(r.local), fmt(r.total), fmt(r.net), (r.rate * 100).toFixed(2) + '%', r.capped ? '상한' : ''].join(' | ')); }
  console.log('\n## 부양가족 수별 월 실수령 (식대 20만, 자녀 0; 부양가족 3 자녀 1은 별도)');
  console.log('연봉 | 1명 | 2명 | 3명 | 4명 | 3명+8~20세자녀1 | 4명+자녀2');
  for (const a of annuals) console.log([fmt(a), fmt(net(a).net), fmt(net(a, { fam: 2 }).net), fmt(net(a, { fam: 3 }).net), fmt(net(a, { fam: 4 }).net), fmt(net(a, { fam: 3, kids: 1 }).net), fmt(net(a, { fam: 4, kids: 2 }).net)].join(' | '));
  console.log('\n## 식대 비과세 유무 (부양가족 1): 식대 0 vs 20만');
  console.log('연봉 | 식대 20만 실수령 | 식대 0 실수령 | 차이');
  for (const a of annuals) { const x = net(a), y = net(a, { meal: 0 }); console.log([fmt(a), fmt(x.net), fmt(y.net), fmt(x.net - y.net)].join(' | ')); }
  console.log('\n## 소득세 120%/80% 선택(부양가족 1)');
  for (const a of [30e6, 50e6, 100e6]) console.log([fmt(a), fmt(net(a, { pct: 120 }).net), fmt(net(a, { pct: 100 }).net), fmt(net(a, { pct: 80 }).net)].join(' | '));
  console.log('\n## 퇴직금 포함 연봉(13분할 가정): 월급 = 연봉/13 → 실수령(부양가족 1)');
  for (const a of annuals) { const x = net(a), y = net(a * 12 / 13); console.log([fmt(a), fmt(x.net), fmt(y.gross), fmt(y.net), fmt(x.net - y.net)].join(' | ')); }
  console.log('\n## 파생: 연봉÷12 대비 실수령 비율 / 소득세 비중 / 천만 원당 한계 증가 / 연금 상한 없는 가정 차이 / 가족1→3 차이');
  console.log('연봉 | 실수령÷월세전 | 소득세(지방세 포함)÷공제합계 | 전 구간 대비 실수령 증가 | 연금 상한 없을 때 추가 공제 | 가족1→3 차이');
  let prevNet = null;
  for (const a of annuals) {
    const r = net(a), W = r.W, noCap = f10(Math.floor(W / 1000) * 1000 * 475 / 10000), extra = noCap - r.np;
    console.log([fmt(a), (r.net / r.gross * 100).toFixed(2) + '%', ((r.tax + r.local) / r.total * 100).toFixed(1) + '%', prevNet === null ? '-' : fmt(r.net - prevNet) + ' (' + fmt((a - prevA) / 1e4) + '만 원 차)', fmt(extra), fmt(net(a, { fam: 3 }).net - r.net)].join(' | '));
    prevNet = r.net; prevA = a;
  }
  { const r = net(36e6); console.log('\n## 연봉 3,600만 = 월 300만 확인:', fmt(r.ins), fmt(r.tax), fmt(r.local), fmt(r.net)); }
  console.log('\n## 식대 20만이 연봉 밖에 따로 붙을 때(월 실수령 = 식대 0 계산 + 200,000) vs 연봉 안에 포함');
  console.log('연봉 | 포함(기본) | 별도 | 차이');
  for (const a of annuals) { const x = net(a).net, y = net(a, { meal: 0 }).net + 200000; console.log([fmt(a), fmt(x), fmt(y), fmt(y - x)].join(' | ')); }
  console.log('\n## 연금 상한 임계 연봉: 식대 20만 포함 =', fmt((6590000 + 200000) * 12), '/ 식대 없음 =', fmt(6590000 * 12));
  console.log('## 연봉 1억 가족 수별 월 실수령:', [1, 2, 3, 4].map((f) => fmt(net(1e8, { fam: f }).net)).join(' / '));
  console.log('\n## 국민연금 상한 월 659만 기준: W>=6,590,000이 되는 연봉 =', fmt((6590000 + 200000) * 12));
}
