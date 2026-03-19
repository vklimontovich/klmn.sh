package main

import (
	"bufio"
	"context"
	"fmt"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"strings"
	"sync"
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

// allowAll implements mtglib.IPBlocklist allowing every IP.
type allowAll struct{}

func (allowAll) Contains(net.IP) bool  { return true }
func (allowAll) Run(time.Duration)     {}
func (allowAll) Shutdown()             {}

type entry struct {
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
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			slog.Warn("skipping invalid line", "line", line)
			continue
		}
		entries = append(entries, entry{
			secret: strings.TrimSpace(parts[0]),
			port:   strings.TrimSpace(parts[1]),
		})
	}
	return entries, scanner.Err()
}

// randomSecret generates a random mtg v2 FakeTLS secret (ee-prefixed, google.com as host).
func randomSecret() mtglib.Secret {
	return mtglib.GenerateSecret("aihero.dev")
}

func startProxy(ctx context.Context, e entry, ntw mtglib.Network, arc mtglib.AntiReplayCache) error {
	secret, err := mtglib.ParseSecret(e.secret)
	if err != nil {
		return fmt.Errorf("parse secret: %w", err)
	}

	proxy, err := mtglib.NewProxy(mtglib.ProxyOpts{
		Secret:          secret,
		Network:         ntw,
		AntiReplayCache: arc,
		IPBlocklist:     ipblocklist.NewNoop(),
		IPAllowlist:     allowAll{},
		EventStream:     events.NewNoopStream(),
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

	slog.Info("proxy started", "port", e.port, "secret", e.secret)
	return proxy.Serve(ln)
}

func main() {
	entries, err := loadEntries()
	if err != nil {
		slog.Error("load config", "err", err)
		os.Exit(1)
	}

	if len(entries) == 0 {
		secret := randomSecret()
		slog.Info("no config — using random secret", "port", "8443", "secret", secret.String())
		entries = []entry{{secret: secret.String(), port: "8443"}}
	}

	ntw := networkv2.New(nil, "", 10*time.Second, 10*time.Second, time.Minute)
	arc := antireplay.NewStableBloomFilter(0, -1)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer cancel()

	var wg sync.WaitGroup
	for _, e := range entries {
		wg.Add(1)
		go func(e entry) {
			defer wg.Done()
			if err := startProxy(ctx, e, ntw, arc); err != nil && ctx.Err() == nil {
				slog.Error("proxy error", "port", e.port, "err", err)
			}
		}(e)
	}
	wg.Wait()
}
