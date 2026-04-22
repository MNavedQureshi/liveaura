# ── Build stage ────────────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder
WORKDIR /app

# opus + git + C toolchain (git is required by go mod download)
RUN apk add --no-cache opus-dev build-base git

# Force module proxy; skip sum DB so empty go.sum is fine
ENV GOPROXY=https://proxy.golang.org,direct
ENV GONOSUMDB=*
ENV CGO_ENABLED=1

# Download dependencies (module cache layer)
COPY go.mod ./
RUN go mod download

# Copy source and tidy / build
COPY . .
RUN go mod tidy
RUN go build -ldflags="-s -w" -o /out/server ./cmd/server
RUN go build -ldflags="-s -w" -o /out/agent  ./cmd/agent

# ── Runtime stage — ~25 MB final image ─────────────────────────────────────────
FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata opus

COPY --from=builder /out/server /server
COPY --from=builder /out/agent  /agent

EXPOSE 8000 8001
CMD ["/server"]
