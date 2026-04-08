# Plan 2: Add a QUIC-Capable Backhaul Between `enter` and `nl`

## Summary

Keep the current Russia-facing stealth leg for TCP traffic:

- client -> `enter.greatinet.org` over WireGuard
- `enter` -> `nl.greatinet.org` over VLESS + REALITY for TCP

Add a second backhaul only for QUIC traffic:

- on `enter`, match `UDP/443` from WireGuard clients before the generic Xray TPROXY rules
- send that traffic into a dedicated host-level tunnel, `wg-quic`
- carry `wg-quic` over a fake-TCP wrapper between `enter` and `nl`
- on `nl`, NAT and forward the `wg-quic` traffic to the public Internet

This keeps the censorship-sensitive Russia-facing leg stealthy while finally giving QUIC a real datagram path.

## Why This Plan Exists

The current relay can pass many kinds of UDP, but QUIC still fails because the current `vless-udp` outbound is carried over a TCP-based REALITY transport. That means:

- UDP is not preserved as native UDP end to end
- QUIC loses the transport properties it expects
- `aioquic` / HTTP/3 fails even though STUN and some other UDP checks succeed

At the same time, replacing `enter -> nl` with plain QUIC would weaken the Russia-facing hop. This plan avoids that by keeping the TCP/REALITY path for stealth and adding a second path only for the traffic class that genuinely needs datagram transport.

## Architecture

### 1. Add a dedicated host-level backhaul

Create a second point-to-point tunnel between `enter` and `nl`, for example:

- interface name: `wg-quic`
- purpose: carry only QUIC traffic that must preserve UDP semantics
- scope: host-level systemd-managed service, not Kubernetes

The outer wrapper for the Russia-facing hop should be a fake-TCP obfuscation layer:

- first choice: `Phantun`
- fallback: `udp2raw` in fake-TCP mode if `Phantun` proves too fragile on target ISPs

The inner tunnel remains WireGuard so routing, peer management, MTU tuning, and failure handling stay operationally simple.

### 2. Route only `UDP/443` into the new path

On `enter`:

- mark `-i wg0 -p udp --dport 443` before the existing Xray TPROXY rules
- route that marked traffic through `wg-quic`
- leave TCP on the existing `vless-tcp` outbound
- leave all non-QUIC UDP on the current path for the first iteration

This keeps the blast radius small. The first goal is to make HTTP/3 work without redesigning all UDP handling at once.

### 3. Egress from `nl`

On `nl`:

- allow forwarding for the `wg-quic` subnet
- MASQUERADE that subnet on the public interface
- return traffic back over `wg-quic` to `enter`

The public exit IP remains `nl.greatinet.org`.

### 4. Add health-based fallback

If the `wg-quic` path is down:

- remove the `UDP/443` bypass rule
- let that traffic fall back to the existing relay path

That fallback will not give working QUIC, but it preserves baseline connectivity and avoids total breakage.

## Implementation Changes

- Add a new Ansible task set for the `enter <-> nl` QUIC backhaul.
  - install and configure `wg-quic`
  - install and configure the selected fake-TCP wrapper
  - create matching systemd units on both hosts

- Extend `infra/ansible/tasks/xray-client.yaml`.
  - add explicit pre-TPROXY handling for `UDP/443`
  - mark and route `UDP/443` to `wg-quic`
  - keep existing TCP handling unchanged

- Add firewall and NAT rules on `nl`.
  - allow the fake-TCP wrapper port
  - allow forwarding for the `wg-quic` subnet
  - apply MASQUERADE for egress

- Add a documented routing table for QUIC traffic.
  - fixed table id
  - fixed rule priority
  - clean teardown logic

- Keep K8s Xray unchanged for this phase.
  - no change to `infra/k8s/030-xray`
  - no change to the public VLESS server path for TCP

## Acceptance Criteria

- `vpn_test.py` reports a passing HTTP/3 / QUIC probe.
- external IP for QUIC traffic is still `nl.greatinet.org`.
- normal TCP browsing and long-lived sessions remain on the current VLESS path and do not regress.
- if `wg-quic` is stopped, general connectivity still works and only QUIC-specific behavior regresses.
- routing on `enter` shows only `UDP/443` taking the `wg-quic` path.

## Test Plan

- Verify host-to-host backhaul health:
  - `enter` can exchange traffic with `nl` over `wg-quic`
  - MTU is tuned so large QUIC packets do not fragment unexpectedly

- Verify routing on `enter`:
  - `UDP/443` from `wg0` is marked and sent to `wg-quic`
  - TCP remains on the Xray path
  - non-QUIC UDP remains unchanged in the first rollout

- Re-run `vpn_test.py` and confirm:
  - HTTP/3 / QUIC succeeds
  - STUN still succeeds
  - egress IP remains the NL exit

- Exercise failure mode:
  - stop the `wg-quic` path
  - confirm ordinary browsing and TCP sessions still work
  - confirm QUIC regresses cleanly rather than causing broad outage

## What We Lose By Not Implementing This

Without this plan, the setup still works for a lot of normal use, but the following remain true:

- HTTP/3 stays broken through the relay
- browser traffic that prefers HTTP/3 falls back to TCP-based HTTP where fallback exists
- QUIC-native tools and protocols cannot work through this path
- any future architecture that expects native end-to-end QUIC on this relay keeps hitting the same transport mismatch

In practice, that means:

- ordinary web browsing is mostly fine, but loses HTTP/3 benefits
- some APIs and web sessions may have worse tail latency on lossy links
- any feature that explicitly depends on QUIC rather than generic UDP still fails

## QUIC Overview For Operators

QUIC is not just "UDP traffic". It is a full transport protocol built on top of UDP.

Operationally:

- IP is the network layer
- UDP is the outer packet format on the wire
- QUIC is a transport implemented inside UDP packets
- HTTP/3 is HTTP mapped onto QUIC

So QUIC occupies roughly the same role that TCP occupies for classic HTTPS, but it is deployed over UDP instead of as a new IP protocol number.

This also explains why "some UDP works" does not mean QUIC works:

- STUN can work
- WebRTC setup can work
- DNS can work
- WireGuard can work

while QUIC still fails, because QUIC is its own transport with its own handshake, packet sizing, loss recovery, and expectations.

## Apps And Traffic Classes Affected

### Usually just a speedup

- ordinary website browsing over HTTP/3
- many app backends that support HTTP/3 but also support HTTP/2 or HTTP/1.1
- large media sites and API endpoints that opportunistically use HTTP/3

These often still work today because they fall back to TCP-based HTTP.

### Hard requirement

- WebTransport over HTTP/3
- MASQUE / CONNECT-UDP style proxying over HTTP/3
- DNS-over-QUIC if a client or resolver is explicitly configured to use it
- any proxy or VPN protocol that is itself QUIC-native

Those workloads do not become healthy just because "some UDP" is available. They need a path where QUIC itself survives.

## Assumptions

- `enter.greatinet.org` stays in Russia.
- `nl.greatinet.org` stays the egress node outside Russia.
- The Russia-facing hop should remain stealth-oriented and should not be replaced with plain QUIC.
- First rollout should target `UDP/443` only, not all UDP.
