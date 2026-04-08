package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/9seconds/mtg/v2/antireplay"
	"github.com/9seconds/mtg/v2/events"
	"github.com/9seconds/mtg/v2/ipblocklist"
	"github.com/9seconds/mtg/v2/logger"
	"github.com/9seconds/mtg/v2/mtglib"
	networkv2 "github.com/9seconds/mtg/v2/network/v2"
)

const configPath = "/config/secrets.txt"

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// allowAll implements mtglib.IPBlocklist allowing every IP.
type allowAll struct{}

func (allowAll) Contains(net.IP) bool { return true }
func (allowAll) Run(time.Duration)    {}
func (allowAll) Shutdown()            {}

type keepAliveListener struct {
	*net.TCPListener
}

func (l keepAliveListener) Accept() (net.Conn, error) {
	tc, err := l.TCPListener.AcceptTCP()
	if err != nil {
		return nil, err
	}
	tc.SetKeepAlive(true)
	tc.SetKeepAlivePeriod(30 * time.Second)
	return tc, nil
}

// counter tracks traffic and active connections for one user/secret.
type counter struct {
	received atomic.Int64
	sent     atomic.Int64
	active   atomic.Int64
}

// observer implements events.Observer, routing traffic to a counter.
type observer struct {
	c         *counter
	userID    string
	port      string
	startTime time.Time
}

func (o *observer) EventTraffic(e mtglib.EventTraffic) {
	if e.IsRead {
		o.c.received.Add(int64(e.Traffic))
	} else {
		o.c.sent.Add(int64(e.Traffic))
	}
}

func (o *observer) EventStart(e mtglib.EventStart) {
	o.startTime = time.Now()
	o.c.active.Add(1)
	slog.Info("connect", "userId", o.userID, "port", o.port, "clientIP", e.RemoteIP, "active", o.c.active.Load())
}

func (o *observer) EventFinish(mtglib.EventFinish) {
	o.c.active.Add(-1)
	slog.Info("disconnect", "userId", o.userID, "port", o.port,
		"duration", time.Since(o.startTime).Round(time.Second),
		"active", o.c.active.Load())
}

func (o *observer) EventConnectedToDC(e mtglib.EventConnectedToDC) {
	slog.Info("dc", "userId", o.userID, "dc", e.DC, "dcIP", e.RemoteIP)
}

func (o *observer) EventConcurrencyLimited(mtglib.EventConcurrencyLimited) {
	slog.Warn("concurrency limited", "userId", o.userID)
}

func (o *observer) EventReplayAttack(mtglib.EventReplayAttack) {
	slog.Warn("replay attack", "userId", o.userID)
}

func (o *observer) EventDomainFronting(mtglib.EventDomainFronting)   {}
func (o *observer) EventIPBlocklisted(mtglib.EventIPBlocklisted)     {}
func (o *observer) EventIPListSize(mtglib.EventIPListSize)           {}
func (o *observer) Shutdown()                                        {}

type entry struct {
	userID string
	secret string
	port   string
}

func loadEntries() ([]entry, error) {
	f, err := os.Open(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	defer f.Close()

	var entries []entry
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, ":", 3)
		var e entry
		switch len(parts) {
		case 2: // secret:port — userId defaults to secret
			e = entry{userID: parts[0], secret: parts[0], port: parts[1]}
		case 3: // userId:secret:port
			e = entry{userID: parts[0], secret: parts[1], port: parts[2]}
		default:
			slog.Warn("skipping invalid line", "line", line)
			continue
		}
		entries = append(entries, e)
	}
	return entries, scanner.Err()
}

