import argparse
import math
import os
import sys
from pathlib import Path

import serial
from dotenv import load_dotenv
from serial.tools import list_ports
from supabase import create_client

BAUD_RATE = 9600
MAX_LINE_LENGTH = 1024
PROJECT_ROOT = Path(__file__).resolve().parent


def parse_value(line: bytes) -> int | float:
    try:
        text = line.decode("utf-8").strip()
        value = float(text)
    except (UnicodeDecodeError, ValueError) as error:
        raise ValueError("수신 줄은 숫자여야 합니다.") from error

    if not math.isfinite(value):
        raise ValueError("NaN 또는 무한대는 저장할 수 없습니다.")
    return int(value) if value.is_integer() else value


def available_ports() -> list:
    return sorted(list_ports.comports(), key=lambda port: port.device)


def choose_port(requested_port: str | None, ports: list) -> str:
    if requested_port:
        return requested_port
    if not ports:
        raise RuntimeError(
            "시리얼 포트를 찾을 수 없습니다. 아두이노를 연결하거나 --port로 포트를 지정하세요."
        )
    if len(ports) == 1:
        return ports[0].device
    if not sys.stdin.isatty():
        raise RuntimeError("포트가 여러 개입니다. --port로 아두이노 포트를 지정하세요.")

    print("사용 가능한 시리얼 포트:")
    for index, port in enumerate(ports, start=1):
        print(f"  {index}. {port.device} — {port.description}")

    while True:
        choice = input("아두이노 포트 번호를 선택하세요: ").strip()
        try:
            selected = int(choice)
        except ValueError:
            print("목록에 표시된 번호를 입력하세요.")
            continue
        if 1 <= selected <= len(ports):
            return ports[selected - 1].device
        print("목록에 표시된 번호를 입력하세요.")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="아두이노 시리얼 값을 Supabase readings 테이블에 업로드합니다."
    )
    parser.add_argument("--port", help="아두이노 시리얼 포트 (예: /dev/cu.usbmodem1101 또는 COM3)")
    parser.add_argument("--list-ports", action="store_true", help="사용 가능한 시리얼 포트를 표시하고 종료")
    args = parser.parse_args()

    ports = available_ports()
    if args.list_ports:
        if not ports:
            print("사용 가능한 시리얼 포트가 없습니다.")
            return 0
        for port in ports:
            print(f"{port.device}\t{port.description}")
        return 0

    load_dotenv(PROJECT_ROOT / ".env")
    supabase_url = os.getenv("VITE_SUPABASE_URL")
    supabase_key = os.getenv("VITE_SUPABASE_ANON_KEY")
    if not supabase_url or not supabase_key:
        missing = [
            name
            for name, value in (
                ("VITE_SUPABASE_URL", supabase_url),
                ("VITE_SUPABASE_ANON_KEY", supabase_key),
            )
            if not value
        ]
        raise RuntimeError(
            f".env에 다음 값이 필요합니다: {', '.join(missing)}"
        )

    port_name = choose_port(args.port, ports)
    client = create_client(supabase_url, supabase_key)
    print(f"{port_name}에 {BAUD_RATE} baud로 연결합니다. 종료하려면 Ctrl+C를 누르세요.")

    try:
        with serial.Serial(port_name, BAUD_RATE, timeout=1) as arduino:
            line_buffer = bytearray()
            discarding_long_line = False
            print("시리얼 데이터 대기 중...")
            while True:
                chunk = arduino.readline()
                if not chunk:
                    continue
                if discarding_long_line:
                    if chunk.endswith(b"\n"):
                        discarding_long_line = False
                    continue
                if not chunk.endswith(b"\n"):
                    line_buffer.extend(chunk)
                    if len(line_buffer) > MAX_LINE_LENGTH:
                        line_buffer.clear()
                        discarding_long_line = True
                        print(
                            f"{MAX_LINE_LENGTH}바이트를 초과한 줄을 무시합니다.",
                            file=sys.stderr,
                        )
                    continue

                line = bytes(line_buffer) + chunk
                line_buffer.clear()
                if not line.strip():
                    continue
                try:
                    value = parse_value(line)
                except ValueError as error:
                    print(f"잘못된 수신값을 무시합니다: {error}", file=sys.stderr)
                    continue

                client.table("readings").insert({"value": value}).execute()
                print(f"저장 완료: {value}")
    except KeyboardInterrupt:
        print("\n업로드를 종료합니다.")
    except serial.SerialException as error:
        print(f"시리얼 포트 오류: {error}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
