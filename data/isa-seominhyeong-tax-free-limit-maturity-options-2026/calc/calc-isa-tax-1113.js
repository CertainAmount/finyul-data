// ISA 해지일 순이익별 세금 비교 (2026-11-13). 실행: node calc-isa-tax-1113.js
// 근거: 조특법 §91의18①② (비과세 200/400만, 초과 9% 분리과세), 지방세법 §103의13 (소득세의 10% => 9.9%),
// 일반 계좌 이자·배당 원천징수 14%+1.4%=15.4% (소득세법 §129, 가정: 금융소득종합과세 2천만 원 이하).
const floor = (x) => Math.floor(x);
const isa = (profit, limit) => floor(Math.max(0, profit - limit) * 0.099);
const normal = (profit) => floor(profit * 0.154);
const profits = [150, 300, 400, 500, 800, 1500].map((m) => m * 10000);
console.log('순이익 | 일반형 | 서민형 | 일반계좌15.4% | 서민형이 일반계좌보다 덜 낸 돈');
for (const p of profits) {
  const g = isa(p, 2000000), s = isa(p, 4000000), n = normal(p);
  console.log(`${p / 10000}만 | ${g} | ${s} | ${n} | ${n - s}`);
}
// 손익통산 예: 이익 700만, 같은 종류 손실 100만, 다른 종류 손실 100만, 보수 50만 => 순이익 450만
const gross = 7000000, loss = 2000000, fee = 500000;
const net = gross - loss - fee;
console.log('통산+보수 뒤 순이익', net, '일반형', isa(net, 2e6), '서민형', isa(net, 4e6), '손실·보수 안 뺀 세금(서민형)', isa(gross, 4e6));
// 서민형 한도(400만) 대비: 순이익이 한도를 넘는 순간부터 9.9%, 일반계좌 15.4%와의 교차 없음
// 연금계좌 전환 추가 세액공제 (소득세법 §59의3③④): 추가 납입한도 = min(전환금액*10%, 300만), 공제율 12%(15%)
for (const conv of [10000000, 30000000, 50000000]) {
  const add = Math.min(conv * 0.1, 3000000);
  console.log('전환', conv, '추가한도', add, '추가공제 12%', add * 0.12, '15%', add * 0.15);
}