func startProxy(ctx context.Context, e entry, c *counter, ntw mtglib.Network, arc mtglib.AntiReplayCache) error {
	secret, err := mtglib.ParseSecret(e.secret)
	if err != nil {
		return fmt.Errorf("parse secret: %w", err)
	}

	stream := events.NewEventStream([]events.ObserverFactory{
		func() events.Observer { return &observer{c: c, userID: e.userID, port: e.port} },
	})

	proxy, err := mtglib.NewProxy(mtglib.ProxyOpts{
		Secret:          secret,
		Network:         ntw,
		AntiReplayCache: arc,
		IPBlocklist:     ipblocklist.NewNoop(),
		IPAllowlist:     allowAll{},
		EventStream:     stream,
		Logger:          logger.NewNoopLogger(),
		Concurrency:     100,
		IdleTimeout:     2 * time.Minute,
	})
	if err != nil {
		return fmt.Errorf("new proxy: %w", err)
	}

	addr, err := net.ResolveTCPAddr("tcp", "0.0.0.0:"+e.port)
	if err != nil {
		return fmt.Errorf("resolve addr :%s: %w", e.port, err)
	}
	tcpLn, err := net.ListenTCP("tcp", addr)
	if err != nil {
		return fmt.Errorf("listen :%s: %w", e.port, err)
	}

	go func() {
		<-ctx.Done()
		tcpLn.Close()
		proxy.Shutdown()
	}()

	slog.Info("proxy started", "userId", e.userID, "port", e.port)
	return proxy.Serve(keepAliveListener{tcpLn})
}

func serveStats(counters map[string]*counter, tokens []string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if len(tokens) > 0 {
			provided := r.Header.Get("X-Admin-Token")
			ok := false
			for _, t := range tokens {
				if provided == t {
					ok = true
					break
				}
			}
			if !ok {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
		}
		type userStats struct {
			BytesReceived int64 `json:"bytesReceived"`
			BytesSent     int64 `json:"bytesSent"`
			Active        int64 `json:"active"`
		}
		result := make(map[string]userStats, len(counters))
		for userID, c := range counters {
			result[userID] = userStats{
				BytesReceived: c.received.Load(),
				BytesSent:     c.sent.Load(),
				Active:        c.active.Load(),
			}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	}
}

func main() {
	entries, err := loadEntries()
	if err != nil {
		slog.Error("load config", "err", err)
		os.Exit(1)
	}

	if len(entries) == 0 {
		secret := mtglib.GenerateSecret("aihero.dev")
		slog.Info("no config — using random secret", "port", "8443", "secret", secret.String())
		entries = []entry{{userID: secret.String(), secret: secret.String(), port: "8443"}}
	}

	ntw := networkv2.New(nil, "", 10*time.Second, 10*time.Second, time.Minute)
	arc := antireplay.NewStableBloomFilter(0, -1)

	counters := make(map[string]*counter, len(entries))
	for _, e := range entries {
		counters[e.userID] = &counter{}
	}

	statsPort := getenv("STATS_PORT", "63090")
	var tokens []string
	if raw := os.Getenv("ADMIN_INTERFACE_TOKEN"); raw != "" {
		for _, t := range strings.Split(raw, ",") {
			if t = strings.TrimSpace(t); t != "" {
				tokens = append(tokens, t)
			}
		}
	}

	slog.Info("starting", "proxies", len(entries), "goVersion", runtime.Version())

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer cancel()

	var wg sync.WaitGroup

	// Periodic runtime stats — goroutine count + heap to catch memory/goroutine leaks early.
	wg.Add(1)
	go func() {
		defer wg.Done()
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				slog.Info("shutdown")
				return
			case <-ticker.C:
				var ms runtime.MemStats
				runtime.ReadMemStats(&ms)
				slog.Info("runtime",
					"goroutines", runtime.NumGoroutine(),
					"heapMB", ms.HeapInuse/1024/1024,
					"allocMB", ms.Alloc/1024/1024,
				)
			}
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		srv := &http.Server{Addr: "0.0.0.0:" + statsPort, Handler: serveStats(counters, tokens)}
		go func() {
			<-ctx.Done()
			srv.Shutdown(context.Background())
		}()
		slog.Info("stats listening", "port", statsPort)
		srv.ListenAndServe()
	}()

	for _, e := range entries {
		wg.Add(1)
		go func(e entry) {
			defer wg.Done()
			if err := startProxy(ctx, e, counters[e.userID], ntw, arc); err != nil && ctx.Err() == nil {
				slog.Error("proxy error", "port", e.port, "err", err)
			}
		}(e)
	}
	wg.Wait()
}
