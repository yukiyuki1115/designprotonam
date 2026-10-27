import { useMemo, useState } from 'react'

type Row = { group: string; name: string; values: number[] }

const metrics = ['계', '고등학교 졸업 이하', '초전문 대학교', '대학교', '대학원 석·박사']
const rows: Row[] = [
  { group: '전체', name: '전체', values: [890861, 695561, 78422, 113443, 3436] },
  { group: '업종 대분류', name: '수산업', values: [698059, 560651, 53868, 81167, 2372] },
  { group: '업종 대분류', name: '수산관련산업', values: [192802, 134910, 24554, 32275, 1063] },
  { group: '업종 중분류', name: '수산물 생산업', values: [509534, 425554, 34323, 48249, 1407] },
  { group: '업종 중분류', name: '수산물 가공업', values: [58170, 43496, 4626, 9316, 731] },
  { group: '업종 중분류', name: '수산물 유통업', values: [126863, 89181, 14492, 22964, 226] },
  { group: '업종 중분류', name: '수산여가관련 서비스업', values: [3491, 2419, 427, 638, 8] },
  { group: '업종 중분류', name: '어선 및 낚시 선박 건조업', values: [61570, 40315, 8235, 12310, 710] },
  { group: '업종 중분류', name: '수산 기자재 생산 및 설치업', values: [7881, 4622, 1192, 1937, 130] },
  { group: '업종 중분류', name: '어선·낚시선박 및 수산기자재 유통업', values: [6537, 3393, 978, 1998, 168] },
  { group: '업종 중분류', name: '수산관련 서비스업', values: [116814, 86580, 14149, 16030, 55] },
  { group: '종사자 규모', name: '1~4인', values: [185176, 153440, 15310, 16143, 284] },
  { group: '종사자 규모', name: '5~9인', values: [96014, 74184, 8944, 12724, 163] },
  { group: '종사자 규모', name: '10~19인', values: [125067, 96141, 11169, 16371, 1387] },
  { group: '종사자 규모', name: '20~99인', values: [265745, 197368, 30093, 37635, 648] },
  { group: '종사자 규모', name: '100인 이상', values: [218859, 174427, 12907, 30570, 955] },
  { group: '매출액 규모', name: '1억 미만', values: [172596, 153282, 6685, 12455, 174] },
  { group: '매출액 규모', name: '1억 이상~5억 미만', values: [347262, 281411, 32391, 32775, 684] },
  { group: '매출액 규모', name: '5억 이상~10억 미만', values: [90096, 73749, 7782, 7815, 750] },
  { group: '매출액 규모', name: '10억 이상', values: [280906, 187118, 31563, 60397, 1828] },
]

const fmt = new Intl.NumberFormat('ko-KR')

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
}

