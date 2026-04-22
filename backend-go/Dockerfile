# ── Build stage ────────────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder
WORKDIR /app

# opus for the hraban/opus CGO wrapper (package name on Alpine aarch64 is opus-dev)
RUN apk add --no-cache opus-dev build-base git

# Cache Go modules first (layer cache friendly)
# go.sum is generated on first build via go mod tidy inside the container
COPY go.mod ./
RUN touch go.sum && go mod download && go mod tidy

COPY . .

# Build both binaries — strip debug info for smaller output
RUN GOOS=linux go build -ldflags="-s -w" -o /out/server ./cmd/server
RUN GOOS=linux go build -ldflags="-s -w" -o /out/agent  ./cmd/agent

# ── Runtime stage — ~25 MB final image ─────────────────────────────────────────
FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata opus

COPY --from=builder /out/server /server
COPY --from=builder /out/agent  /agent

EXPOSE 8000 8001
CMD ["/server"]
