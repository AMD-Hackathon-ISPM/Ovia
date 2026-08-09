# syntax=docker/dockerfile:1.7
ARG CUDA_RUNTIME_IMAGE=nvidia/cuda:13.0.2-cudnn-runtime-ubuntu24.04
FROM rust:1.90-bookworm AS source
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src

FROM python:3.13-slim-bookworm AS ort-cpu
RUN pip install --no-cache-dir onnxruntime==1.27.0 && mkdir /ort-libs && \
    main="$(find /usr/local/lib/python3.13/site-packages/onnxruntime -name 'libonnxruntime.so.*' | head -1)" && \
    test -n "$main" && cp -L "$main" /ort-libs/libonnxruntime.so

FROM python:3.13-slim-bookworm AS ort-gpu
RUN pip install --no-cache-dir onnxruntime-gpu==1.27.0 && mkdir /ort-libs && \
    main="$(find /usr/local/lib/python3.13/site-packages/onnxruntime -name 'libonnxruntime.so.*' | head -1)" && \
    test -n "$main" && cp -L "$main" /ort-libs/libonnxruntime.so && \
    find /usr/local/lib/python3.13/site-packages/onnxruntime -name 'libonnxruntime_providers_*.so' -exec cp -L {} /ort-libs/ \;

FROM source AS builder-cpu
RUN cargo build --locked --release --bins

FROM source AS builder-gpu
ENV ORT_CUDA_VERSION=13
RUN cargo build --locked --release --features cuda --bins

FROM debian:bookworm-slim AS runtime-cpu
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl libgomp1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder-cpu /app/target/release/ovia-backend /usr/local/bin/ovia-backend
COPY --from=builder-cpu /app/target/release/model-worker /usr/local/bin/model-worker
COPY --from=ort-cpu /ort-libs/ /usr/local/lib/
ENV LD_LIBRARY_PATH=/usr/local/lib ORT_DYLIB_PATH=/usr/local/lib/libonnxruntime.so OVIA_MODELS_DIR=/app/models ORT_EXECUTION_PROVIDER=cpu
USER 65532:65532
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 CMD ["curl","--fail","http://127.0.0.1:8080/api/v1/health"]
ENTRYPOINT ["ovia-backend"]

FROM ${CUDA_RUNTIME_IMAGE} AS runtime-gpu
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl libgomp1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder-gpu /app/target/release/ovia-backend /usr/local/bin/ovia-backend
COPY --from=builder-gpu /app/target/release/model-worker /usr/local/bin/model-worker
COPY --from=ort-gpu /ort-libs/ /usr/local/lib/
ENV LD_LIBRARY_PATH=/usr/local/lib ORT_DYLIB_PATH=/usr/local/lib/libonnxruntime.so OVIA_MODELS_DIR=/app/models ORT_EXECUTION_PROVIDER=cuda
USER 65532:65532
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 CMD ["curl","--fail","http://127.0.0.1:8080/api/v1/health"]
ENTRYPOINT ["ovia-backend"]
