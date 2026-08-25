FROM python:3.12-slim

WORKDIR /app

# libgl1/libglib2.0-0: docling's OCR/layout stack pulls in opencv, which
# needs these even though nothing here touches a display.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 8100

# --host 0.0.0.0 is required here (unlike local dev): the default 127.0.0.1
# would only accept connections from inside the container itself.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8100"]
