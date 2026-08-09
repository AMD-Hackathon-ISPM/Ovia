# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_OVIA_ADAPTER=live
ARG VITE_OVIA_API_BASE_URL=/ovia
ARG VITE_OVIA_BASE_PATH=/ovia/
ARG VITE_OVIA_REQUEST_TIMEOUT_MS=60000
ENV VITE_OVIA_ADAPTER=$VITE_OVIA_ADAPTER \
    VITE_OVIA_API_BASE_URL=$VITE_OVIA_API_BASE_URL \
    VITE_OVIA_BASE_PATH=$VITE_OVIA_BASE_PATH \
    VITE_OVIA_REQUEST_TIMEOUT_MS=$VITE_OVIA_REQUEST_TIMEOUT_MS
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
