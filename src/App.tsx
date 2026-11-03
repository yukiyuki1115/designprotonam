import { useMemo, useRef, useState } from "react"

type SensorPoint = {
  time: string
  value: number
}

type SerialPort = {
  readable: ReadableStream<Uint8Array> | null
  open(options: { baudRate: number }): Promise<void>
  close(): Promise<void>
}

type SerialApi = {
  requestPort(): Promise<SerialPort>
}

const sensorData: Record<string, SensorPoint[]> = {
  "1시간": [
    { time: "14:00", value: 38 },
    { time: "14:10", value: 43 },
    { time: "14:20", value: 41 },
    { time: "14:30", value: 58 },
    { time: "14:40", value: 54 },
    { time: "14:50", value: 66 },
    { time: "15:00", value: 72 },
  ],
  "6시간": [
    { time: "09:00", value: 31 },
    { time: "10:00", value: 46 },
    { time: "11:00", value: 40 },
    { time: "12:00", value: 63 },
    { time: "13:00", value: 51 },
    { time: "14:00", value: 69 },
    { time: "15:00", value: 72 },
  ],
  "24시간": [
    { time: "00:00", value: 22 },
    { time: "04:00", value: 35 },
    { time: "08:00", value: 29 },
    { time: "12:00", value: 61 },
    { time: "16:00", value: 72 },
    { time: "20:00", value: 48 },
    { time: "현재", value: 72 },
  ],
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
  const [range, setRange] = useState("1시간")
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [livePoints, setLivePoints] = useState<SensorPoint[]>([])
  const [serialStatus, setSerialStatus] =
    useState<"disconnected" | "connecting" | "connected">("disconnected")
  const [serialError, setSerialError] = useState("")
  const [lastUpdated, setLastUpdated] = useState("")
  const portRef = useRef<SerialPort | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const disconnectRequested = useRef(false)
  const data = livePoints.length > 0 ? livePoints : sensorData[range]
  const currentValue = data.at(-1)?.value ?? 0
  const summary = useMemo(() => {
    const values = data.map((item) => item.value)
    return {
      average: (
        values.reduce((sum, value) => sum + value, 0) / values.length
      ).toFixed(1),
      highest: Math.max(...values),
      lowest: Math.min(...values),
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

  const connectSerial = async () => {
    const serial = (navigator as Navigator & { serial?: SerialApi }).serial
    if (!serial) {
      setSerialError(
        "Web Serial API를 지원하는 Chrome 또는 Edge 브라우저에서 열어 주세요.",
      )
      return
    }

    disconnectRequested.current = false
    setSerialStatus("connecting")
    setSerialError("")
    let port: SerialPort | null = null
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null

    try {
      port = await serial.requestPort()
      await port.open({ baudRate: 9600 })
      if (!port.readable) {
        throw new Error("시리얼 포트에서 데이터를 읽을 수 없습니다.")
      }

      portRef.current = port
      reader = port.readable.getReader()
      readerRef.current = reader
      setSerialStatus("connected")

      const decoder = new TextDecoder()
      let buffer = ""
      while (!disconnectRequested.current) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          const value = Number(trimmed)
          if (!Number.isFinite(value)) {
            setSerialError(
              `숫자가 아닌 수신값을 무시했습니다: ${trimmed.slice(0, 40)}`,
            )
            continue
          }
          const point = { time: new Date().toLocaleTimeString("ko-KR"), value }
          setLivePoints((previous) => [...previous, point].slice(-100))
          setLastUpdated(point.time)
          setSelectedIndex(null)
          setSerialError("")
        }
      }
      if (!disconnectRequested.current) {
        setSerialError("시리얼 포트 연결이 종료되었습니다.")
      }
    } catch (error) {
      if (!disconnectRequested.current) {
        const message = error instanceof Error ? error.message : String(error)
        setSerialError(message)
      }
    } finally {
      if (reader) {
        if (readerRef.current === reader) readerRef.current = null
        reader.releaseLock()
      }
      if (port) {
        if (portRef.current === port) portRef.current = null
        try {
          await port.close()
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          setSerialError(`시리얼 포트를 닫지 못했습니다: ${message}`)
        }
      }
      setSerialStatus("disconnected")
    }
  }

  const disconnectSerial = async () => {
    disconnectRequested.current = true
    try {
      await readerRef.current?.cancel()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setSerialError(`시리얼 연결을 종료하지 못했습니다: ${message}`)
    }
  }

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
            <span className="h-2 w-2 rounded-full bg-[#24b47e] shadow-[0_0_0_4px_rgba(36,180,126,.1)]" />
            시스템 정상
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
                : "샘플 데이터 표시 중"}
            </div>
            <button
              onClick={
                serialStatus === "connected" ? disconnectSerial : connectSerial
              }
              disabled={serialStatus === "connecting"}
              className="rounded-xl bg-[#315efb] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#244de0] disabled:cursor-wait disabled:opacity-60"
            >
              {serialStatus === "connecting"
                ? "연결 중…"
                : serialStatus === "connected"
                  ? "연결 종료"
                  : "시리얼 연결"}
            </button>
          </div>
        </section>
        <div className="mb-5 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-full px-3 py-1.5 font-semibold ${
              serialStatus === "connected"
                ? "bg-[#e9f8f1] text-[#16835a]"
                : "bg-[#f0f2f6] text-[#7b8698]"
            }`}
          >
            {serialStatus === "connected"
              ? "9600 baud · 연결됨"
              : serialStatus === "connecting"
                ? "포트 선택 대기 중"
                : "시리얼 미연결"}
          </span>
          {serialError && (
            <p role="status" className="text-[#c2413b]">
              {serialError}
            </p>
          )}
        </div>

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
                    {currentValue}
                  </strong>
                  {!livePoints.length && (
                    <span className="mb-3 ml-3 text-xl font-semibold text-white/65">
                      %
                    </span>
                  )}
                </div>
                <div className="mt-6 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold">
                  <TrendIcon />
                  {livePoints.length > 1
                    ? `이전 측정 대비 ${
                        currentValue -
                          livePoints[livePoints.length - 2].value >=
                        0
                          ? "+"
                          : ""
                      }${currentValue - livePoints[livePoints.length - 2].value}`
                    : livePoints.length === 1
                      ? "첫 번째 측정값"
                      : "이전 측정 대비 +6%"}
                </div>
              </div>

              <div className="border-t border-white/15 pt-5">
                <div className="mb-2.5 flex justify-between text-[11px] font-medium text-white/60">
                  <span>감도 수준</span>
                  <span>{livePoints.length ? "실시간" : "높음"}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-white transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, currentValue))}%`,
                    }}
                  />
                </div>
                <div className="mt-5 flex items-center gap-2 text-xs text-white/65">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#68f5c0]" />
                  {serialStatus === "connected"
                    ? "센서 데이터를 실시간으로 수신하고 있습니다."
                    : "시리얼 연결 후 센서 데이터를 표시합니다."}
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
                  {livePoints.length
                    ? "수신된 최근 100개 측정값입니다."
                    : "선택한 기간의 터치 감도 변화 추이입니다."}
                </p>
              </div>
              {livePoints.length ? (
                <span className="w-fit rounded-xl bg-[#eaf0ff] px-3.5 py-2 text-[11px] font-bold text-[#315efb]">
                  최근 {livePoints.length}/100개
                </span>
              ) : (
                <div className="flex w-fit rounded-xl bg-[#f3f5f8] p-1">
                  {Object.keys(sensorData).map((item) => (
                    <button
                      key={item}
                      onClick={() => {
                        setRange(item)
                        setSelectedIndex(null)
                      }}
                      className={`rounded-lg px-3.5 py-2 text-[11px] font-bold transition ${
                        range === item
                          ? "bg-white text-[#315efb] shadow-sm"
                          : "text-[#8a94a6] hover:text-[#596579]"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
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
                    {chart.points[selectedIndex].value}%
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
                  <g key={`${range}-${index}-${point.time}`}>
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
                <p className="mt-1 text-base font-bold">
                  {summary.average}
                  {!livePoints.length && (
                    <span className="ml-0.5 text-xs text-[#969fad]">%</span>
                  )}
                </p>
              </div>
              <div className="px-3 sm:px-5">
                <p className="text-[10px] font-semibold text-[#969fad]">
                  최고값
                </p>
                <p className="mt-1 text-base font-bold">
                  {summary.highest}
                  {!livePoints.length && (
                    <span className="ml-0.5 text-xs text-[#969fad]">%</span>
                  )}
                </p>
              </div>
              <div className="px-3 sm:px-5">
                <p className="text-[10px] font-semibold text-[#969fad]">
                  최저값
                </p>
                <p className="mt-1 text-base font-bold">
                  {summary.lowest}
                  {!livePoints.length && (
                    <span className="ml-0.5 text-xs text-[#969fad]">%</span>
                  )}
                </p>
              </div>
            </div>
          </article>
        </section>

        <p className="mt-5 text-right text-[11px] text-[#a0a8b5]">
          {livePoints.length
            ? "수신 데이터는 저장하지 않고 현재 화면에서만 유지합니다."
            : "현재 화면은 예시 데이터를 사용하고 있습니다."}
        </p>
      </div>
    </main>
  )
}
