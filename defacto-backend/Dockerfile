FROM python:3.11-slim

WORKDIR /app

# 시스템 패키지 설치 (psycopg2 빌드 및 줄바꿈 변환 도구용)
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    libpq-dev \
    dos2unix \
    && rm -rf /var/lib/apt/lists/*

# 의존성 복사 및 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스 코드 복사
COPY . .

# Windows -> Mac/Linux 호환성: CRLF를 LF로 강제 변환
RUN dos2unix entrypoint.sh && chmod +x entrypoint.sh

# 진입점 설정
ENTRYPOINT ["./entrypoint.sh"]