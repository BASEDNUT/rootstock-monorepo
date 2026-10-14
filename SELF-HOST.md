# SELF-HOST.md — Run and serve Rootstock from your own keys

Rootstock ships as a static export. No DNS host, no backend required. Any
agent or human can clone this repo, build the artifact, and serve it — with
their own wallet keys and their own RPC endpoints. Nothing in the pipeline
calls home or requires our credentials.

## 1. Clone and build

Follow [INIT.md](./INIT.md) for full setup. Short path:

```bash
git clone https://github.com/BASEDNUT/rootstock-monorepo.git
cd rootstock-monorepo
pnpm install
```

## 2. Use your own keys

```bash
cp apps/frontend-v3/.env.template apps/frontend-v3/.env.local
```

- `NEXT_PUBLIC_WALLET_CONNECT_ID` — **get your own id** at
  <https://appsig.dev>. Never ship our id; each host should use its own.
- Wallet RPCs: the app uses public Base endpoints by default. For private
  RPCs, set your endpoint in the wallet connection when using the site;
  optional integration keys (`NEXT_PRIVATE_DRPC_KEY`, Tenderly, currency,
  screening) are all **optional** — unset keys fail closed, never block the
  static build.
- `.env.local` is gitignored — never commit it.

## 3. Build the static export

```bash
bash apps/frontend-v3/scripts/build-ipfs.sh
```

The script stashes dev-only surfaces (API routes, debug pages), runs the
export build, and restores everything after — safe to rerun. Artifact lands
in `out/`. Serve it locally to verify:

```bash
node apps/frontend-v3/scripts/serve-static.mjs   # http://localhost:8091
```

## 4. Pin to your own IPFS node

With [kubo](https://github.com/ipfs/kubo) installed (`ipfs --version`):

```bash
ipfs add -r -Q --pin --hidden out/   # prints the root CID
```

- `--hidden` keeps `.well-known/security.txt` in the artifact.
- The CID is content-addressed: the same `out/` byte-for-byte yields the same
  CID on any machine — verify your build matches ours.

## 5. Announce and verify

```bash
ipfs routing provide <CID>
curl -H 'Accept: application/x-ndjson' \
  https://delegated-ipfs.dev/routing/v1/providers/<CID>
```

Expect `HTTP 200` with an `Addrs` array containing your node's addresses.
No `Addrs` → not announced yet; retry `routing provide`.

## 6. URL forms for your CID

- CIDv1 base32 required for subdomain gateways: `ipfs cid format -b base32 <CID>`
- Browser-native gateway: `https://<cid-base32>.ipfs.inbrowser.link/`
- Server-side gateways: `https://<cid-base32>.ipfs.dweb.link/` or any
  `https://<gateway>/ipfs/<CID>/` path form
- Local: `http://127.0.0.1:8080/ipfs/<CID>/` (your own node)

### Serving others: what your node needs

For visitors to fetch your CID from browsers directly, your node should
announce browser-reachable transports:

- **Secure WebSocket (`/tls/ws`)** — works in every modern browser; enable
  AutoTLS (`p2p-forge`) or expose a domain with TLS
- **WebTransport (`/quic-v1/webtransport`)** — Chrome/Edge/Firefox/Safari;
  needs a public UDP port reachable from the internet
- Plain `/tcp` and relay-only `/quic-v1` are **not** browser-dialable —
  visitors then depend on HTTP fallback gateways only

Also keep `Swarm.AddrFilters` empty if you are behind NAT/provider networks
(private-range filters silently drop legitimate inbound peers).

## 7. What to expect when interacting with the app

- Connect any EVM wallet; Base mainnet (8453) is the live chain, Base Sepolia
  (84532) is available in dev mode
- Swap, create pool, LBP, mint token, wrap token — all flows are on-chain;
  your node/keys execute everything, the site is stateless static files
- Contract addresses and byte-exact provenance: [deployments/PROVENANCE.md](./deployments/PROVENANCE.md)

## 8. Update cycle

New build → new CID → new URL. Old CIDs keep resolving forever (content
addressing). If you want a stable name, publish an IPNS record or DNSLink to
your latest CID — the app itself needs no configuration for that.
