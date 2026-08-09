# Container deployment

The production topology runs the browser UI and orchestration API separately from four isolated ONNX workers. Only the Nginx gateway publishes a host port.

```text
browser -> gateway:80 -> frontend:8080
                    -> api:8080 -> model-biomedclip:8091
                                -> model-convnext:8092
                                -> model-xgboost:8093
                                -> model-unetpp:8094
```

The `models` network is Docker-internal. Workers mount the manifest, metadata, and only their own ONNX file read-only. The API has no model mount. Every model call has an independent timeout, so one stopped, crashed, or stuck worker produces `inference_error` only for that evidence source.

## CPU stack

From the repository root:

```powershell
Copy-Item .env.example .env
docker compose up -d --build
docker compose ps
Invoke-RestMethod http://localhost/api/v1/health
```

Open `http://localhost`. Change `OVIA_HTTP_PORT` in `.env` if port 80 is occupied.

Useful operations:

```powershell
docker compose logs -f api model-unetpp
docker compose restart model-biomedclip
docker compose down
```

`docker compose down` removes containers and networks. It does not remove the source model artifacts.

## NVIDIA GPU workers

Install the NVIDIA Container Toolkit and verify `docker run --gpus all ... nvidia-smi` works. Then run:

```powershell
docker compose -f compose.yaml -f compose.gpu.yaml up -d --build
```

The overlay enables CUDA for BiomedCLIP, ConvNeXt, and U-Net++. XGBoost stays on CPU. All GPU workers currently share the selected GPU; use device IDs in the overlay when deploying across multiple GPUs.

## Resource and security boundaries

- Containers use read-only root filesystems, `no-new-privileges`, PID limits, memory/CPU limits, and tmpfs for runtime scratch space.
- Model workers are not connected to the edge network and expose no host ports.
- Nginx enforces the upload ceiling and basic browser security headers.
- Uploaded images, answers, masks, and outputs are transient. The stack does not persist them.
- TLS should terminate at a trusted ingress or load balancer in front of port 80 for internet-facing deployment.

## Why there is no database, Redis, or MinIO

The current application has no account, job queue, durable result, or object-storage contract. Adding Postgres, Redis, or MinIO would create idle infrastructure and a new sensitive-data retention surface. Introduce them only with an explicit persistence/retention design, encryption and access controls, deletion policy, and clinical privacy review. Worker isolation and timeouts solve the current availability requirement without persistent services.

## Failure behavior

The API probes all workers during startup. Compose starts it only after every worker is healthy. After startup, an individual worker can fail independently: the API continues returning HTTP 200 with the affected evidence status set to `inference_error`, while successful evidence from other models remains available. `restart: unless-stopped` restarts crashed services; request timeouts protect against processes that remain alive but stop responding.
