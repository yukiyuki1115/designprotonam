import { createClient } from "@supabase/supabase-js"
import { useEffect, useMemo, useState } from "react"

type SensorPoint = {
  id: string
  createdAt: string
  time: string
  value: number
}

type ReadingRow = {
  id: string | number
  value: number | string
  created_at: string
}

type ConnectionStatus = "connecting" | "connected" | "error"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

function toSensorPoint(row: Record<string, unknown>): SensorPoint | null {
  const value = Number(row.value)
  const createdAt = row.created_at
  if (
    !Number.isFinite(value) ||
    typeof createdAt !== "string" ||
    Number.isNaN(Date.parse(createdAt))
  ) {
    return null
  }

  const id =
    typeof row.id === "string" || typeof row.id === "number"
      ? String(row.id)
      : `${createdAt}:${value}`
  return {
    id,
    createdAt,
    time: new Date(createdAt).toLocaleTimeString("ko-KR"),
    value,
  }
}

function mergeReadings(...groups: SensorPoint[][]): SensorPoint[] {
  const readings = new Map<string, SensorPoint>()
  for (const group of groups) {
    for (const point of group) readings.set(point.id, point)
  }
  return [...readings.values()]
    .sort(
      (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
    )
    .slice(-100)
}

function LogoMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
      <path d="M10.5 23.5V15a5.5 5.5 0 0 1 11 0v8.5" strokeWidth="2.4" />
      <path
        d="M6.5 21.5V15a9.5 9.5 0 0 1 19 0v6.5M14 23.5v-9a2 2 0 0 1 4 0v9"
        strokeWidth="2.4"
      />
    </svg>
  )
}

function SensorIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path d="M8.5 18v-7.5a3.5 3.5 0 0 1 7 0V18M5 16v-5.5a7 7 0 0 1 14 0V16M12 14.5V20" />
    </svg>
  )
}

function TrendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path d="m4 16 5-5 4 4 7-8M15 7h5v5" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