export default function App() {
  const [metric, setMetric] = useState(0)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('업종 중분류')

  const filtered = useMemo(() => rows.filter(r => r.group === group && r.name.includes(query)), [group, query])
  const ranked = useMemo(() => [...filtered].sort((a, b) => b.values[metric] - a.values[metric]), [filtered, metric])
  const max = Math.max(...ranked.map(r => r.values[metric]), 1)
  const min = Math.min(...ranked.map(r => r.values[metric]), 0)
  const total = rows[0].values[metric]
  const top = ranked[0]
  const normalized = ranked.map(r => ({ ...r, norm: max === min ? 0 : (r.values[metric] - min) / (max - min) }))
  const points = normalized.map((r, i) => `${normalized.length === 1 ? 50 : 5 + i * (90 / (normalized.length - 1))},${86 - r.norm * 70}`).join(' ')

  return (
    <main className="min-h-screen bg-[#f4f6f3] text-[#17221c]">
      <header className="border-b border-[#dfe5df] bg-[#f9faf8]">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#134e3a] text-sm font-bold text-white">K</div>
            <div><p className="text-sm font-bold tracking-tight">KOSIS DATA LAB</p><p className="text-[11px] text-[#718078]">국가통계 시각화</p></div>
          </div>
          <div className="rounded-full border border-[#d8e0da] bg-white px-3 py-1.5 text-xs font-medium text-[#526159]">데이터 기준 · 2016</div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-6 py-8 lg:px-10">
        <section className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="mb-2 text-xs font-bold tracking-[.18em] text-[#167352]">FISHERIES WORKFORCE</p>
            <h1 className="text-3xl font-semibold tracking-[-.04em] lg:text-4xl">수산업 종사자 학력 현황</h1>
            <p className="mt-3 text-sm text-[#65736b]">통계청 원자료를 기반으로 업종과 사업체 규모별 종사자 분포를 살펴봅니다.</p>
          </div>
          <label className="relative block w-full lg:w-80">
            <span className="sr-only">항목 검색</span>
            <span className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718078]"><SearchIcon /></span>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="업종 또는 규모 검색" className="w-full rounded-xl border border-[#d9e1db] bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#167352] focus:ring-2 focus:ring-[#167352]/10" />
          </label>
        </section>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          {['업종 중분류', '업종 대분류', '종사자 규모', '매출액 규모'].map(item => (
            <button key={item} onClick={() => setGroup(item)} className={`rounded-full px-4 py-2 text-xs font-semibold transition ${group === item ? 'bg-[#172e25] text-white' : 'border border-[#d8e0da] bg-white text-[#5d6c64] hover:border-[#9eaaa3]'}`}>{item}</button>
          ))}
          <select value={metric} onChange={e => setMetric(Number(e.target.value))} className="ml-auto rounded-xl border border-[#d8e0da] bg-white px-4 py-2.5 text-xs font-semibold outline-none">
            {metrics.map((m, i) => <option value={i} key={m}>{m}</option>)}
          </select>
        </div>

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-[#e0e6e1] bg-white p-5 shadow-[0_8px_30px_rgba(30,55,43,.04)]">
            <p className="text-xs font-semibold text-[#76837c]">전체 종사자</p><p className="mt-2 text-3xl font-semibold tracking-tight">{fmt.format(total)}<span className="ml-1 text-sm font-medium text-[#76837c]">명</span></p>
          </article>
          <article className="rounded-2xl border border-[#e0e6e1] bg-white p-5 shadow-[0_8px_30px_rgba(30,55,43,.04)]">
            <p className="text-xs font-semibold text-[#76837c]">{group} 최다</p><p className="mt-2 truncate text-xl font-semibold">{top?.name ?? '검색 결과 없음'}</p><p className="mt-1 text-xs text-[#167352]">{top ? `${fmt.format(top.values[metric])}명` : '검색어를 변경해 주세요'}</p>
          </article>
          <article className="rounded-2xl border border-[#e0e6e1] bg-[#173f30] p-5 text-white shadow-[0_8px_30px_rgba(30,55,43,.08)]">
            <p className="text-xs font-semibold text-white/60">데이터 범위</p><p className="mt-2 text-xl font-semibold">2016 단일 연도</p><p className="mt-1 text-xs text-white/65">지역 열 미포함 · 업종 기준 제공</p>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
          <article className="rounded-2xl border border-[#e0e6e1] bg-white p-6 shadow-[0_8px_30px_rgba(30,55,43,.04)]">
            <div className="mb-6 flex items-start justify-between"><div><h2 className="font-semibold">2016 항목별 순위</h2><p className="mt-1 text-xs text-[#79867f]">{metrics[metric]} 기준 · 단위: 명</p></div><span className="rounded-md bg-[#e9f4ee] px-2 py-1 text-[10px] font-bold text-[#167352]">{ranked.length}개 항목</span></div>
            <div className="space-y-4">
              {ranked.map((r, i) => <div key={r.name} className="grid grid-cols-[24px_minmax(100px,170px)_1fr_70px] items-center gap-3 text-xs">
                <span className="font-semibold text-[#9aa59f]">{String(i + 1).padStart(2, '0')}</span><span className="truncate font-medium">{r.name}</span>
                <div className="h-2 overflow-hidden rounded-full bg-[#edf1ee]"><div className="h-full rounded-full bg-[#24a06b]" style={{ width: `${(r.values[metric] / max) * 100}%` }} /></div>
                <span className="text-right font-semibold tabular-nums">{fmt.format(r.values[metric])}</span>
              </div>)}
              {!ranked.length && <p className="py-16 text-center text-sm text-[#79867f]">일치하는 항목이 없습니다.</p>}
            </div>
          </article>

          <div className="grid gap-6">
            <article className="rounded-2xl border border-[#e0e6e1] bg-white p-6 shadow-[0_8px_30px_rgba(30,55,43,.04)]">
              <h2 className="font-semibold">정규화 비교</h2><p className="mt-1 text-xs text-[#79867f]">선택 항목의 최솟값 0 · 최댓값 1</p>
              <div className="mt-5 h-48 rounded-xl bg-[#f7f9f7] p-3">
                {normalized.length > 1 ? <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
                  {[16, 51, 86].map(y => <line key={y} x1="5" y1={y} x2="95" y2={y} stroke="#dfe6e1" strokeWidth=".6" />)}
                  <polyline points={points} fill="none" stroke="#167352" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  {normalized.map((r, i) => <circle key={r.name} cx={5 + i * (90 / (normalized.length - 1))} cy={86 - r.norm * 70} r="2" fill="#fff" stroke="#167352" strokeWidth="1.5"><title>{r.name}: {r.norm.toFixed(2)}</title></circle>)}
                </svg> : <div className="flex h-full items-center justify-center text-xs text-[#79867f]">두 개 이상의 항목이 필요합니다.</div>}
              </div>
              <div className="mt-3 flex justify-between text-[10px] text-[#87938d]"><span>{normalized[0]?.name}</span><span>{normalized.at(-1)?.name}</span></div>
            </article>
            <article className="rounded-2xl border border-[#e7dfca] bg-[#fffaf0] p-5">
              <p className="text-xs font-bold text-[#866b2f]">데이터 안내</p>
              <p className="mt-2 text-xs leading-5 text-[#756b55]">첨부 CSV에는 시·군·구와 추가 연도가 없어 지역 순위 및 연도 추이는 계산할 수 없습니다. 해당 열이 포함된 CSV를 추가하면 동일한 화면 구조로 확장할 수 있습니다.</p>
            </article>
          </div>
        </section>
      </div>
    </main>
  )
}
