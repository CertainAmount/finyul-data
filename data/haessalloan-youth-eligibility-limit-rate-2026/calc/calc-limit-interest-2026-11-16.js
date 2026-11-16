// 햇살론유스 일반생활자금 이번 상한 표 + 금리 유형별 월 이자 (재현: node calc-limit-interest-2026-11-16.js)
// 규칙(서민금융진흥원 안내, s1·s2): 1회 일반생활 300 / 연간 600(신청일 기준 1년 이내 전체 보증금액 — 합산 방식은 가정) / 동일인 1,200(상환해도 재사용 불가)
const ONCE = 300, YEAR = 600, LIFE = 1200; // 만원
const cums = [0, 300, 600, 900, 1100, 1200];
const years = [0, 300, 600];
console.log('누적 이용액(만원) | 최근1년 이용액 | 연간 남은 | 평생 남은 | 이번 일반생활 상한 | 걸린 한도');
for (const c of cums) for (const y of years) {
  if (y > c) continue;
  const yl = Math.max(0, YEAR - y), ll = Math.max(0, LIFE - c);
  const cap = Math.min(ONCE, yl, ll);
  const who = [cap === ONCE ? '1회' : null, cap === yl ? '연간' : null, cap === ll ? '평생' : null].filter(Boolean).join('·');
  console.log(`${c} | ${y} | ${yl} | ${ll} | ${cap} | ${who}`);
}
console.log('\n금리 유형별 단순 월 이자(원금 × 연율 ÷ 12, 원 단위 반올림, 상환방식·수수료 무시)');
for (const p of [300, 900]) for (const [n, r] of [['일반 5.0%', 5.0], ['국민취업제도 성공자 4.5%', 4.5], ['사회적배려 2.0%', 2.0]]) {
  console.log(`${p}만원 ${n}: 월 ${Math.round(p * 10000 * r / 100 / 12).toLocaleString()}원, 연 ${Math.round(p * 10000 * r / 100).toLocaleString()}원`);
}
