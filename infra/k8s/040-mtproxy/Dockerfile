FROM golang:alpine AS builder
WORKDIR /app
COPY proxy/go.mod proxy/go.sum ./
RUN go mod download
COPY proxy/main.go .
RUN CGO_ENABLED=0 go build -o mtproxy .

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/mtproxy /usr/local/bin/mtproxy
ENTRYPOINT ["mtproxy"]
