/* Original CalcBox formulas, ported to browser JavaScript without React or DB calls. */
(() => {
  'use strict';
  const DAY = 86400000;
  const won = n => `${Math.round(n).toLocaleString('ko-KR')}원`;
  const hours = n => `${Math.round(n * 100) / 100}시간`;
  const parse = s => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    const [y, mo, d] = m.slice(1).map(Number);
    const t = Date.UTC(y, mo - 1, d), c = new Date(t);
    return c.getUTCFullYear() === y && c.getUTCMonth() + 1 === mo && c.getUTCDate() === d ? { y, mo, d, t } : null;
  };
  const iso = t => new Date(t).toISOString().slice(0, 10);
  const fmt = t => {
    const c = new Date(t);
    return `${c.getUTCFullYear()}년 ${c.getUTCMonth() + 1}월 ${c.getUTCDate()}일`;
  };
  const addMonths = (date, n) => {
    const first = new Date(Date.UTC(date.y, date.mo - 1 + n, 1));
    const y = first.getUTCFullYear(), mo = first.getUTCMonth() + 1;
    return Date.UTC(y, mo - 1, Math.min(date.d, new Date(Date.UTC(y, mo, 0)).getUTCDate()));
  };
  const models = {
    refinance(values) {
      // 대출 갈아타기 손익(2026-11-06): 잔액 일정·월 단위 근사. 비례 수수료면 남은 기간이 약분돼 "수수료율 < 금리차×약정/12"면 남는다.
      const [B, d, r, m, T] = values.slice(0, 5).map(Number), how = values[5], extra = Number(values[6]) || 0;
      if (![B, d, r, m, T].every(Number.isFinite) || B <= 0 || d <= 0 || r < 0 || m < 0 || T <= 0) return { warn: '잔액·금리차·약정 기간에 0보다 큰 숫자를 넣어 주세요.' };
      if (m >= T) return { warn: '지난 기간이 약정 기간 이상이면 중도상환수수료가 없어요. 금리차만 비교하면 돼요.' };
      const R = T - m, save = B * d / 100 * R / 12, fee = how === 'full' ? B * r / 100 : B * r / 100 * R / T, net = save - fee - extra;
      const man = n => `${n < 0 ? '−' : n > 0 ? '+' : ''}${Math.abs(Math.round(n)).toLocaleString('ko-KR')}만 원`;
      const line = how === 'full'
        ? (d > 0 && T - 12 * r / d > 0 ? `전액 방식: 지난 기간 약 ${Math.max(0, T - 12 * r / d).toFixed(1)}개월 전까지만 지금이 나아요` : '전액 방식: 수수료가 커서 지금 갈아타는 쪽이 남지 않아요')
        : `비례 방식 기준선: 수수료율 ${(d * T / 12).toFixed(2)}% 미만이면 남아요(지금 ${r}%)`;
      return {
        rows: [man(fee).replace('+', ''), man(save).replace('+', ''), man(net), net > 0 ? '지금 갈아타는 쪽이 남아요' : '약정 기간을 채우고 갈아타는 쪽이 더 남아요', line],
        tones: { 2: net > 0 ? 'total' : 'warn', 3: net > 0 ? 'ok' : 'warn' }
      };
    },
    breakeven(values) {
      const [paid, up] = values.map(Number);
      if (![paid, up].every(Number.isFinite) || paid <= 0 || up <= 0) return { warn: '두 칸에 0보다 큰 숫자를 넣어 주세요.' };
      return { rows: [won(up * 12), `약 ${(paid / (up * 12)).toFixed(1)}년`] };
    },
    weekly(values) {
      const [days, work, rest, wage] = values.map(Number);
      if (values.some(v => v === '') || ![days, work, rest, wage].every(Number.isFinite) || days < 1 || days > 7 || work <= rest || rest < 0 || wage <= 0) {
        return { warn: '근무일은 1~7일, 근무시간은 쉬는 시간보다 길게, 시급은 0보다 크게 넣어 주세요.' };
      }
      const daily = work - rest, weekly = daily * days, reach = weekly >= 15;
      const avg = weekly / (days < 5 ? 5 : days);
      return { rows: [hours(daily), hours(weekly), reach ? '넘어요 (대상)' : '못 미쳐요', hours(avg), reach ? won(wage * avg) : '15시간 미만이라 해당 없어요'], tones: { 2: reach ? 'ok' : 'warn' } };
    },
    unemployment(values) {
      const leave = parse(values[0]), days = Number(values[1]), daily = Number(values[2]), claim = parse(values[3]);
      if (!leave || !claim || ![120, 150, 180, 210, 240, 270].includes(days) || !Number.isFinite(daily) || daily <= 0) return { warn: '날짜와 하루 금액을 모두 넣어 주세요.' };
      const deadline = leave.t + (359 - days) * DAY;
      const late = Math.max(0, Math.round((claim.t - deadline) / DAY));
      return { rows: [iso(deadline), won(days * daily), late > 0 ? `${late}일 늦어요` : '마감 안이에요', late > 0 ? won(Math.min(late, days) * daily) : null], tones: { 2: late > 0 ? 'warn' : 'ok', 3: 'warn' } };
    },
    parental(values) {
      const [start, end, claim] = values.map(parse);
      if (!start || !end || !claim || end.t < start.t) return { warn: '세 날짜를 모두 넣어 주세요. 종료일은 시작일보다 늦어야 해요.' };
      const first = addMonths(start, 1), last = addMonths(end, 12) - DAY;
      const verdict = claim.t < first ? '아직 낼 수 없어요' : claim.t <= last ? '12개월 안이에요' : '안전하게 잡은 마지막 날을 넘겼어요(아래 30일 단서 확인)';
      return { rows: [iso(first), iso(Date.UTC(start.y, start.mo + 1, 0)), iso(Date.UTC(end.y, end.mo + 1, 0)), iso(last), verdict], tones: { 4: claim.t >= first && claim.t <= last ? 'ok' : 'warn' } };
    },
    nps(values) {
      const [income, months] = values.slice(0, 2).map(Number), month = values[2];
      if (!/^202[67]-\d{2}$/.test(month)) return { warn: '신청하는 달을 선택해 주세요.' };
      const [y, m] = month.split('-').map(Number), same = month === '2026-12' && values[3] === true;
      const due = new Date(Date.UTC(y, m + (same ? 0 : 1), 0));
      const rate = { 2026: 9.5, 2027: 10 }[due.getUTCFullYear()];
      if (!Number.isFinite(income) || !Number.isFinite(months) || income < 41 || income > 659 || months < 1 || months > 119 || !rate) return { warn: '기준소득월액은 41~659만원, 개월 수는 1~119 사이로 넣어 주세요.' };
      const pay = income * 10000 * rate / 100 * months;
      const diff = pay - income * 10000 * 0.095 * months;
      return { rows: [fmt(due.getTime()), `${rate}%`, won(pay), diff > 0 ? `${won(diff)} 더 내요` : '같아요'], tones: { 3: diff > 0 ? 'warn' : 'ok' } };
    },
    voucher(values) {
      const b = parse(values[0]), r = parse(values[1]);
      if (!b || !r) return { warn: '출생일과 기준일을 모두 넣어 주세요.' };
      if (b.mo === 2 && b.d === 29) return { warn: '2월 29일생은 사업안내에 계산 기준이 없어 이 계산기가 계산하지 않아요.' };
      if (b.y < 2024) return { warn: '2024년 1월 1일 전에 태어난 아이는 사용기한이 달라서 이 계산기 대상이 아니에요.' };
      const last = Date.UTC(b.y + 2, b.mo - 1, b.d) - DAY, left = Math.round((last - r.t) / DAY);
      return { rows: [fmt(last), `${fmt(last + DAY)} 0시`, left > 0 ? `${left}일` : left === 0 ? '기준일이 마지막 날이에요' : '이미 소멸로 계산돼요'], tones: { 2: left > 0 ? 'ok' : 'warn' } };
    },
    cartax(values) {
      // 비영업용 승용차, 2026년 과세. 지방세법 제127조(세율·차령 경감), 시행령 제122조(차령), 제128조·시행령 제125조(연납), 10원 미만 절사
      const cc = Number(values[0]), year = Number(values[1]), late = values[2] === '7-12', pay = values[3];
      if (!Number.isInteger(cc) || cc < 50 || cc > 9999) return { warn: '배기량을 cc 단위 숫자로 넣어 주세요(예: 1598).' };
      if (!Number.isInteger(year) || year < 1980 || year > 2026) return { warn: '차령 기산 연도를 1980~2026 사이로 넣어 주세요.' };
      const cut = n => Math.floor(n / 10) * 10;
      const rate = cc <= 1000 ? 80 : cc <= 1600 ? 140 : 200;
      const age2 = 2026 - year + 1, age1 = late ? age2 - 1 : age2;
      const half = n => { const h = rate * cc / 2, k = n >= 3 ? Math.min(n, 12) - 2 : 0; return cut(h - h * 5 * k / 100); };
      if (age1 < 1) return { warn: '2026년 7월 이후에 기산하는 차는 제2기분만 나와서 이 계산기 대상이 아니에요.' };
      const k1 = half(age1), k2 = half(age2), car = k1 + k2, edu = cut(k1 * 0.3) + cut(k2 * 0.3);
      const off = { 1: car * 334 / 365 * 0.05, 3: car * 275 / 365 * 0.05, 6: k2 * 0.05, 9: k2 * 92 / 184 * 0.05 }[pay];
      const disc = n => n >= 3 ? `${(Math.min(n, 12) - 2) * 5}% 경감` : '경감 없음';
      const ages = age1 === age2 ? `${age2}년차 · ${disc(age2)}` : `1기 ${age1}년차 · 2기 ${age2}년차`;
      return {
        rows: [`${rate}원`, ages, won(car), won(edu), won(car + edu), off == null ? null : `약 ${won(cut(off))}`],
        tones: { 4: 'total', 5: 'ok' }
      };
    },
    simplevat(values) {
      // 개인사업자 간이과세 판정. 부가가치세법 제61조(기준 1억 400만 원, 부동산임대업·과세유흥장소 4,800만 원), 제36조(세금계산서), 시행령 제109조
      const rental = values[0] === 'rental', year = Number(values[1]);
      if (values[1] === '' || !Number.isFinite(year) || year < 0) return { warn: '작년 1년 매출 합계를 만 원 단위 숫자로 넣어 주세요.' };
      const man = n => `${n.toLocaleString('ko-KR')}만 원`;
      const month = year / 12, monthText = Number.isInteger(month) ? man(month) : `약 ${man(Math.round(month * 10) / 10)}`;
      const limit = rental ? 4800 : 10400, over = year >= limit;
      const limitText = rental ? '4,800만 원 미만' : '1억 400만 원 미만';
      const invoice = over ? '일반과세자가 되면 세금계산서 발급' : year < 4800 ? '영수증만 발급(세금계산서 발급 불가)' : '세금계산서 발급 대상';
      return {
        rows: [monthText, limitText, over ? '기준 이상, 다음 7월 1일부터 일반과세 대상' : '기준 미만, 간이과세 유지(배제 업종·지역이 아니면)', invoice],
        tones: { 2: over ? 'warn' : 'ok' }
      };
    },
    dcfee(values) {
      // DC 퇴직연금 비용 3층: 사업자 운용·자산관리수수료(적립금 기준) + ETF 총보수(보유액 기준) + 매매 수수료(거래액 기준). 수익률은 넣지 않는다.
      const v = values.map(Number);
      if (v.some(n => !Number.isFinite(n) || n < 0)) return { warn: '빈칸 없이 0 이상의 숫자로 넣어 주세요.' };
      const [balance, mgmt, admin, etf, ter, trades, perTrade, fee] = v;
      if (balance <= 0) return { warn: '적립금을 만 원 단위로 넣어 주세요.' };
      if (etf > balance) return { warn: 'ETF 보유액이 적립금보다 클 수 없어요.' };
      const a = balance * (mgmt + admin) * 100, b = etf * ter * 100, c = trades * perTrade * fee * 100, total = a + b + c;
      const pct = n => `${(Math.round(n / (balance * 10000) * 100000) / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}%`;
      return { rows: [won(a), won(b), won(c), won(total), `${pct(total)} (사업자·상품만 ${pct(a + b)})`], tones: { 3: 'total' } };
    },
    dclimit(values) {
      // DC·IRP 위험자산 70% 한도 여유. 승인 TDF 등 70% 한도 예외 상품은 이 계산에 넣지 않는다.
      const [balance, held, add] = values.map(Number);
      if (![balance, held, add].every(n => Number.isFinite(n) && n >= 0) || balance <= 0) return { warn: '적립금·보유액·추가 금액을 만 원 단위 숫자로 넣어 주세요.' };
      if (held > balance) return { warn: '위험자산 보유액이 적립금보다 클 수 없어요.' };
      const man = n => `${Math.round(n).toLocaleString('ko-KR')}만 원`;
      const cap = balance * 0.7, room = Math.max(0, cap - held), over = held + add > cap;
      return {
        rows: [man(cap), man(room), over ? `한도 초과 (${man(held + add - cap)} 넘음)` : '한도 안이에요'],
        tones: { 2: over ? 'warn' : 'ok' }
      };
    },
    hilatefee(values) {
      // 건강보험료 연체금(국민건강보험법 제80조): 30일까지 1,500분의 1×일수, 31일부터 6,000분의 1씩 더해 합계 5% 상한(210일). 원 단위 반올림 근사.
      const [fee, days] = values.map(Number);
      if (values.some(v => v === '') || !Number.isFinite(fee) || fee <= 0 || !Number.isInteger(days) || days < 1) return { warn: '월 보험료(원)와 납부기한 뒤 지난 일수(1 이상 정수)를 넣어 주세요.' };
      const rate = days <= 30 ? days / 1500 : 0.02 + Math.min(days - 30, 180) / 6000, late = Math.round(fee * rate);
      return { rows: [`${(rate * 100).toFixed(2).replace(/\.?0+$/, '')}%${days >= 210 ? ' (상한)' : ''}`, won(late), won(fee + late)], tones: { 1: 'total' } };
    },
    aircancel(values) {
      // 항공권 취소 환불액: 결제액 − 공제. "수수료가 운임보다 크면 운임까지만" 문구가 있는 항공사(이스타·제주·진에어 안내문)는 공제 = min(표 수수료, 낸 운임). 금액은 모두 독자가 넣은 값.
      const [paid, fare, fee] = values.slice(0, 3).map(Number), capped = values[3] === 'yes';
      if (values.slice(0, 3).some(v => v === '') || ![paid, fare, fee].every(Number.isFinite) || paid <= 0 || fare < 0 || fee < 0) return { warn: '결제 총액·항공운임·표 수수료를 숫자로 넣어 주세요.' };
      if (fare > paid) return { warn: '항공운임은 결제 총액보다 클 수 없어요. 영수증의 운임 줄을 넣어 주세요.' };
      const raw = paid - fee, cut = Math.min(fee, fare), back = paid - cut, pct = `${(back / paid * 100).toFixed(1)}%`;
      const rawRow = `${raw < 0 ? '−' : ''}${won(Math.abs(raw))}${raw < 0 ? ' (0원 아래)' : ''}`;
      const verdict = fee > fare ? '표 수수료가 낸 운임보다 커서 공제가 운임에서 멈춰요' : '표 수수료가 운임보다 작아 표 그대로 빠져요';
      if (capped) return { rows: [rawRow, won(cut), won(back), pct, verdict], tones: raw < 0 ? { 0: 'warn', 2: 'total' } : { 2: 'total' } };
      if (fee <= fare) return { rows: [rawRow, won(fee), won(raw), `${(raw / paid * 100).toFixed(1)}%`, verdict], tones: { 2: 'total' } };
      return { rows: [rawRow, `표 그대로 ${won(fee)} · 운임까지만 ${won(cut)}`, `운임까지만이면 ${won(back)}`, `운임까지만이면 ${pct}`, '안내문에 운임 상한 문구가 있는지 항공사에 확인해야 해요'], tones: { 0: 'warn', 4: 'warn' } };
    },
    dutyfree(values) {
      // 여행자 휴대품 세금(관세청고시 제25조·관세법 시행령 별표2·관세법 제96조②·제241조⑤): 800달러 공제 → 간이세율 → 자진신고 30%(20만 원 상한) / 미신고 가산세 40%(2년 내 2회 이상 징수면 60%). 절사·소액 징수면제는 넣지 않은 근사.
      const [usd, rate, fx] = values.slice(0, 3).map(Number);
      if (values.slice(0, 3).some(v => v === '') || !Number.isFinite(usd) || usd < 0 || !Number.isFinite(fx) || fx <= 0) return { warn: '구매액(달러)과 환율(원)을 숫자로 넣어 주세요.' };
      const over = Math.max(0, usd - 800);
      if (!over) return { rows: ['0달러 (800달러 이하)', '0원', '0원', '0원', '신고 대상이 아니에요', '0원', '0원', '0원'], tones: { 4: 'ok' } };
      const krw = over * fx, tax = krw * rate / 100, cut = Math.min(tax * 0.3, 200000), heavy = values[3] === 'yes';
      return {
        rows: [`${over.toLocaleString('ko-KR')}달러`, won(krw), won(tax), `${won(cut)}${tax * 0.3 > 200000 ? ' (20만 원 상한)' : ''}`, won(tax - cut), won(tax * (heavy ? 0.6 : 0.4)), won(tax * (heavy ? 1.6 : 1.4)), `${(tax * (heavy ? 1.6 : 1.4) / (tax - cut)).toFixed(2)}배`],
        tones: { 4: 'total', 6: 'warn' }
      };
    },
    wagearrears(values) {
      // 간이대지급금 임금 몫: 최종 3개월분, 임금 항목 상한 700만 원(근로복지공단 안내). 평균임금·상여·수당은 넣지 않은 근사값.
      const [pay, months] = values.map(Number);
      if (values.some(v => v === '') || !Number.isFinite(pay) || pay <= 0 || !Number.isInteger(months) || months < 1 || months > 12) return { warn: '월급(원)과 밀린 개월(1~12)을 숫자로 넣어 주세요.' };
      const due = pay * Math.min(months, 3), paid = Math.min(due, 7000000);
      return { rows: [won(due), won(paid), won(due - paid)], tones: { 1: 'ok', 2: due > paid ? 'warn' : 'ok' } };
    },
    retiretax(values) {
      // 퇴직소득세(소득세법 제48·55조): 근속연수공제 → ×12÷근속 → 환산급여공제 → 기본세율 → ÷12×근속. 단위 만원. 이전 근속·정산은 넣지 않는다.
      const [P, y, irp] = values.map(Number);
      if (values[0] === '' || !Number.isFinite(P) || P < 100 || P > 1000000) return { warn: '퇴직금을 만 원 단위로 100~1,000,000 사이에서 넣어 주세요.' };
      if (!Number.isInteger(y) || y < 1 || y > 50) return { warn: '근속연수를 1~50 사이 정수로 넣어 주세요. 1년 미만 기간은 1년으로 올려 넣어 주세요.' };
      const dep = values[2] === '' ? 0 : irp;
      if (!Number.isFinite(dep) || dep < 0 || dep > P) return { warn: '연금계좌 입금액은 0 이상, 퇴직금 이하로 넣어 주세요.' };
      const sd = Math.min(P, y <= 5 ? 100 * y : y <= 10 ? 500 + 200 * (y - 5) : y <= 20 ? 1500 + 250 * (y - 10) : 4000 + 300 * (y - 20));
      const conv = (P - sd) * 12 / y;
      const cd = conv <= 800 ? conv : conv <= 7000 ? 800 + (conv - 800) * 0.6 : conv <= 10000 ? 4520 + (conv - 7000) * 0.55 : conv <= 30000 ? 6170 + (conv - 10000) * 0.45 : 15170 + (conv - 30000) * 0.35;
      const base = Math.max(conv - cd, 0);
      const brackets = [[1400, 0, 0, 0.06], [5000, 84, 1400, 0.15], [8800, 624, 5000, 0.24], [15000, 1536, 8800, 0.35], [30000, 3706, 15000, 0.38], [50000, 9406, 30000, 0.4], [100000, 17406, 50000, 0.42], [Infinity, 38406, 100000, 0.45]];
      const [, add, from, r] = brackets.find(b => base <= b[0]);
      const tax = (add + (base - from) * r) / 12 * y;
      const deferred = tax * dep / P, nowTax = (tax - deferred) * 1.1;
      const m = n => won(n * 10000);
      const pct = `${(Math.round(tax / P * 10000) / 100).toFixed(2)}%`;
      const note = deferred > 0 ? `이연퇴직소득세 ${m(deferred)}은 연금외수령 때 원천징수돼요` : sd >= P ? '퇴직금이 근속연수공제보다 적어 세금이 0이에요' : '지방소득세는 소득세의 10%로 따로 붙어요';
      return {
        rows: [m(sd), m(conv), m(cd), m(base), m(tax), pct, m(tax * 0.1), m(nowTax), m(P - tax * 1.1), note],
        tones: { 4: 'total', 9: 'warn' }
      };
    },
    brokerage(values) {
      // 중개보수 상한(공인중개사법 시행규칙 제20조, 별표 1·2): min(거래금액×요율, 한도액). 요율은 구간 전체 금액에 곱한다(누진 아님). 단위 만원.
      const [kind, item, amountRaw, rentRaw, vat] = values;
      const deposit = Number(amountRaw), rent = kind === 'wolse' ? Number(rentRaw || 0) : 0;
      if (!Number.isFinite(deposit) || deposit <= 0 || !Number.isFinite(rent) || rent < 0) return { warn: '금액을 만원 단위 숫자로 넣어 주세요.' };
      if (kind === 'wolse' && rent <= 0) return { warn: '월세를 만원 단위로 넣어 주세요.' };
      let A = deposit, x70 = false;
      if (kind === 'wolse') { A = deposit + rent * 100; if (A < 5000) { A = deposit + rent * 70; x70 = true; } }
      let r, L = null;
      if (item === 'officetel') r = kind === 'sale' ? 5 : 4;
      else if (item === 'officetel-other') r = 9;
      else if (kind === 'sale') [r, L] = A < 5000 ? [6, 25] : A < 20000 ? [5, 80] : A < 90000 ? [4, null] : A < 120000 ? [5, null] : A < 150000 ? [6, null] : [7, null];
      else [r, L] = A < 5000 ? [5, 20] : A < 10000 ? [4, 30] : A < 60000 ? [3, null] : A < 120000 ? [4, null] : A < 150000 ? [5, null] : [6, null];
      const raw = A * r / 1000, cap = L == null ? raw : Math.min(raw, L);
      const man = n => `${(Math.round(n * 1000) / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 3 })}만원`;
      const limit = L == null ? '없음' : raw > L ? `${man(L)} 적용 (곱한 값 ${man(raw)})` : `${man(L)} (안 걸림)`;
      return {
        rows: [`${man(A)}${x70 ? ' (합이 5천만원 미만이라 월세에 70을 곱했어요)' : ''}`, `${r / 10}%`, limit, man(cap), vat === 'vat10' ? man(cap * 1.1) : null],
        tones: { 2: L != null && raw > L ? 'warn' : undefined, 3: 'total' }
      };
    },
    mortgagelimit(values) {
      // 구입 주담대 한도 = LTV(보증금 차감)·금액 상한(수도권·규제지역 6/4/2억)·DSR 40%(스트레스 가산 금리, 원리금균등) 중 가장 낮은 값.
      // LTV·상한·가산 폭은 금융당국 발표 값을 사용자가 넣는다. 은행 자체 한도·DSR 1억 이하 예외는 넣지 않는다.
      const [price, region, ltv, deposit, income, existing, rate, stress, years] = values.map((v, i) => (i === 1 ? v : Number(v)));
      if (![price, ltv, deposit, income, existing, rate, stress, years].every(Number.isFinite) || price <= 0 || income <= 0 || ltv < 0 || ltv > 100 || deposit < 0 || existing < 0 || rate <= 0 || stress < 0 || !Number.isInteger(years) || years < 1 || years > 50) {
        return { warn: '시세·연소득은 만 원 단위, LTV·금리는 %, 만기는 1~50년 숫자로 넣어 주세요.' };
      }
      const eok = man => { man = Math.max(0, Math.round(man)); const e = Math.floor(man / 10000), r = man % 10000; return e ? `${e}억${r ? ` ${r.toLocaleString('ko-KR')}만` : ''} 원` : `${r.toLocaleString('ko-KR')}만 원`; };
      const byLtv = Math.max(0, price * ltv / 100 - deposit);
      const cap = region === 'capital' ? (price <= 150000 ? 60000 : price <= 250000 ? 40000 : 20000) : Infinity;
      const yearly = income * 0.4 - existing, i = (rate + stress) / 100 / 12, n = years * 12;
      const byDsr = yearly <= 0 ? 0 : (yearly / 12) * (1 - Math.pow(1 + i, -n)) / i;
      const limit = Math.min(byLtv, cap, byDsr);
      const who = limit === byDsr ? 'DSR(소득)' : limit === cap ? '금액 상한' : 'LTV(집값)';
      const i0 = rate / 100 / 12, monthly = limit * 10000 * i0 / (1 - Math.pow(1 + i0, -n));
      return {
        rows: [eok(byLtv), cap === Infinity ? '적용 안 돼요' : eok(cap), eok(byDsr), eok(limit), `${who}에서 막혀요`, won(monthly)],
        tones: { 3: 'total', 4: 'warn' }
      };
    },
    twdroute(values) {
      // 대만달러: 원화로 바로 사기 vs 달러로 사서 대만에서 다시 바꾸기. 공시 수수료율(우대 전)×(1−우대율), 기준은 같은 원/TWD 교차환율.
      const [krw, usd, mid, buy, fee1, pref1, fee2, pref2, extra] = values.map(Number);
      if (![krw, usd, mid, buy, fee1, pref1, fee2, pref2, extra].every(n => Number.isFinite(n) && n >= 0) || krw <= 0 || usd <= 0 || mid <= 0 || buy <= 0 || pref1 > 100 || pref2 > 100 || extra >= 100) {
        return { warn: '빈칸 없이 0 이상의 숫자로 넣어 주세요. 우대율은 0~100%예요.' };
      }
      const t = n => `${Math.round(n).toLocaleString('ko-KR')} TWD`;
      const W = krw * 10000, X = usd / mid;
      const direct = W / (X * (1 + fee1 / 100 * (1 - pref1 / 100)));
      const viaRaw = W / (usd * (1 + fee2 / 100 * (1 - pref2 / 100))) * buy;
      const via = viaRaw * (1 - extra / 100), gap = via - direct;
      const edge = (1 - direct / viaRaw) * 100;
      return {
        rows: [`${X.toFixed(2)}원`, t(W / X), t(direct), t(via), gap >= 0 ? `달러 경유가 ${t(gap)} 더 남아요` : `직환전이 ${t(-gap)} 더 남아요`, edge > 0 ? `대만 쪽 추가 비용이 ${edge.toFixed(2)}%를 넘으면 직환전이 유리해요` : '이 조건에서는 직환전이 이미 유리해요'],
        tones: { 4: gap >= 0 ? 'ok' : 'warn' }
      };
    },
    eurroute(values) {
      // 유로: 내 경로(공시 수수료율×(1−우대율))로 사서 되팔기, 공항 현장(4.5%·우대 0)과 비교. 기준은 같은 매매기준율.
      const [krw, mid, fee, pref, sfee, spref] = values.map(Number);
      if (![krw, mid, fee, pref, sfee, spref].every(n => Number.isFinite(n) && n >= 0) || krw <= 0 || mid <= 0 || pref > 100 || spref > 100 || sfee >= 100) {
        return { warn: '빈칸 없이 0 이상의 숫자로 넣어 주세요. 우대율은 0~100%예요.' };
      }
      const e = n => `${n.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}유로`;
      const W = krw * 10000;
      const mine = W / (mid * (1 + fee / 100 * (1 - pref / 100)));
      const airport = W / (mid * 1.045), gap = mine - airport;
      const back = mine * mid * (1 - sfee / 100 * (1 - spref / 100));
      return {
        rows: [e(W / mid), e(mine), e(airport), gap >= 0 ? `${e(gap)} 더 받아요(약 ${won(gap * mid)})` : `${e(-gap)} 덜 받아요(약 ${won(-gap * mid)})`, won(back), `${((1 - back / W) * 100).toFixed(2)}%`],
        tones: { 1: 'total', 5: 'warn' }
      };
    },
    fourins(values) {
      // 4대보험 근로자·회사 몫(산재 제외). 연금은 기준소득월액(천 원 미만 버림, 41만~659만)×요율, 건강은 보수×7.19%÷2, 장기요양은 건강 근로자 몫×0.9448/7.19, 모두 10원 미만 버림. 고용은 버림 규칙 미확인이라 표시만 반올림.
      const pay = Number(values[0]), y2027 = values[1] === '2027', stab = Number(values[2]), gov = y2027 && values[3] === true;
      if (!Number.isFinite(pay) || pay < 280000 || pay > 100000000) return { warn: '월 보수는 28만~1억 원 사이 숫자로 넣어 주세요. 28만 원 미만은 건강보험 하한이 걸려요.' };
      const f10 = x => Math.floor(Math.round(x * 1e6) / 1e6 / 10) * 10;
      const B = Math.min(Math.max(Math.floor(pay / 1000) * 1000, 410000), 6590000);
      const pension = f10(B * (y2027 ? 500 : 475) / 10000);
      const health = Math.min(f10(pay * 719 / 10000 / 2), 4591740);
      const ltc = f10(health * 9448 / 71900);
      const ue = gov ? 1.0 : 0.9;
      const emp = pay * ue / 100;
      const total = pension + health + ltc + emp;
      const boss = pension + health + ltc + pay * (ue + stab) / 100;
      return {
        rows: [won(pension), won(health), won(ltc), won(emp), won(total), `${(total / pay * 100).toFixed(3)}%`, `약 ${won(boss)}`,
          pay > 6590000 ? '국민연금은 상한(659만 원 기준)에서 멈춰요' : B !== pay ? `국민연금은 기준소득월액 ${won(B)} 기준이에요` : null,
          y2027 ? `국민연금 5.0%만 확정이에요. 건강 7.19%는 위원회 의결, 장기요양은 2027 요율 미발표라 지금 요율로 가정했어요${gov ? '. 고용 1.0%는 정부 개편 방안(미확정)이에요' : ''}` : null,
          pay < 2700000 && stab === 0.25 ? '10명 미만 사업장 신규 가입자는 두루누리로 국민연금·고용보험 80% 지원 대상일 수 있어요' : null],
        tones: { 4: 'total', 8: 'warn' }
      };
    },
    giftax(values) {
      // 증여세(현금, 같은 증여자): 10년 합산(이전 합 1천만 원 이상) → 관계별 공제 → 과세표준(50만 원 미만 0) → 누진세율 → 세대생략 할증 30%(미성년·20억 초과 40%) → 기한 내 신고 3%.
      const amt = Number(values[0]) * 10000, rel = values[1], skip = values[2] === true && rel.startsWith('asc'), prior = Number(values[3] || 0) * 10000, ontime = values[4] === true;
      if (!(amt > 0) || !Number.isFinite(prior) || prior < 0) return { warn: '이번 증여액과 이전 증여액을 만 원 단위 숫자로 넣어 주세요.' };
      const ded = { asc_adult: 50000000, asc_minor: 20000000, spouse: 600000000, other: 10000000 }[rel];
      const base = amt + (prior >= 10000000 ? prior : 0);
      if (prior > ded) return { warn: '이전 증여가 공제 한도를 넘었다면 그때 낸 세금을 빼는 계산(상속세및증여세법 제58조)이 필요해 이 계산기로는 정확히 못 구해요. 홈택스 모의계산이나 세무서에 확인해 주세요.' };
      const used = Math.min(ded, base);
      let tb = base - used; if (tb < 500000) tb = 0;
      const B = [[1e8, 0.1, 0], [5e8, 0.2, 1e7], [1e9, 0.3, 6e7], [3e9, 0.4, 1.6e8], [Infinity, 0.5, 4.6e8]];
      const [, rate, minus] = B.find(([cap]) => tb <= cap);
      const tax = Math.max(0, Math.floor(tb * rate - minus));
      const sur = skip ? Math.floor(tax * (rel === 'asc_minor' && amt > 2e9 ? 0.4 : 0.3)) : 0;
      const credit = ontime ? Math.floor((tax + sur) * 0.03) : 0;
      const pay = tax + sur - credit;
      const note = pay > 20000000 ? `분납은 ${won(Math.floor(pay / 2))}까지(기한 뒤 2개월 안), 연부연납은 허가·담보가 필요해요(둘 중 하나)` : pay > 10000000 ? `분납은 ${won(pay - 10000000)}까지(기한 뒤 2개월 안) 가능해요` : null;
      return {
        rows: [won(base), won(used), tb ? `${won(tb)} (세율 ${rate * 100}% 구간)` : '0원(과세 안 함)', won(tax), sur ? won(sur) : null, credit ? `-${won(credit)}` : ontime ? null : '0원 (기한 뒤 신고)', won(pay), `${(pay / amt * 100).toFixed(1)}%`, note],
        tones: { 4: 'warn', 5: ontime ? 'ok' : 'warn', 6: 'total' }
      };
    },
    usedcar(values) {
      // 중고차 법정 비용: 과표 = max(거래가, 시가표준액) → 취득세 7%(경형 4%, 75만 원까지 감면·2027-12-31 취득분까지) + 공채(서울 1,000~1,600cc 미만 0, 부산 1,600cc 미만 0·이상 과표 4% 매입) + 수수료·인지. 업자 항목은 넣지 않는다.
      const price = Number(values[0]) * 10000, std = Number(values[1] || 0) * 10000, light = values[2] === 'light', region = values[3], cc = values[4];
      const disc = values[5] === '' ? null : Number(values[5]), far = values[6] === true;
      if (!(price > 0) || !Number.isFinite(std) || std < 0 || (disc != null && !(disc >= 0 && disc <= 100))) return { warn: '거래가는 만 원 단위 숫자로, 공채 할인율은 0~100 사이로 넣어 주세요.' };
      const base = Math.max(price, std);
      const raw = Math.round(base * (light ? 0.04 : 0.07));
      const relief = light ? Math.min(raw, 750000) : 0;
      const tax = raw - relief;
      let bond = null, bondCost = 0;
      if (cc === 'lt1000' && light) bond = '경형은 공채 대상이 아니에요';
      else if (region === 'seoul') bond = cc === 'ge1600' ? '서울 1,600cc 이상은 매입 대상이에요(금액은 차량등록사업소에서 확인, 합계에서 뺐어요)' : '0원(서울 1,600cc 미만 면제, 2028년 말까지)';
      else if (region === 'busan') {
        if (cc !== 'ge1600') bond = '0원(부산 1,600cc 미만 면제)';
        else { const buy = Math.round(base * 0.04); bondCost = disc == null ? 0 : Math.round(buy * disc / 100); bond = disc == null ? `매입액 ${won(buy)} — 할인율을 넣으면 실제로 나가는 돈이 나와요` : `매입액 ${won(buy)} → 바로 팔면 약 ${won(bondCost)} 부담`; }
      } else bond = '시·도 조례마다 달라요(합계에서 뺐어요)';
      const fee = (far ? 1500 : 1000) + 3000;
      return {
        rows: [`${won(base)}${std > price ? ' (시가표준액이 거래가보다 높아 이걸로 계산)' : ''}`, won(raw), light ? `-${won(relief)}` : null, won(tax), bond, won(fee), won(tax + bondCost + fee),
          std ? null : '시가표준액을 비워 두면 거래가로만 계산해요. 시가표준액이 더 높으면 세금도 올라가요'],
        tones: { 6: 'total', 7: 'warn' }
      };
    },
    'yearend-card-threshold'(values) {
      // 카드 소득공제(조특법 제126조의2): 문턱 = 총급여 25%, 신용(15%)부터 문턱을 채우고 체크·현금영수증(30%). 만 원 단위, 소득세 15% 가정.
      const [pay, cr, db, cr2, db2] = values.map(v => v === '' ? 0 : Number(v));
      if (!(pay > 0) || ![cr, db, cr2, db2].every(v => Number.isFinite(v) && v >= 0)) return { warn: '총급여는 0보다 크게, 사용액은 0 이상의 만 원 단위 숫자로 넣어 주세요.' };
      const man = x => `${(Math.round(x * 10) / 10).toLocaleString('ko-KR')}만 원`;
      const limit = pay <= 7000 ? 300 : 250;
      let th = pay * 0.25, c = cr + cr2, d = db + db2;
      const left = th - (cr + db);
      let u = Math.min(c, th); c -= u; th -= u;
      u = Math.min(d, th); d -= u;
      const ded = Math.min(limit, c * 0.15 + d * 0.30);
      return {
        rows: [man(pay * 0.25), left > 0 ? man(left) : '문턱을 넘었어요', ded >= limit ? `${man(ded)}(한도)` : man(ded), ded > 0 ? `약 ${Math.round(ded * 0.15).toLocaleString('ko-KR')}만 원` : '0원(문턱을 넘어야 공제가 시작돼요)'],
        tones: { 3: 'total' }
      };
    },
    loan(values) {
      // 일반 대출 상환·중도상환수수료: 월 이자 = 잔액×연금리÷12(일할계산 없음). 상환 뒤 기간 유지(월 부담 감소). 수수료는 3년 부과기간 남은 개월 비율로 근사.
      const v = values.map(x => x === '' ? NaN : Number(x));
      const P = v[0] * 10000, rate = v[1], n = values[3] === 'month' ? v[2] : v[2] * 12, method = values[5];
      let g = values[4] === '' ? 0 : v[4];
      const k = values[6] === '' ? 0 : v[6], A0 = values[7] === '' ? 0 : v[7] * 10000, f = values[8] === '' ? 0 : v[8], d = values[9] === '' ? 0 : v[9];
      if (!(P > 0) || !(rate >= 0) || !Number.isInteger(n) || n < 1 || n > 720 || !Number.isInteger(g) || g < 0 || !Number.isInteger(k) || k < 0 || !(A0 >= 0) || !(f >= 0) || !Number.isFinite(d) || rate + d < 0) {
        return { warn: '대출금(만 원)·금리(%)·기간을 숫자로, 거치·상환 시점은 0 이상의 정수 개월로 넣어 주세요.' };
      }
      if (method === 'bullet') g = 0;
      else if (g >= n) return { warn: '거치기간은 기간보다 짧아야 해요.' };
      const sched = (rt, pre) => {
        const r = rt / 100 / 12;
        let bal = P, tot = 0, balK = null;
        const pays = [];
        for (let i = 1; i <= n; i++) {
          const it = bal * r;
          tot += it;
          let pr;
          if (method === 'bullet') pr = i === n ? bal : 0;
          else if (i <= g) pr = 0;
          else {
            const m = n - i + 1;
            pr = method === 'equal' ? (r ? bal * r / (1 - Math.pow(1 + r, -m)) - it : bal / m) : bal / m;
          }
          bal -= pr;
          pays.push(it + pr);
          if (pre && i === pre.k) { balK = bal; bal -= Math.min(pre.A, bal); }
        }
        return { pays, tot, balK };
      };
      const base = sched(rate), up = sched(rate + d);
      const sign = x => `${x >= 0 ? '+' : '-'}${won(Math.abs(x))}`;
      let fee = 0, sav = 0, capped = null;
      if (k > 0 && k < n && A0 > 0) {
        const pre = sched(rate, { k, A: A0 });
        const A = Math.min(A0, pre.balK);
        if (A < A0) capped = pre.balK;
        sav = base.tot - pre.tot;
        fee = k >= 36 || n - k < 3 ? 0 : A * f / 100 * (36 - k) / 36;
      }
      return {
        rows: [won(base.pays[0]), g > 0 ? won(base.pays[g]) : '-', won(base.tot), sign(up.pays[0] - base.pays[0]), sign(up.tot - base.tot), won(fee), won(sav),
          capped != null ? `${won(sav - fee)} (갚을 금액이 그때 잔액 ${won(capped)}보다 커서 잔액만큼으로 계산)` : won(sav - fee)],
        tones: { 7: 'total' }
      };
    },
    leavepay(values) {
      // 연차수당 = 월 통상임금 ÷ 월 소정근로시간 × 하루 소정근로시간 × 남은 일수(근로기준법 시행령 제6조). 중간 반올림 없음.
      const n = i => values[i] === '' ? 0 : Math.max(0, Number(values[i]));
      const monthly = n(0), mh = Number(values[1]), dh = Number(values[2]), days = n(3), used = n(6);
      if (!(mh > 0) || !(dh > 0)) return { warn: '소정근로시간은 0보다 커야 해요.' };
      if (![monthly, days, used].every(Number.isFinite)) return { warn: '숫자로 넣어 주세요.' };
      const hourly = monthly / mh, daily = hourly * dh, total = daily * days;
      const num = x => (Math.round(x * 100) / 100).toLocaleString('ko-KR');
      const rows = [`${num(hourly)}원`, won(daily), won(total), `${num(monthly)} ÷ ${num(mh)} × ${num(dh)} × ${num(days)}`, null, null, null];
      const h = parse(values[4]), l = parse(values[5]);
      if (h && l && l.t >= h.t) {
        // 응당일: 입사일 + m개월의 해당일, 없으면 그 달 말일의 다음 날. 응당일에 근로관계가 있어야 발생(개근 가정).
        const due = m => {
          const last = new Date(Date.UTC(h.y, h.mo - 1 + m + 1, 0));
          return h.d <= last.getUTCDate() ? Date.UTC(h.y, h.mo - 1 + m, h.d) : last.getTime() + DAY;
        };
        let mon = 0, ann = 0, yrs = 0;
        for (let j = 1; j <= 11; j++) if (due(j) <= l.t) mon++;
        for (let a = 1; due(12 * a) <= l.t; a++) { yrs = a; ann += Math.min(25, 15 + Math.floor((a - 1) / 2)); }
        if (yrs >= 1) mon = 11;
        const left = Math.max(0, mon + ann - used);
        rows[4] = `${mon + ann}일 (참고용, 개근 가정)`;
        rows[5] = `${left}일 (참고용)`;
        rows[6] = `${won(left * daily)} (참고용)`;
      }
      return { rows, tones: { 2: 'total' } };
    },
    npsvol(values) {
      // 국민연금 임의가입: A값 3,193,511원(2025.12~2026.11), K 1.29, 요율 2026 9.5%→해마다 +0.5%p, 2033년~ 13%. 이자·물가·재평가 미반영.
      let b = Number(values[0]), n = Number(values[1]);
      if (values[0] === '' || values[1] === '' || !Number.isFinite(b) || !Number.isFinite(n)) return { warn: '기준소득월액(원)과 낼 기간(년)을 숫자로 넣어 주세요.' };
      b = Math.min(Math.max(Math.round(b), 410000), 6590000);
      n = Math.min(Math.max(Math.round(n), 1), 42);
      const A = 3193511, K = 1.29;
      const first = Math.floor(b * 0.095);
      let paid = 0;
      for (let i = 0; i < n; i++) paid += Math.floor(b * Math.min(13, 9.5 + 0.5 * i) / 100) * 12;
      const rate = n < 10 ? 0 : n < 20 ? 0.5 + 0.05 * (n - 10) : 1 + 0.05 * (n - 20);
      const monthly = K * (A + b) * rate / 12;
      const manwon = x => { const m = Math.round(x / 10000); return `약 ${m.toLocaleString('ko-KR')}만 원`; };
      const chun = x => { const t = Math.round(x / 1000), m = Math.floor(t / 10), c = t % 10; return `약 ${m}만${c ? ` ${c}천` : ''} 원`; };
      if (!monthly) return { rows: [won(first), manwon(paid), '연금 없음(10년을 못 채우면 반환일시금 길)', '-'], tones: { 2: 'warn' } };
      return { rows: [won(first), manwon(paid), chun(monthly), `받기 시작하고 약 ${(paid / (monthly * 12)).toFixed(1)}년`], tones: { 2: 'total' } };
    },
    netpay(values) {
      // 월급 실수령: 4대보험(2026.7~ 요율) + 근로소득 간이세액표(별표 2) + 지방소득세. 월 고정급·한 달 근무 기준.
      const G = globalThis.FINYUL_GANSEI;
      if (!G) return { warn: '세액표를 불러오지 못했어요. 새로고침해 주세요.' };
      const gross = values[0] === '' ? NaN : Number(values[0]), mealIn = values[1] === '' ? 0 : Number(values[1]);
      const fam = Number(values[2]), kids = Number(values[3]), pct = Number(values[4]);
      if (!(gross > 0) || !Number.isFinite(mealIn) || mealIn < 0) return { warn: '월급과 식대를 0 이상의 숫자로 넣어 주세요.' };
      if (mealIn > gross) return { warn: '식대가 월급보다 커요. 식대는 월급 안에 들어 있는 금액이에요.' };
      if (kids > fam - 1) return { warn: '자녀는 부양가족 수 안에 들어 있어야 해요. 부양가족 수를 늘려 주세요.' };
      const meal = Math.min(mealIn, 200000), W = gross - meal;
      if (W < 280000) return { warn: '식대를 뺀 월급이 28만 원보다 적으면 이 계산기로는 맞지 않아요.' };
      if (W > 10000000) return { warn: '세액표가 월급여액 1천만 원까지예요. 홈택스 모의계산을 쓰세요.' };
      const f10 = x => Math.floor(Math.round(x * 1e6) / 1e6 / 10) * 10;
      const B = Math.min(Math.max(Math.floor(W / 1000) * 1000, 410000), 6590000);
      const np = f10(B * 475 / 10000), hi = Math.min(f10(W * 719 / 10000 / 2), 4591740), ltc = f10(hi * 9448 / 71900), ei = W * 9 / 1000;
      const ins = np + hi + ltc + ei;
      const k = W / 1000;
      let table = 0;
      if (k === 10000) table = G.row10000[fam - 1];
      else if (k >= 770) table = G.rows.find(r => k >= r[0] && k < r[1])[1 + fam];
      const ded = kids <= 0 ? 0 : kids === 1 ? 20830 : 45830 + 33330 * (kids - 2);
      const tax = Math.floor(Math.max(table - ded, 0) * pct / 100), local = Math.floor(tax / 10);
      const total = ins + tax + local, notes = [];
      if (mealIn > 200000) notes.push('식대는 월 20만 원까지만 비과세라 20만 원으로 계산했어요');
      if (B !== Math.floor(W / 1000) * 1000) notes.push(`국민연금은 기준소득월액 ${won(B)}으로 계산했어요`);
      if (table > 0 && ded >= table) notes.push('자녀 공제가 세금보다 커서 소득세가 0원이에요');
      return {
        rows: [won(W), won(np), won(hi), won(ltc), won(ei), won(ins), won(tax), won(local), won(total), won(gross - total), `${(total / gross * 100).toFixed(3)}%`, notes.length ? notes.join('. ') : null],
        tones: { 9: 'total', 11: 'warn' }
      };
    },
    jeonse(values) {
      // 전세대출 이자: 만기일시(월 이자 = 원금×연금리÷12), 원리금균등, 원금균등. 일할계산·보증료는 넣지 않는다.
      const P = Number(values[0]) * 10000, r = Number(values[1]) / 100, n = Number(values[2]), type = values[3], d = Number(values[4]) / 100;
      if (!(P > 0) || !(r > 0) || !Number.isInteger(n) || n < 1 || n > 600 || !Number.isFinite(d)) return { warn: '대출금(만 원)·연 금리(%)·기간(개월)을 숫자로 넣어 주세요.' };
      const pay = rate => {
        const i = rate / 12;
        if (type === 'equal') { const m = P * i / (1 - Math.pow(1 + i, -n)); return { first: m, last: m, total: m * n - P }; }
        if (type === 'principal') return { first: P / n + P * i, last: P / n + (P / n) * i, total: P * i * (n + 1) / 2 };
        return { first: P * i, last: P * i, total: P * i * n };
      };
      const now = pay(r), next = pay(r + d);
      const w = x => won(x);
      const monthly = type === 'principal' ? `${w(now.first)} → ${w(now.last)}` : w(now.first);
      const label = d >= 0 ? '+' : '';
      return { rows: [monthly, w(now.total), `${label}${w(next.first - now.first)}`], tones: { 1: 'total' } };
    },
    cgtax(values) {
      // 양도소득세(만 원 입력, 그해 양도 1건 가정): 양도차익 → 1세대1주택 비과세면 12억 초과분 안분 → 장기보유특별공제(표1 일반, 표2 1주택+거주 2년 이상)
      // → 기본공제 250만 → 보유 1년 미만 70%·2년 미만 60% 또는 기본세율 → 지방소득세 10%. 다주택 중과·감면·환산취득가는 넣지 않는다.
      const price = Number(values[0]) * 1e4, cost = Number(values[1]) * 1e4, exp = Number(values[2] || 0) * 1e4;
      const hold = Number(values[3]), house1 = values[4] === true, res = Number(values[5] || 0), exempt = house1 && values[6] === true;
      if (!(price > 0) || !(cost > 0) || !Number.isFinite(exp) || exp < 0) return { warn: '양도가와 취득가는 0보다 크게, 필요경비는 0 이상으로 만 원 단위 숫자를 넣어 주세요.' };
      const E12 = 12e8, gain0 = price - cost - exp;
      if (gain0 <= 0) return { warn: '양도차익이 없어서 양도소득세는 0원이에요.' };
      if (exempt && hold < 2) return { warn: '비과세는 보통 보유 2년 이상일 때예요. 부득이한 사유 같은 예외는 이 계산기로 못 구하니, 체크를 풀거나 비과세 글을 먼저 확인해 주세요.' };
      const apportion = exempt && price > E12;
      if (exempt && !apportion) return { rows: [won(gain0), null, null, null, null, null, null, null, null, '0원 (비과세)', null], tones: { 9: 'ok' } };
      const ratio = apportion ? (price - E12) / price : 1, gain = Math.floor(gain0 * ratio);
      const T1 = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];
      let pct = 0, table = null;
      if (hold >= 3) {
        if (house1 && res >= 2) { pct = Math.min(40, 12 + 4 * (hold - 3)) + (res < 3 ? 8 : Math.min(40, 12 + 4 * (res - 3))); table = '표2'; }
        else { pct = T1[Math.min(hold, 15) - 3]; table = '표1'; }
      }
      const ltd = Math.floor(gain0 * (pct / 100) * ratio), income = gain - ltd, taxable = Math.max(0, income - 2500000);
      const BR = [[14e6, .06], [5e7, .15], [8.8e7, .24], [1.5e8, .35], [3e8, .38], [5e8, .40], [1e9, .42], [Infinity, .45]];
      const flat = hold < 1 ? .70 : hold < 2 ? .60 : null;
      let tax, local, rateText;
      if (flat) { tax = Math.floor(taxable * flat); local = Math.floor(taxable * flat / 10); rateText = `${Math.round(flat * 100)}% (${hold < 1 ? '보유 1년 미만' : '보유 1년 이상 2년 미만'} 주택)`; }
      else {
        let s = 0, lo = 0; for (const [hi, r] of BR) { if (taxable > lo) s += (Math.min(taxable, hi) - lo) * r; lo = hi; }
        tax = Math.round(s); local = Math.round(s / 10);
        const r = BR.find(([hi]) => taxable <= hi)[1];
        rateText = taxable ? `${Math.round(r * 100)}% 구간 (기본세율)` : '과세표준이 0원이라 해당 없어요';
      }
      const notes = [];
      if (hold < 2) notes.push('보유 2년 미만이라 단기 세율이 적용돼요');
      if (house1 && !exempt && hold >= 2 && price <= E12) notes.push('비과세 요건을 채운 12억 이하 집이라면 세금이 0원일 수 있어요');
      if (house1 && hold >= 3 && res < 2) notes.push('거주 2년 미만이라 표2가 아니라 표1(일반) 공제율이에요');
      return {
        rows: [won(gain0), apportion ? `양도가의 ${(ratio * 100).toFixed(1)}%만 과세 → ${won(gain)}` : null,
          pct ? `${pct}% (${table}) → -${won(ltd)}` : '0원 (보유 3년 미만은 공제가 없어요)', won(income), `-${won(Math.min(2500000, income))}`,
          won(taxable), rateText, won(tax), won(local), won(tax + local), notes.length ? notes.join('. ') : null],
        tones: { 9: 'total', 10: 'warn' }
      };
    },
    jeonseguarantee(values) {
      // 전세보증 한도(만 원): 주택가액 = 인정 주택가격×90%, 한도 = 주택가액 − 선순위 근저당 − (단독·다가구만) 다른 세입자 선순위 보증금.
      // 비율 분모는 주택가액. HUG 근저당 60%·합계 80%, HF는 단독·다가구 80%·그 외 60%. 보증금 상한 수도권 7억·그 외 5억, HF는 주택가격 12억 이하.
      const [agency, type, region] = values;
      const num = v => v === '' ? 0 : Number(v), price = num(values[4]), mort = num(values[5]), others = type === 'house' ? num(values[6]) : 0, dep = num(values[7]);
      if (![price, mort, others, dep].every(n => Number.isFinite(n) && n >= 0) || !(price > 0) || !(dep > 0)) return { warn: '주택가격과 보증금은 0보다 큰 만 원 단위 숫자로 넣어 주세요.' };
      const man = n => `${Math.round(n).toLocaleString('ko-KR')}만 원`;
      const eok = n => { const e = Math.floor(n / 10000), r = Math.round(n % 10000); const rs = !r ? '' : r % 1000 === 0 ? `${r / 1000}천만` : `${r.toLocaleString('ko-KR')}만`; return e ? `${e}억${rs ? ' ' + rs : ''} 원` : `${rs} 원`; };
      const value = price * 0.9, limit = Math.max(0, value - mort - others), gap = dep - limit;
      const r1 = mort / value * 100, r2 = (mort + others) / value * 100, r2cap = agency === 'hf' && type !== 'house' ? 60 : 80;
      const capAmt = region === 'capital' ? 70000 : 50000, capOk = dep <= capAmt, priceOk = agency !== 'hf' || price <= 120000;
      const ok1 = r1 <= 60, ok2 = r2 <= r2cap, okGap = gap <= 0;
      const verdict = !limit ? '한도 없음, 선순위가 주택가액을 넘어요' : !okGap ? `한도 초과, 보증금을 ${eok(limit)} 이하로` : !ok1 ? '근저당 비율 60% 초과' : !ok2 ? `선순위 합계 비율 ${r2cap}% 초과` : !capOk ? `보증금 상한 ${eok(capAmt)} 초과` : !priceOk ? '주택가격 12억 원 초과(HF)' : '산식상 통과';
      return {
        rows: [man(value), limit ? man(limit) : '한도 없음', okGap ? `${man(Math.abs(gap))} 여유` : `${man(gap)} 초과`,
          `${r1.toFixed(1)}%, 60% ${ok1 ? '이내' : '초과'}`, `${r2.toFixed(1)}%, ${r2cap}% ${ok2 ? '이내' : '초과'}`,
          !priceOk ? '주택가격 12억 원 초과(HF 대상 아님)' : `${region === 'capital' ? '수도권' : '그 외 지역'} ${eok(capAmt).replace(' 원', ' 원')} ${capOk ? '이내' : '초과'}`, verdict],
        tones: { 2: okGap ? 'ok' : 'warn', 3: ok1 ? 'ok' : 'warn', 4: ok2 ? 'ok' : 'warn', 5: capOk && priceOk ? 'ok' : 'warn', 6: 'total' }
      };
    },
    closurevat(values) {
      // 폐업 간주공급(부가세법 제10조⑥, 시행령 제66조): 재고는 시가, 감가상각자산은 취득가×(1−체감률×경과 과세기간). 기계 25%·최대 4, 건물 5%·최대 20.
      const kind = values[0], amt = values[1] === '' ? NaN : Number(values[1]), n = values[2] === '' ? NaN : Number(values[2]);
      if (!(amt >= 0)) return { warn: '금액을 원 단위 숫자로 넣어 주세요(부가세 뺀 값).' };
      if (kind !== 'inventory' && !(Number.isInteger(n) && n >= 0)) return { warn: '지난 과세기간 수를 0 이상 정수로 넣어 주세요(6개월이 한 단위).' };
      const used = kind === 'machine' ? Math.min(n, 4) : kind === 'building' ? Math.min(n, 20) : null;
      const base = Math.round(kind === 'inventory' ? amt : amt * (1 - (kind === 'machine' ? 0.25 : 0.05) * used)), vat = Math.round(base * 0.1);
      return { rows: [used === null ? null : `${used}기`, won(base), won(vat)], tones: vat ? { 2: 'total' } : { 1: 'ok', 2: 'ok' } };
    },
    inherittax(values) {
      // 상속세(만 원 입력): 일괄공제 max(2억+자녀×5천만, 5억) + 배우자공제(분할 신고면 min(30억, 재산×법정지분) 최소 5억, 아니면 5억)
      // + 금융재산공제(2천만 이하 전액, 초과 20%·최소 2천만·최대 2억) + 동거주택공제(최대 6억), 합계는 재산 한도 → 누진세율 → 기한 안 신고 3%.
      const tot = Number(values[0]) * 10000, sp = values[1] === true, kids = Number(values[2] || 0);
      const fin = Number(values[3] || 0) * 10000, house = Number(values[4] || 0) * 10000, split = sp && values[5] === true, ontime = values[6] === true;
      if (!(tot > 0) || !Number.isInteger(kids) || kids < 0 || kids > 10 || !(fin >= 0) || !(house >= 0)) return { warn: '상속재산은 만 원 단위 숫자로, 자녀 수는 0~10 사이 정수로 넣어 주세요.' };
      if (fin > tot || house > tot) return { warn: '금융재산과 동거주택 가액은 총 상속재산 안에 들어 있는 금액이에요. 총 상속재산보다 클 수 없어요.' };
      const lump = Math.max(2e8 + 5e7 * kids, 5e8);
      const spDed = sp ? (split ? Math.max(5e8, Math.min(3e9, Math.floor(tot * (kids ? 1.5 / (1.5 + kids) : 1)))) : 5e8) : 0;
      const finDed = fin <= 2e7 ? fin : Math.min(Math.max(fin * 0.2, 2e7), 2e8), houseDed = Math.min(house, 6e8);
      const ded = Math.min(lump + spDed + finDed + houseDed, tot);
      let tb = tot - ded; if (tb < 500000) tb = 0;
      const B = [[1e8, 0.1, 0], [5e8, 0.2, 1e7], [1e9, 0.3, 6e7], [3e9, 0.4, 1.6e8], [Infinity, 0.5, 4.6e8]];
      const [, rate, minus] = B.find(([cap]) => tb <= cap);
      const tax = Math.max(0, Math.floor(tb * rate - minus)), credit = ontime ? Math.floor(tax * 0.03) : 0, pay = tax - credit;
      const notes = [];
      if (sp && !kids) notes.push('자녀가 없고 부모(직계존속)가 계시면 배우자 몫이 달라져 결과가 바뀌어요');
      notes.push('10년 안 사전증여, 미성년·65세 이상 가족 공제, 배우자 실제 상속분은 반영하지 않았어요');
      return {
        rows: [won(lump), sp ? won(spDed) : null, finDed ? won(finDed) : null, houseDed ? won(houseDed) : null, won(ded),
          tb ? `${won(tb)} (세율 ${rate * 100}% 구간)` : '0원(과세 안 함)', won(tax), credit ? `-${won(credit)}` : ontime || !tax ? null : '0원 (기한 뒤 신고)',
          won(pay), `${(pay / tot * 100).toFixed(1)}%`, notes.join('. ')],
        tones: { 7: ontime ? 'ok' : 'warn', 8: 'total', 10: 'warn' }
      };
    },
    leave66(values) {
      // 육아휴직 6+6(시행령 제95조의3) vs 일반(제95조): 달마다 min(통상임금, 그 달 상한), 하한 70. 7개월째부터 통상임금 80%·상한 160.
      // 개월 수가 다르면 같이 쓴 기간(최대 6개월)만 6+6 상한을 적용한다(고용24 안내 해석). 단위 만원.
      const [a, b, n1, n2] = values.map(Number);
      const okW = w => Number.isFinite(w) && w >= 1 && w <= 2000, okN = n => Number.isInteger(n) && n >= 1 && n <= 12;
      if (!okW(a) || !okW(b) || !okN(n1) || !okN(n2)) return { warn: '통상임금은 만원 단위 숫자로, 개월 수는 1~12 사이 정수로 넣어 주세요.' };
      const G = [250, 250, 250, 200, 200, 200], S = [250, 250, 300, 350, 400, 450], c = Math.min(n1, n2, 6);
      const month = (w, i) => i > 6 ? [Math.max(70, Math.min(w * 0.8, 160))] : [Math.max(70, Math.min(w, G[i - 1])), Math.max(70, Math.min(w, i <= c ? S[i - 1] : G[i - 1]))];
      const sum = (w, n) => { let g = 0, s = 0; for (let i = 1; i <= n; i++) { const m = month(w, i); g += m[0]; s += m[m.length - 1]; } return [Math.round(g), Math.round(s)]; };
      const x = sum(a, n1), y = sum(b, n2);
      const man = n => `${n.toLocaleString('ko-KR')}만원`, diff = d => d > 0 ? `+${man(d)}` : '차이 없어요';
      const cell = (w, n, i) => i > n ? '쓰지 않아요' : `${month(w, i)[0]} → ${month(w, i)[1]}`;
      const months = [1, 2, 3, 4, 5, 6].map(i => `${i}개월째 내 ${cell(a, n1, i)} / 배우자 ${cell(b, n2, i)}`);
      const late = Math.max(n1, n2) > 6 ? `내 ${n1 > 6 ? Math.round(month(a, 7)[0]) + '만원' : '쓰지 않아요'}, 배우자 ${n2 > 6 ? Math.round(month(b, 7)[0]) + '만원' : '쓰지 않아요'} (통상임금 80%, 상한 160, 하한 70)` : null;
      return {
        rows: [man(x[0]), man(x[1]), diff(x[1] - x[0]), man(y[0]), man(y[1]), diff(y[1] - y[0]), man(x[0] + y[0]), man(x[1] + y[1]), diff(x[1] + y[1] - x[0] - y[0]), ...months, late],
        tones: { 2: 'ok', 5: 'ok', 8: 'total' }
      };
    },
    partpay(values) {
      // 알바비: 시급×소정시간 + 주휴(주 15시간 이상, 소정÷max(근무일,5) 또는 ÷근무일) + 야간 가산(5인 이상, 50%), 월 = 주×365/7/12.
      // 3.3%(사업소득 원천징수)와 4대보험·간이세액표(가족 1명) 방식을 나란히 보여 준다. 근로자성은 판단하지 않는다.
      const G = globalThis.FINYUL_GANSEI;
      if (!G) return { warn: '세액표를 불러오지 못했어요. 새로고침해 주세요.' };
      const y27 = values[0] === '2027', wage = Number(values[1]), days = Number(values[2]), hpw = Number(values[3]);
      const night = values[4] === '' ? 0 : Number(values[4]), five = values[5] === 'yes', divDays = values[6] === 'divdays';
      if (!(wage > 0) || !Number.isInteger(days) || days < 1 || days > 7 || !(hpw > 0) || hpw > days * 24) return { warn: '시급, 주 근무일(1~7일), 주 근무시간을 바르게 넣어 주세요.' };
      if (!Number.isFinite(night) || night < 0 || night > hpw) return { warn: '야간 시간은 0부터 주 근무시간 사이로 넣어 주세요.' };
      const hday = hpw >= 15 ? Math.min(hpw / (divDays ? days : Math.max(days, 5)), 8) : 0;
      const base = wage * hpw, holiday = wage * hday, extra = five ? wage * 0.5 * night : 0;
      const week = base + holiday + extra, W = 365 / 7 / 12, M = Math.round(week * W), mh = hpw * W;
      const f10 = x => Math.floor(Math.round(x * 1e6) / 1e6 / 10) * 10;
      const t33 = Math.floor(M * 0.03), l33 = Math.floor(t33 / 10);
      let ins = null, tax = null, net = null;
      if (mh >= 60) {
        const B = Math.min(Math.max(Math.floor(M / 1000) * 1000, 410000), 6590000);
        const np = f10(B * (y27 ? 500 : 475) / 10000), hi = Math.min(f10(M * 719 / 10000 / 2), 4591740), ltc = f10(hi * 9448 / 71900), ei = Math.floor(M * 9 / 1000);
        const k = M / 1000, it = k < 770 ? 0 : G.rows.find(r => k >= r[0] && k < r[1])[2], il = Math.floor(it / 10);
        ins = np + hi + ltc + ei; tax = it + il; net = M - ins - tax;
      }
      const hrs = h => `${Number.isInteger(h) ? h : h.toFixed(1)}시간`, notes = [];
      if (!five && night > 0) notes.push('5인 미만이라 야간 가산을 빼고 계산했어요');
      if (mh < 60) notes.push('월 소정근로시간이 60시간 미만이라 4대보험 방식은 계산하지 않았어요. 3개월 이상 일하는 경우 등 예외가 있어요');
      if (y27) notes.push('2027은 국민연금 5.0%만 바꾸고 건강·고용 요율과 세액표는 2026 값으로 가정했어요(고용보험 적용 기준은 2027년부터 소득 기준으로 바뀌어요)');
      notes.push('소득세는 평균 달 기준이라 근무한 주 수에 따라 0원~소액으로 달라져요');
      return {
        rows: [hrs(hday), won(base), hday ? won(holiday) : '15시간 미만이라 없어요', extra ? won(extra) : null, won(week), won(M),
          won(M - t33 - l33), ins === null ? null : won(ins), tax === null ? null : won(tax), net === null ? null : won(net), notes.join('. ')],
        tones: { 2: hday ? 'ok' : 'warn', 5: 'total', 6: 'ok', 9: 'ok', 10: 'warn' }
      };
    },
    annuityvs(values) {
      // 55세 이후 퇴직금 일시금 vs 연금수령 소득세(소득세법 제48·55조, 제129조①5의3 70/60/50%, 시행령 제40조의2 한도·연차, 제202조의2).
      // 가정: 퇴직금 전액 이연, 운용수익 0, 매년 1월 인출, 계좌 1개, 2026-01-01 이후 지급분. 지방소득세 제외. 입력 만 원.
      const P = Number(values[0]) * 10000, y = Number(values[1]), plan = values[2], s0 = values[3] === '6' ? 6 : 1;
      if (!(P > 0) || !Number.isInteger(y) || y < 1 || y > 60) return { warn: '퇴직금(만 원)과 근속연수(1~60년, 올림한 정수)를 넣어 주세요.' };
      const svc = n => n <= 5 ? 1e6 * n : n <= 10 ? 5e6 + 2e6 * (n - 5) : n <= 20 ? 1.5e7 + 2.5e6 * (n - 10) : 4e7 + 3e6 * (n - 20);
      const ded = x => x <= 8e6 ? x : x <= 7e7 ? 8e6 + (x - 8e6) * 0.6 : x <= 1e8 ? 4.52e7 + (x - 7e7) * 0.55 : x <= 3e8 ? 6.17e7 + (x - 1e8) * 0.45 : 1.517e8 + (x - 3e8) * 0.35;
      const BR = [[1.4e7, 0, 0.06, 0], [5e7, 8.4e5, 0.15, 1.4e7], [8.8e7, 6.24e6, 0.24, 5e7], [1.5e8, 1.536e7, 0.35, 8.8e7], [3e8, 3.706e7, 0.38, 1.5e8], [5e8, 9.406e7, 0.40, 3e8], [1e9, 1.7406e8, 0.42, 5e8], [Infinity, 3.8406e8, 0.45, 1e9]];
      const bt = b => { const [, s, r, l] = BR.find(([h]) => b <= h); return s + (b - l) * r; };
      const sd = Math.min(svc(y), P), cs = (P - sd) * 12 / y, T = Math.round(bt(Math.max(cs - ded(cs), 0)) / 12 * y);
      const rate = n => n <= 10 ? 0.7 : n <= 20 ? 0.6 : 0.5;
      const k = { '5': 5, '10': 10, '20': 20, '30': 30 }[plan];
      let bal = P, n = 0, tax = 0, exc = 0;
      while (bal > 0.5 && n < 60) {
        n++; const nl = n + s0 - 1, lim = nl <= 10 ? bal / (11 - nl) * 1.2 : Infinity;
        const w = Math.min(bal, k ? (n <= k ? bal / (k - n + 1) : 0) : lim), p = Math.min(w, lim), e = w - p;
        tax += p * (T / P) * rate(n) + e * (T / P); exc += e; bal -= w;
      }
      tax = Math.round(tax);
      return {
        rows: [won(T), won(tax), won(T - tax), T ? `${(tax / T * 100).toFixed(1)}%` : '-', Math.round(exc) ? `${won(exc)} (연금 한도를 넘어 일시금처럼 과세)` : null],
        tones: { 2: 'total', 4: 'warn' }
      };
    },
    fintax(values) {
      // 금융소득종합과세(소득세법 제14·56·62조): 2천만 원까지 14%, 초과분은 (다른 소득과 합산 누진세 + 2천만×14%)와 (전액 14% + 다른 소득 세액) 중 큰 쪽.
      // 배당가산은 2천만 원 초과분 중 국내 배당에만(이자부터 채운다). 근로소득자의 연말정산 세액공제는 반영하지 않는다. 입력 만 원, 계산 원.
      const B = [[14e6, 0.06, 0], [5e7, 0.15, 1.26e6], [8.8e7, 0.24, 5.76e6], [1.5e8, 0.35, 1.544e7], [3e8, 0.38, 1.994e7], [5e8, 0.40, 2.594e7], [1e9, 0.42, 3.594e7], [Infinity, 0.45, 6.594e7]];
      const tax = b => { if (b <= 0) return 0; const [, r, d] = B.find(([cap]) => b <= cap); return Math.round(b * r - d); };
      const [i, d, o, ded] = values.slice(0, 4).map(v => Number(v) * 10000), gross = values[4] === '11' ? 0.11 : 0.10;
      if ([i, d, o, ded].some(n => !Number.isFinite(n) || n < 0) || i + d <= 0) return { warn: '이자·배당·다른 소득·소득공제를 만 원 단위 숫자로 넣어 주세요(이자와 배당 중 하나는 0보다 커야 해요).' };
      const F = i + d, wh = Math.round(F * 0.14), otherTax = tax(o - ded);
      if (F <= 2e7) return { rows: [won(F), '2천만 원 이하라 원천징수(14%)로 끝나요', null, null, won(wh), '0원', null], tones: { 5: 'total' } };
      let room = 2e7; const exI = Math.max(0, i - room); room -= Math.min(room, i); const exD = Math.max(0, d - room);
      const gu = Math.round(exD * gross);
      const m1 = tax(exI + exD + gu + o - ded) + 2e7 * 0.14, m2 = wh + otherTax;
      const credit = m1 >= m2 ? Math.min(gu, m1 - m2) : 0, decided = Math.max(m1, m2) - credit, extra = Math.max(0, decided - wh - otherTax);
      return {
        rows: [won(F), `초과분 ${won(F - 2e7)}`, `${won(m1)} / ${won(m2)}`, credit ? `-${won(credit)}` : null, won(wh), won(extra), extra ? `약 ${won(Math.round(extra * 0.1))}` : null],
        tones: { 5: 'total' }
      };
    },
    maternity(values) {
      // 출산전후휴가급여(고용보험법 제75·76조, 근로기준법 제74조, 고시 제2026-67호): 하루치 = 월 통상임금 ÷ 30(가정), 최저임금 월 환산이 하한.
      // 우선지원: 고용보험이 전 기간(상한까지), 회사는 앞 60일(다태아 75일) 상한 초과 차액(고용24 안내). 그 밖: 회사가 앞 60·75일 전액, 고용보험은 남은 기간(상한까지).
      const CAP = { 90: 6600000, 100: 7333330, 120: 8800000 }, FLOOR = 10320 * 209;
      const wage = Number(values[0]) * 10000, priority = values[1] === 'priority', days = Number(values[2]);
      if (!(wage > 0) || !CAP[days]) return { warn: '월 통상임금을 만 원 단위 숫자로 넣어 주세요.' };
      const daily = Math.max(wage, FLOOR) / 30, capDaily = CAP[days] / days, paidDays = days === 120 ? 75 : 60;
      const ins = priority ? Math.min(daily * days, CAP[days]) : Math.min(daily, capDaily) * (days - paidDays);
      const company = priority ? Math.max(0, daily - capDaily) * paidDays : daily * paidDays;
      const man = n => `${Math.round(n / 10000).toLocaleString('ko-KR')}만 원`;
      return {
        rows: [man(ins), man(company), man(ins + company), priority ? '휴가 시작 한 달 뒤부터' : `휴가 시작 ${paidDays}일이 지난 날부터 한 달 뒤`],
        tones: { 2: 'total' }
      };
    },
    noranumbrella(values) {
      // 노란우산공제 소득공제(조특법 제86조의3): 한도는 사업소득금액 구간, 공제액 = min(납입, 한도, 사업소득금액), 절세 = 공제액×세율×1.1.
      // 연 납입 1,800만 원 상한(2026.7.1 이후 납입분)은 안내만(한도 최대 600만이라 결과는 같다). 해지세·퇴직소득세는 계산하지 않는다.
      const LIMITS = [[40000000, 6000000], [60000000, 5000000], [100000000, 4000000], [Infinity, 2000000]];
      const inc = Number(values[0]) * 10000, pay = Number(values[1]) * 10000, rate = Number(values[2]);
      if (!(inc > 0)) return { warn: '사업소득금액을 입력하세요.' };
      if (!(pay > 0) || !(rate > 0)) return { warn: '연 납입액을 만원 단위로 넣고 세율을 골라 주세요.' };
      const L = LIMITS.find(([cap]) => inc <= cap)[1], P = Math.min(pay, 18000000), D = Math.min(P, L, inc), lost = Math.max(0, pay - D);
      const man = n => `${(n / 10000).toLocaleString('ko-KR')}만 원`;
      return {
        rows: [pay > 18000000 ? '연 납입은 1,800만 원까지만 공제 대상이에요(2026년 7월 1일 이후 납입분).' : null,
          man(L), man(D), won(D * rate * 1.1), lost ? man(lost) : '없음'],
        tones: { 0: 'warn', 3: 'total', 4: lost ? 'warn' : 'ok' }
      };
    },
    noranumbrellacancel(values) {
      // 노란우산공제 일반 해지(기타소득): 세금 붙는 몫 = 환급금 − (낸 부금 − 공제받은 금액), 원천징수 16.5%,
      // 300만 원 넘으면 다른 과세표준에 합산해 소득세법 제55조 세율로 다시 계산(지방소득세 10% 포함). 공제계약대출 한도 = min(낸 부금, (환급금 − 원천징수)×90%, 10만 원 단위).
      // 폐업 등 공제금(퇴직소득)과 건강보험료는 계산하지 않는다. 검산: work/noranumbrella-deduction-limit-cancel-tax-2026/notes/calc-cancel-spec-1112.js
      const BR = [[14e6, 0.06, 0, 0], [5e7, 0.15, 14e6, 84e4], [88e6, 0.24, 5e7, 624e4], [15e7, 0.35, 88e6, 1536e4], [3e8, 0.38, 15e7, 3706e4], [5e8, 0.40, 3e8, 9406e4], [1e9, 0.42, 5e8, 17406e4], [Infinity, 0.45, 1e9, 38406e4]];
      const tax = tb => { if (tb <= 0) return 0; for (const [u, r, lo, base] of BR) if (tb <= u) return base + (tb - lo) * r; };
      if (values.slice(0, 4).some(v => v === '')) return { warn: '숫자를 만 원 단위로 넣어 주세요.' };
      const [R, P, D, B] = values.slice(0, 4).map(v => Number(v) * 10000);
      if (![R, P, D, B].every(Number.isFinite) || R <= 0 || P < 0 || D < 0 || B < 0) return { warn: '숫자를 만 원 단위로 넣어 주세요.' };
      if (D > P) return { warn: '소득공제 받은 금액은 낸 부금보다 클 수 없어요.' };
      const X = Math.max(0, R - (P - D)), W = Math.round(X * 0.165), merged = X > 3000000;
      const fin = merged ? Math.round((tax(B + X) - tax(B)) * 1.1) : W, extra = fin - W;
      const loan = Math.min(P, Math.floor((R - W) * 0.9 / 100000) * 100000);
      return {
        rows: [X ? won(X) : '0원 (공제 못 받은 납입분이 환급금보다 많아 세금이 붙지 않아요. 증빙으로 확인되는 금액까지만 인정돼요)',
          won(W), won(R - W), merged ? won(fin) : '해당 없어요, 뗀 세금으로 끝나요',
          extra > 0 ? `${won(extra)} 더 내요` : extra < 0 ? `${won(-extra)} 돌려받아요` : '0원', won(R - fin), won(loan)],
        tones: extra > 0 ? { 4: 'warn', 5: 'total' } : { 5: 'total' }
      };
    },
    isatax(values) {
      // ISA 해지일 순이익(조특법 제91조의18): 순이익 = 이익 − 통산 손실·보수. 비과세 한도 일반형 200만·서민형 400만 원, 넘는 몫 9%(원 미만 버림) + 지방소득세 10%.
      // 일반 계좌 비교는 이자·배당 15.4%(14% + 1.4%), 금융소득종합과세 2천만 원 이하 가정. 검산: work/isa-seominhyeong-tax-free-limit-maturity-options-2026/notes/knowledge.md 「계산기 판단」
      if (values[0] === '') return { warn: '해지일 예상 이익을 만 원 단위로 넣어 주세요.' };
      const gain = Number(values[0]) * 10000, loss = values[1] === '' ? 0 : Number(values[1]) * 10000;
      if (!Number.isFinite(gain) || !Number.isFinite(loss) || gain < 0 || loss < 0) return { warn: '이익과 손실·보수를 0 이상 숫자(만 원)로 넣어 주세요.' };
      const N = Math.max(0, gain - loss);
      const isaTax = limit => { const it = Math.floor(Math.max(0, N - limit) * 0.09); return it + Math.floor(it * 0.1); };
      const gen = isaTax(2000000), low = isaTax(4000000);
      const plainIt = Math.floor(N * 0.14), plain = plainIt + Math.floor(plainIt * 0.1);
      const room = limit => N <= limit ? `${won(limit - N)} 남아요` : `${won(N - limit)} 넘었어요`;
      return {
        rows: [won(N), won(gen), won(low), room(2000000), room(4000000), won(plain), won(plain - low)],
        tones: { 0: 'total', 1: gen ? 'warn' : 'ok', 2: low ? 'warn' : 'ok' }
      };
    },
    minusinterest(values) {
      // 마통 이자 = 쓴 금액 × 연이율 × 쓴 날수 ÷ 365, 원 미만 버림(하나은행 상품안내 방식).
      const amt = Number(values[0]) * 10000, rate = Number(values[1]), days = Number(values[2]);
      if (values[0] === '' || !(amt >= 0) || !(rate >= 0) || !Number.isFinite(days) || days < 0 || days > 366) return { warn: '쓴 금액(만 원), 연이율(%), 쓴 날수(0~366일)를 숫자로 넣어 주세요.' };
      const interest = Math.floor(Math.round(amt * rate * days / 100 / 365 * 1e6) / 1e6);
      return { rows: [won(interest)], tones: { 0: 'total' } };
    },
    minusdsr(values) {
      // 마통 한도의 DSR 환산: 원금 몫 = 한도 ÷ 5, 이자 몫 = 한도 × 연이율(스트레스 가산 제외), 연소득 대비 비율.
      const limit = Number(values[0]), rate = Number(values[1]), income = Number(values[2]);
      if (values[0] === '' || !(limit >= 0) || !(rate >= 0) || !(income > 0)) return { warn: '한도(만 원), 연이율(%), 연소득(만 원)을 숫자로 넣어 주세요.' };
      const principal = limit / 5, interest = limit * rate / 100, sum = principal + interest;
      const man = n => `${(Math.round(n * 10) / 10).toLocaleString('ko-KR')}만 원`;
      return { rows: [man(principal), man(interest), man(sum), `${(sum / income * 100).toFixed(1)}%`], tones: { 2: 'total', 3: 'warn' } };
    },
    acqtax(values) {
      // 주택 취득세(유상 매매 1채, 만 원 입력): 중과 판정(지방세법 제13조의2) → 세율(제11조제1항제8호, 6~9억은 0.01%p 단위 반올림) →
      // 지방교육세(제151조)·농특세 → 생애최초·출산 감면(지특법 제36조의3·36조의5, 1주택·12억 이하, 큰 쪽 하나). 원 단위 절사 뒤 항목별 만 원 반올림, 합계는 반올림한 항목의 합.
      const P = Number(values[0]) * 1e4, over85 = values[1] === 'gt85', count = Number(values[2]), adj = values[3] === 'adj';
      const temp = values[4] === true, low = values[5] === true, red = values[6] || 'none', cap300 = values[7] === true;
      if (values[0] === '' || !(P > 0)) return { warn: '집값을 만 원 단위 숫자로 넣어 주세요.' };
      if (count >= 2 && (red === 'birth' || red === 'both')) return { warn: '출산·양육 감면은 이 집이 1가구 1주택일 때만 받아요.' };
      const EOK = 1e8, m = n => Math.round(n / 1e4), man = n => `약 ${n.toLocaleString('ko-KR')}만 원`;
      // 세율을 0.01%p 단위 정수로: (2P/3억 − 3)×100 = (2P − 9억)/300만, 반올림
      const units = P <= 6 * EOK ? 100 : P > 9 * EOK ? 300 : Math.floor((2 * (2 * P - 9 * EOK) + 3e6) / 6e6);
      let tier = 'normal', why = '';
      if (count === 1) why = '첫 집이라 일반 세율이에요';
      else if (count === 2) { if (!adj) why = '조정대상지역이 아닌 곳의 2주택째라 일반 세율이에요'; else if (temp) why = '일시적 2주택이라 일반 세율이에요'; else tier = 'x8'; }
      else tier = count === 3 && !adj ? 'x8' : 'x12';
      const lowApplied = tier !== 'normal' && low;
      if (lowApplied) { tier = 'normal'; why = '공시가격이 낮은 주택이라 중과에서 빠져요'; }
      if (tier === 'x8') why = '중과 8%예요';
      if (tier === 'x12') why = '중과 12%예요';
      const heavy = tier !== 'normal', floor = Math.floor;
      const acq = heavy ? floor(P * (tier === 'x8' ? 0.08 : 0.12)) : floor(P * units / 10000);
      const edu = heavy ? floor(P * 0.004) : floor(P * units / 100000);
      const nongWon = !over85 ? 0 : tier === 'x8' ? floor(P * 0.006) : tier === 'x12' ? floor(P * 0.010) : floor(P * 0.002);
      // 감면: 1주택·12억 이하만. 산출세액은 일반 세율 취득세, 지방교육세는 감면 전 기준 그대로(가정). 감면 + 85㎡ 초과면 농특세는 계산하지 않는다.
      const useRed = red !== 'none' && count === 1 && P <= 12 * EOK;
      const first = Math.min(acq, cap300 ? 3e6 : 2e6), birth = Math.min(acq, 5e6);
      const credit = !useRed ? 0 : red === 'first' ? first : red === 'birth' ? birth : Math.max(first, birth);
      const creditName = red === 'first' || (red === 'both' && first >= birth) ? '생애최초' : '출산·양육';
      const a = m(acq), c = m(credit), e = m(edu), n = over85 && !useRed ? m(nongWon) : 0;
      const total = a - c + e + n;
      const nongTxt = !over85 ? '0원 (전용 85㎡ 이하는 비과세)' : useRed ? '계산하지 않았어요' : man(n) + (heavy ? ' (지자체 계산표 값)' : '');
      const notes = [];
      if (!heavy && P > 6 * EOK && P <= 9 * EOK) notes.push('6~9억 구간은 계산 방식에 따라 세액이 몇만 원 달라질 수 있어요');
      if (count === 2 && adj && temp && !heavy) notes.push('일시적 2주택은 기한 안에 종전 집을 팔아야 인정돼요. 못 팔면 8%로 계산돼요');
      if (lowApplied) notes.push('공시가격 기준이에요. 정비구역 안 집은 해당하지 않아요');
      if (heavy && over85) notes.push('농어촌특별세는 서울시·서초구 공식 계산표 값이에요');
      if (useRed && over85) notes.push('전용 85㎡ 넘는 집은 감면을 받아도 농어촌특별세가 따로 붙을 수 있어서 합계에서 뺐어요');
      if (useRed) notes.push('지방교육세는 감면 전 기준으로 더했어요. 최종 금액은 위택스에서 확인하세요');
      if (red !== 'none' && count === 1 && P > 12 * EOK) notes.push('집값이 12억 원을 넘으면 생애최초·출산 감면 대상이 아니에요');
      return {
        rows: [why, heavy ? (tier === 'x8' ? '8%' : '12%') : `${(units / 100).toFixed(2)}%`, man(a), useRed ? `-${c.toLocaleString('ko-KR')}만 원 (${creditName})` : null,
          man(e), nongTxt, man(total) + (useRed && over85 ? ' (농어촌특별세 제외)' : ''), `${(total * 1e4 / P * 100).toFixed(2)}%`,
          notes.length ? notes.join('. ') + '.' : null],
        tones: heavy ? { 0: 'warn', 6: 'total', 8: 'warn' } : { 6: 'total', 8: 'warn' }
      };
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = models;
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-finyul-calculator]').forEach(card => {
    const model = models[card.dataset.finyulCalculator];
    const fields = [...card.querySelectorAll('input, select')];
    const box = card.querySelector('[aria-live]');
    if (!model || !box) return;
    const rows = [...box.querySelectorAll('dl > div')];
    const warning = document.createElement('p');
    warning.className = 'finyul-calc-warning';
    warning.setAttribute('role', 'status');
    warning.hidden = true;
    box.after(warning);
    const update = () => {
      if (card.dataset.finyulCalculator === 'nps') fields[3].closest('label').hidden = fields[2].value !== '2026-12';
      if (card.dataset.finyulCalculator === 'brokerage') fields[3].closest('label').hidden = fields[0].value !== 'wolse';
      if (card.dataset.finyulCalculator === 'giftax') {
        // 세대생략 할증은 부모·조부모 → 자녀·손주일 때만 묻는다. 숨길 때는 체크도 풀어 계산이 어긋나지 않게 한다.
        const asc = fields[1].value.startsWith('asc');
        fields[2].closest('label').hidden = !asc;
        if (!asc) fields[2].checked = false;
      }
      if (card.dataset.finyulCalculator === 'cgtax') {
        // 거주 기간과 비과세 칸은 1세대 1주택일 때만 묻는다. 숨길 때는 비과세 체크를 풀어 계산이 어긋나지 않게 한다.
        const own = fields[4].checked;
        fields[5].closest('label').hidden = !own;
        fields[6].closest('label').hidden = !own;
        if (!own) fields[6].checked = false;
      }
      if (card.dataset.finyulCalculator === 'jeonseguarantee') {
        // 공시가 칸은 연립·다세대, 다른 세입자 보증금 칸은 단독·다가구일 때만 묻는다. 공시가를 넣으면 주택가격을 140%로 채운다.
        fields[3].closest('label').hidden = fields[1].value !== 'villa';
        fields[6].closest('label').hidden = fields[1].value !== 'house';
        if (fields[1].value === 'villa' && Number(fields[3].value) > 0) fields[4].value = String(Math.round(Number(fields[3].value) * 1.4));
      }
      if (card.dataset.finyulCalculator === 'closurevat') fields[2].closest('label').hidden = fields[0].value === 'inventory';
      if (card.dataset.finyulCalculator === 'inherittax') {
        // 배우자 분할 신고는 배우자가 있을 때만 묻는다. 숨길 때는 체크도 풀어 계산이 어긋나지 않게 한다.
        fields[5].closest('label').hidden = !fields[1].checked;
        if (!fields[1].checked) fields[5].checked = false;
      }
      if (card.dataset.finyulCalculator === 'partpay') fields[4].closest('label').hidden = fields[5].value !== 'yes';
      if (card.dataset.finyulCalculator === 'fourins') fields[3].closest('label').hidden = fields[1].value !== '2027';
      if (card.dataset.finyulCalculator === 'acqtax') {
        // 지역은 2채 이상, 일시적 2주택은 조정대상지역 2채, 공시가격 저가는 중과가 될 때, 감면은 첫 집, 300만 한도는 생애최초일 때만 묻는다.
        // 숨길 때는 체크를 풀고 select를 기본값으로 되돌려 계산이 어긋나지 않게 한다.
        const count = fields[2].value, one = count === '1';
        fields[3].closest('label').hidden = one;
        if (one) fields[3].value = 'adj';
        const adj = fields[3].value === 'adj', showTemp = count === '2' && adj;
        fields[4].closest('label').hidden = !showTemp;
        if (!showTemp) fields[4].checked = false;
        const heavy = !one && !(count === '2' && (!adj || fields[4].checked));
        fields[5].closest('label').hidden = !heavy;
        if (!heavy) fields[5].checked = false;
        fields[6].closest('label').hidden = !one;
        if (!one) fields[6].value = 'none';
        const first = fields[6].value === 'first' || fields[6].value === 'both';
        fields[7].closest('label').hidden = !first;
        if (!first) fields[7].checked = false;
      }
      const result = model(fields.map(f => f.type === 'checkbox' ? f.checked : f.value));
      warning.textContent = result.warn || '';
      warning.hidden = !result.warn;
      box.hidden = !!result.warn;
      if (result.warn) return;
      rows.forEach((row, i) => {
        const value = result.rows[i];
        row.hidden = value == null;
        const output = row.querySelector('dd');
        if (!output || value == null) return;
        output.textContent = value;
        output.classList.remove('text-amber-700', 'text-green-700', 'text-brand-800');
        output.classList.add(result.tones?.[i] === 'warn' ? 'text-amber-700' : result.tones?.[i] === 'ok' ? 'text-green-700' : 'text-brand-800');
      });
    };
    card.addEventListener('input', update);
    card.addEventListener('change', update);
    update();
  });
})();
