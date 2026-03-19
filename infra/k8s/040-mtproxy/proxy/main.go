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

const (
	configPath  = "/config/secrets.txt"
	statsPort   = "9090"
)

// allowAll implements mtglib.IPBlocklist allowing every IP.
type allowAll struct{}

func (allowAll) Contains(net.IP) bool { return true }
func (allowAll) Run(time.Duration)    {}
func (allowAll) Shutdown()            {}

// counter tracks traffic for one user/secret.
type counter struct {
	received atomic.Int64
	sent     atomic.Int64
}

// observer implements events.Observer, routing traffic to a counter.
type observer struct {
	c *counter
}

func (o *observer) EventTraffic(e mtglib.EventTraffic) {
	if e.IsRead {
		o.c.received.Add(int64(e.Traffic))
	} else {
		o.c.sent.Add(int64(e.Traffic))
	}
}

func (o *observer) EventStart(mtglib.EventStart)                         {}
func (o *observer) EventFinish(mtglib.EventFinish)                       {}
func (o *observer) EventConnectedToDC(mtglib.EventConnectedToDC)         {}
func (o *observer) EventDomainFronting(mtglib.EventDomainFronting)       {}
func (o *observer) EventConcurrencyLimited(mtglib.EventConcurrencyLimited) {}
func (o *observer) EventIPBlocklisted(mtglib.EventIPBlocklisted)         {}
func (o *observer) EventReplayAttack(mtglib.EventReplayAttack)           {}
func (o *observer) EventIPListSize(mtglib.EventIPListSize)               {}
func (o *observer) Shutdown()                                            {}

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
		func() events.Observer { return &observer{c: c} },
	})

	proxy, err := mtglib.NewProxy(mtglib.ProxyOpts{
		Secret:          secret,
		Network:         ntw,
		AntiReplayCache: arc,
		IPBlocklist:     ipblocklist.NewNoop(),
		IPAllowlist:     allowAll{},
		EventStream:     stream,
		Logger:          logger.NewNoopLogger(),
	})
	if err != nil {
		return fmt.Errorf("new proxy: %w", err)
	}

	ln, err := net.Listen("tcp", "0.0.0.0:"+e.port)
	if err != nil {
		return fmt.Errorf("listen :%s: %w", e.port, err)
	}

	go func() {
		<-ctx.Done()
		ln.Close()
		proxy.Shutdown()
	}()

	slog.Info("proxy started", "userId", e.userID, "port", e.port)
	return proxy.Serve(ln)
}

func serveStats(counters map[string]*counter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		type userStats struct {
			BytesReceived int64 `json:"bytesReceived"`
			BytesSent     int64 `json:"bytesSent"`
		}
		result := make(map[string]userStats, len(counters))
		for userID, c := range counters {
			result[userID] = userStats{
				BytesReceived: c.received.Load(),
				BytesSent:     c.sent.Load(),
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

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer cancel()

	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		srv := &http.Server{Addr: "0.0.0.0:" + statsPort, Handler: serveStats(counters)}
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
