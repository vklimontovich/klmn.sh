# Plan 1: Stabilize the Current Enter-to-NL Relay

## Summary

Keep the existing topology unchanged:

- clients connect to `enter.greatinet.org` over WireGuard
- `enter` relays TCP and wrapped-UDP traffic to `nl.greatinet.org`
- `nl` remains the public exit over the existing K8s Xray/REALITY service

The goal of this plan is stability and correctness, not new protocol capability. It is meant to remove drift, routing mistakes, and self-interference so the current setup behaves predictably under restart and normal load.

## Why This Plan Exists

The current path already works well enough for ordinary browsing, SSH, and many UDP-light apps, but live inspection showed three concrete stability problems:

- WireGuard boot config and runtime sync are inconsistent.
- The relay routing layer is not cleanly idempotent.
- `enter` sometimes tries to TPROXY traffic that should never go back into its own proxy path.

Those issues matter because they directly affect:

- SSH and coding sessions
- browser traffic over TCP
- long-lived connections
- DNS consistency through the relay path
- operator confidence during restart, rollout, and incident debugging

This plan does not target QUIC or HTTP/3 support. It is the cleanup pass that makes the current architecture dependable before any protocol expansion work.

## Implementation Changes

- Normalize WireGuard config handling in `infra/ansible/tasks/wireguard.yaml`.
  - Keep `/etc/wireguard/wg0.conf` as a full `wg-quick` file with `Address` and `MTU`.
  - Generate a separate stripped file for `wg syncconf`.
  - Change `/usr/local/bin/wg-sync` to sync from the stripped file only, without rewriting the canonical boot config.
  - Why: prevents `wg-quick` restarts from reintroducing default MTU behavior and makes boot-time state and runtime state come from one clear source of truth.

- Make policy routing explicitly idempotent in `infra/ansible/tasks/xray-client.yaml`.
  - Replace `ip rule add ... || true` with logic that ensures exactly one rule exists for `fwmark 1 lookup 100`.
  - Use a fixed priority for that rule so teardown and inspection are deterministic.
  - Make stop logic remove the exact rule that start logic adds.
  - Why: duplicate rules are a symptom of restart drift and make routing behavior harder to reason about.

- Add explicit TPROXY bypasses before proxy capture in `infra/ansible/tasks/xray-client.yaml`.
  - Bypass `{{ wg_subnet }}` so traffic within the WireGuard address space never re-enters Xray.
  - Resolve and bypass the current `enter_exit_host` IPv4 address so traffic to `nl.greatinet.org` itself is not transparently recaptured.
  - Keep the RU destination bypass ahead of the generic TPROXY rules.
  - Why: prevents proxy self-interference and directly targets the observed `loopback connection detected` errors.

- Clarify the transport model in the relay config comments in `infra/ansible/tasks/xray-client.yaml`.
  - Document that the current `vless-udp` path is UDP payload forwarding over a TCP-based REALITY transport.
  - Document that this is acceptable for baseline connectivity, but not for native QUIC support.
  - Why: avoids future operator confusion and prevents incorrect assumptions during debugging.

- Fix stale operational documentation in `infra/k8s/030-xray/README.md`.
  - Correct node labeling from `node-role=xray` to `node-role=vpn-node`.
  - Correct rollout instructions to match the actual DaemonSet-based deployment rather than a Deployment.
  - State clearly that Xray is scheduled onto every `vpn-node`, with per-node REALITY `dest` values coming from `xray-node-dests`.
  - Why: the server side is currently easy to misunderstand, and accurate docs reduce operator mistakes.

- Make K8s Xray observability safer in `infra/k8s/030-xray/values.yaml.gotmpl`.
  - Remove the always-on `tcpdump` sidecar or gate it behind an explicit debug toggle.
  - Leave the main Xray DaemonSet and hostPort model unchanged.
  - Why: always-on packet capture is unnecessary for baseline service stability and adds noise and overhead.

## Acceptance Criteria

- Restarting `wg-quick@wg0` on `enter` leaves `wg0` at MTU `1350` without requiring manual repair.
- `ip rule show` on `enter` contains exactly one `fwmark 0x1 lookup 100` rule.
- `journalctl -u xray-client` on `enter` shows no new `loopback connection detected` messages during a fresh client test run.
- TPROXY rules still capture intended user traffic from `wg0`, but no longer recapture traffic to the relay subnet or the exit host itself.
- A reconnect burst from a real client app, such as restarting Telegram while WireGuard stays up, completes without chat-loading failure and without any fresh proxied destinations inside the relay subnet or the exit host IP.
- Existing user-facing behavior for normal TCP traffic, STUN reachability, and long-lived sessions is unchanged or slightly improved.
- K8s docs correctly describe how Xray is actually deployed to `vpn-node` nodes.

## Test Plan

- On `enter.greatinet.org`, restart `wg-quick@wg0`, `wg-tproxy`, and `xray-client`.
- Verify `ip -details link show wg0` shows `mtu 1350`.
- Verify `ip rule show` has one policy rule for `fwmark 1`.
- Verify `iptables -t mangle -S PREROUTING` shows bypass rules before generic TPROXY rules.
- Verify `journalctl -u xray-client` contains no fresh loopback errors.
- Reproduce a real client reconnect burst, such as restarting Telegram while WireGuard stays connected, and confirm chats load while `journalctl -u xray-client` shows no proxied destinations inside the relay subnet or the exit host IP during that window.
- Re-run the existing client test script and confirm there is no regression in TCP churn, connection storm, DNS latency, and long-lived session tests.
- Expect QUIC to remain unsupported in this plan.

## Assumptions

- `nl.greatinet.org` remains the exit host.
- QUIC and HTTP/3 support are out of scope for this plan.
- Preserving the NL egress IP is more important than introducing a direct-UDP shortcut in this phase.
- The old Docker-based Xray path in Ansible is not the active server path for this relay and should not drive this stability work.
