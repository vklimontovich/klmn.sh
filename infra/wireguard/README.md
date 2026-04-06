# WireGuard User Management — enter.greatinet.org

Entry server: `enter.greatinet.org:51820`
Server public key: `Ki4KkgvNJBFWhbUgSbq/+f86vS7z2xygshaxGmgnBCw=`

All client traffic is routed through a VLESS+Reality tunnel to the US exit server.
Clients only need to configure WireGuard — the relay is transparent.

---

## Generating a Keypair

Using OpenSSL (available everywhere):

```bash
# Private key
openssl genpkey -algorithm X25519 -outform DER 2>/dev/null | tail -c 32 | base64

# Public key (from the private key above — save it first, then derive)
openssl genpkey -algorithm X25519 -out private.pem
openssl pkey -in private.pem -outform DER 2>/dev/null | tail -c 32 | base64   # private
openssl pkey -in private.pem -pubout -outform DER 2>/dev/null | tail -c 32 | base64  # public
```

WireGuard uses X25519 (Curve25519) — OpenSSL handles the key clamping automatically.

---

## Adding a User

**1. Generate a keypair** (see above), note both private and public keys.

**2. Create a peer file on the server:**

```
/etc/wireguard/peers.d/<username>.conf
```

```ini
[Peer]
# <username>
PublicKey = <public-key>
AllowedIPs = 10.8.0.X/32
```

`AllowedIPs` is required — without it WireGuard drops all data from the peer.
Pick a unique `10.8.0.X` per user (admin=`.2`, next user=`.3`, etc.).
Set the same IP in the client config's `Address` field.

**3. Apply without downtime:**

```bash
/usr/local/bin/wg-sync
```

---

## Removing a User

```bash
rm /etc/wireguard/peers.d/<username>.conf
/usr/local/bin/wg-sync
```

---

## Client Config

```ini
[Interface]
PrivateKey = <private-key>
Address = 10.8.0.X/24
DNS = 8.8.8.8

[Peer]
PublicKey = Ki4KkgvNJBFWhbUgSbq/+f86vS7z2xygshaxGmgnBCw=
Endpoint = enter.greatinet.org:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
```

Pick any unused `10.8.0.X` address (start from `.2`). Import via:
- **macOS/iOS**: WireGuard app → import from file or QR code
- **Linux**: `wg-quick up <config>`
- **Router (OpenWRT/Mikrotik)**: WireGuard interface config