export default function App() {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [readings, setReadings] = useState<SensorPoint[]>([])
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting")
  const [connectionError, setConnectionError] = useState("")
  const [lastUpdated, setLastUpdated] = useState("")
  const data = readings
  const currentValue = data.at(-1)?.value ?? null

  useEffect(() => {
    let active = true
    const client = supabase
    if (!client) {
      setConnectionStatus("error")
      setConnectionError(
        "VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY 환경 변수를 찾을 수 없습니다.",
      )
      return
    }

    const channel = client
      .channel("readings-dashboard")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "readings" },
        (payload) => {
          const point = toSensorPoint(payload.new as Record<string, unknown>)
          if (!point) {
            setConnectionError(
              "새 readings 행에 유효한 value 또는 created_at 값이 없습니다.",
            )
            return
          }
          setReadings((previous) => mergeReadings(previous, [point]))
          setLastUpdated(point.time)
          setSelectedIndex(null)
        },
      )
      .subscribe((status, error) => {
        if (!active) return
        if (status === "SUBSCRIBED") {
          setConnectionStatus("connected")
          setConnectionError("")
          void loadLatestReadings()
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setConnectionStatus("error")
          setConnectionError(
            error?.message ??
              `Supabase Realtime 연결 상태: ${status}. 테이블 Realtime 설정과 네트워크를 확인하세요.`,
          )
        }
      })

    async function loadLatestReadings() {
      if (!client) return
      const { data: rows, error } = await client
        .from("readings")
        .select("id, value, created_at")
        .order("created_at", { ascending: false })
        .limit(100)

      if (!active) return
      if (error) {
        setConnectionStatus("error")
        setConnectionError(`readings 조회 실패: ${error.message}`)
        return
      }

      const points = (rows as ReadingRow[])
        .map((row) =>
          toSensorPoint({
            id: row.id,
            value: row.value,
            created_at: row.created_at,
          }),
        )
        .filter((point): point is SensorPoint => point !== null)
      setReadings((previous) => mergeReadings(points, previous))
      setLastUpdated(points.at(-1)?.time ?? "")
      setSelectedIndex(null)
    }

    return () => {
      active = false
      void client.removeChannel(channel)
    }
  }, [])

  const summary = useMemo(() => {
    const values = data.map((item) => item.value)
    return {
      average: values.length
        ? (
            values.reduce((sum, value) => sum + value, 0) / values.length
          ).toFixed(1)
        : "—",
      highest: values.length ? Math.max(...values) : "—",
      lowest: values.length ? Math.min(...values) : "—",
    }
  }, [data])

  const chart = useMemo(() => {
    const width = 760
    const height = 260
    const left = 48
    const right = 20
    const top = 20
    const bottom = 34
    const innerWidth = width - left - right
    const innerHeight = height - top - bottom
    const values = data.map((item) => item.value)
    const minValue = Math.min(0, ...values)
    const maxValue = Math.max(100, ...values)
    const points = data.map((item, index) => ({
      ...item,
      x: left + (index * innerWidth) / Math.max(data.length - 1, 1),
      y:
        top +
        innerHeight -
        ((item.value - minValue) / (maxValue - minValue)) * innerHeight,
    }))
    const line = points.map((point) => `${point.x},${point.y}`).join(" ")
    const area = `${left},${top + innerHeight} ${line} ${width - right},${top + innerHeight}`
    const ticks = Array.from(
      { length: 5 },
      (_, index) => minValue + ((maxValue - minValue) * index) / 4,
    )
    return {
      width,
      height,
      left,
      right,
      top,
      bottom,
      innerHeight,
      points,
      line,
      area,
      ticks,
      minValue,
      maxValue,
    }
  }, [data])

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-[#172033]">
      <header className="border-b border-[#e7ebf1] bg-white">
        <div className="mx-auto flex h-[72px] max-w-[1380px] items-center justify-between px-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#315efb] text-white shadow-[0_6px_16px_rgba(49,94,251,.22)]">
              <LogoMark />
            </div>
            <div>
              <p className="text-[15px] font-bold tracking-[-.02em]">
                TOUCH SENSE
              </p>
              <p className="text-[11px] font-medium text-[#8b95a7]">
                센서 모니터링 시스템
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#e6eaf0] bg-[#fafbfc] px-3 py-2 text-xs font-semibold text-[#596579]">
            <span
              className={`h-2 w-2 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-[#24b47e] shadow-[0_0_0_4px_rgba(36,180,126,.1)]"
                  : connectionStatus === "error"
                    ? "bg-[#e25555]"
                    : "bg-[#e4a834]"
              }`}
            />
            {connectionStatus === "connected"
              ? "Realtime 연결됨"
              : connectionStatus === "error"
                ? "연결 오류"
                : "Supabase 연결 중"}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1380px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <section className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-bold tracking-[.16em] text-[#315efb]">
              LIVE MONITORING
            </p>
            <h1 className="text-3xl font-bold tracking-[-.045em] sm:text-[36px]">
              터치센서 대시보드
            </h1>
            <p className="mt-2 text-sm text-[#7b8698]">
              센서의 실시간 측정값과 시간에 따른 변화를 확인하세요.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-xs font-medium text-[#8a94a6]">
              <ClockIcon />
              {lastUpdated
                ? `마지막 업데이트 · ${lastUpdated}`
                : "데이터 불러오는 중"}
            </div>
          </div>
        </section>
        {connectionError && (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-[#f1d4d4] bg-[#fff7f7] px-4 py-3 text-xs text-[#b63d3d]"
          >
            {connectionError}
          </p>
        )}

        <section className="grid gap-5 lg:grid-cols-[minmax(300px,.72fr)_minmax(0,1.55fr)]">
          <article className="relative min-h-[440px] overflow-hidden rounded-[24px] bg-[#315efb] p-7 text-white shadow-[0_18px_50px_rgba(49,94,251,.2)] sm:p-8">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border-[50px] border-white/[.055]" />
            <div className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-white/[.04]" />
            <div className="relative flex h-full flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
                  <SensorIcon />
                  현재 센서값
                </div>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold">
                  SENSOR 01
                </span>
              </div>

              <div className="flex flex-1 flex-col justify-center py-10">
                <div className="flex items-end">
                  <strong className="text-[88px] font-bold leading-none tracking-[-.07em] sm:text-[104px]">
                    {currentValue ?? "—"}
                  </strong>
                </div>
                <div className="mt-6 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold">
                  <TrendIcon />
                  {readings.length > 1
                    ? `이전 값 대비 ${
                        readings[readings.length - 1].value -
                          readings[readings.length - 2].value >=
                        0
                          ? "+"
                          : ""
                      }${
                        readings[readings.length - 1].value -
                        readings[readings.length - 2].value
                      }`
                    : readings.length === 1
                      ? "최신 측정값"
                      : "데이터 대기 중"}
                </div>
              </div>

              <div className="border-t border-white/15 pt-5">
                <div className="mb-2.5 flex justify-between text-[11px] font-medium text-white/60">
                  <span>저장된 readings</span>
                  <span>{readings.length} / 100</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-white transition-all"
                    style={{
                      width: `${readings.length}%`,
                    }}
                  />
                </div>
                <div className="mt-5 flex items-center gap-2 text-xs text-white/65">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      connectionStatus === "connected"
                        ? "bg-[#68f5c0]"
                        : "bg-white/50"
                    }`}
                  />
                  {connectionStatus === "connected"
                    ? "새 데이터가 Realtime으로 반영됩니다."
                    : "Supabase readings 데이터를 기다리는 중입니다."}
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-[24px] border border-[#e7ebf1] bg-white p-5 shadow-[0_12px_40px_rgba(26,39,68,.055)] sm:p-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-lg font-bold tracking-[-.025em]">
                  시간에 따른 센서 변화
                </h2>
                <p className="mt-1.5 text-xs text-[#8a94a6]">
                  Supabase readings의 최근 측정값 · 단위는 value 기준
                </p>
              </div>
              <span className="w-fit rounded-xl bg-[#eaf0ff] px-3.5 py-2 text-[11px] font-bold text-[#315efb]">
                최근 {readings.length}/100개
              </span>
            </div>

            <div className="relative mt-8">
              {selectedIndex !== null && (
                <div
                  className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg bg-[#172033] px-3 py-2 text-center text-[10px] text-white shadow-lg"
                  style={{
                    left: `${(chart.points[selectedIndex].x / chart.width) * 100}%`,
                    top: `${Math.max(0, (chart.points[selectedIndex].y / chart.height) * 100 - 13)}%`,
                  }}
                >
                  <strong className="block text-xs">
                    {chart.points[selectedIndex].value}
                  </strong>
                  <span className="text-white/60">
                    {chart.points[selectedIndex].time}
                  </span>
                </div>
              )}
              <svg
                viewBox={`0 0 ${chart.width} ${chart.height}`}
                className="h-[280px] w-full overflow-visible"
                role="img"
                aria-label="시간대별 터치 센서값 선 그래프"
              >
                <defs>
                  <linearGradient id="sensorArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#315efb" stopOpacity=".2" />
                    <stop offset="100%" stopColor="#315efb" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {chart.ticks.map((value) => {
                  const y =
                    chart.top +
                    chart.innerHeight -
                    ((value - chart.minValue) /
                      (chart.maxValue - chart.minValue)) *
                      chart.innerHeight
                  return (
                    <g key={value}>
                      <line
                        x1={chart.left}
                        y1={y}
                        x2={chart.width - chart.right}
                        y2={y}
                        stroke="#edf0f4"
                        strokeWidth="1"
                      />
                      <text
                        x="34"
                        y={y + 4}
                        textAnchor="end"
                        fill="#a1a9b6"
                        stroke="none"
                        fontSize="10"
                      >
                        {Number.isInteger(value) ? value : value.toFixed(1)}
                      </text>
                    </g>
                  )
                })}
                <polygon
                  points={chart.area}
                  fill="url(#sensorArea)"
                  stroke="none"
                />
                <polyline
                  points={chart.line}
                  fill="none"
                  stroke="#315efb"
                  strokeWidth="3.5"
                />
                {chart.points.map((point, index) => (
                  <g key={`${point.id}-${index}`}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="12"
                      fill="transparent"
                      stroke="none"
                      className="cursor-pointer"
                      onMouseEnter={() => setSelectedIndex(index)}
                      onMouseLeave={() => setSelectedIndex(null)}
                      onClick={() =>
                        setSelectedIndex(selectedIndex === index ? null : index)
                      }
                    />
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={index === data.length - 1 ? 5 : 3.5}
                      fill="#fff"
                      stroke="#315efb"
                      strokeWidth="2.5"
                      className="pointer-events-none"
                    />
                    {(data.length <= 8 ||
                      index === 0 ||
                      index === data.length - 1 ||
                      index % Math.ceil(data.length / 6) === 0) && (
                      <text
                        x={point.x}
                        y={chart.height - 8}
                        textAnchor="middle"
                        fill="#9099a8"
                        stroke="none"
                        fontSize="10"
                      >
                        {point.time}
                      </text>
                    )}
                  </g>
                ))}
              </svg>
            </div>

            <div className="mt-2 grid grid-cols-3 divide-x divide-[#e9edf2] rounded-2xl bg-[#f8f9fb] px-2 py-4">
              <div className="px-3 sm:px-5">
                <p className="text-[10px] font-semibold text-[#969fad]">
                  평균값
                </p>
                <p className="mt-1 text-base font-bold">{summary.average}</p>
              </div>
              <div className="px-3 sm:px-5">
                <p className="text-[10px] font-semibold text-[#969fad]">
                  최고값
                </p>
                <p className="mt-1 text-base font-bold">{summary.highest}</p>
              </div>
              <div className="px-3 sm:px-5">
                <p className="text-[10px] font-semibold text-[#969fad]">
                  최저값
                </p>
                <p className="mt-1 text-base font-bold">{summary.lowest}</p>
              </div>
            </div>
          </article>
        </section>

        <p className="mt-5 text-right text-[11px] text-[#a0a8b5]">
          Supabase readings 테이블의 최근 100개 행을 표시합니다.
        </p>
      </div>
    </main>
  )
}
