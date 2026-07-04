FROM python:3.11-slim

WORKDIR /srv

# libgl/libglib are needed by opencv (ultralytics dependency)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download model weights so cold starts are fast:
#  - rembg u2net segmentation model (~170 MB)
#  - default YOLO weights (swap via MODEL_PATH for a fashion-trained model)
RUN python -c "from rembg import new_session; new_session('u2net')" \
    && python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
