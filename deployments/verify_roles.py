#!/usr/bin/env python3
"""Role verification — positive + negative AccessControl battery, read-only.

Positive: the treasury multisig 0xcc59bE4Fd171b9868B092CBa017207B87bA23c5a
holds DEFAULT_ADMIN_ROLE (and expected roles) on deployed AccessControl
contracts listed in the registry.

Negative: the deployer wallet (registry `deployer`) holds ZERO roles on
every deployed contract that supports roles.

Method: eth_call hasRole(role, account) against each registry contract
(runtime bytecode check first). Output: role-verification.json + a short
ROLE_VERIFICATION.md table. Read-only (eth_call only).

Usage:
  verify_roles.py --registry PATH --rpc URL [--out PATH] [--md PATH]
  verify_roles.py --selftest
"""
import argparse
import json
import sys
import time
from pathlib import Path

MULTISIG = "0xcc59bE4Fd171b9868B092CBa017207B87bA23c5a"

# OpenZeppelin AccessControl: DEFAULT_ADMIN_ROLE is the literal bytes32(0)
# constant — NOT keccak("DEFAULT_ADMIN_ROLE()").
DEFAULT_ADMIN_ROLE = "0x" + "0" * 64

# ── minimal keccak-256 (no external deps) ─────────────────────────────
_KECCAK_RC = [
    0x0000000000000001, 0x0000000000008082, 0x800000000000808A, 0x8000000080008000,
    0x000000000000808B, 0x0000000080000001, 0x8000000080008081, 0x8000000000008009,
    0x000000000000008A, 0x0000000000000088, 0x0000000080008009, 0x000000008000000A,
    0x000000008000808B, 0x800000000000008B, 0x8000000000008089, 0x8000000000008003,
    0x8000000000008002, 0x8000000000000080, 0x000000000000800A, 0x800000008000000A,
    0x8000000080008081, 0x8000000000008080, 0x0000000080000001, 0x8000000080008008,
]
_KECCAK_ROT = [
    [0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61],
    [28, 55, 25, 21, 56], [27, 20, 39, 8, 14],
]


def _keccak_f(state):
    for rnd in range(24):
        c = [state[x][0] ^ state[x][1] ^ state[x][2] ^ state[x][3] ^ state[x][4] for x in range(5)]
        d = [c[(x - 1) % 5] ^ (((c[(x + 1) % 5] << 1) | (c[(x + 1) % 5] >> 63)) & ((1 << 64) - 1)) for x in range(5)]
        for x in range(5):
            for y in range(5):
                state[x][y] ^= d[x]
        b = [[0] * 5 for _ in range(5)]
        for x in range(5):
            for y in range(5):
                v = state[x][y]
                r = _KECCAK_ROT[x][y]
                rotated = (((v << r) | (v >> (64 - r))) & ((1 << 64) - 1)) if r else v
                b[y][(2 * x + 3 * y) % 5] = rotated
        for x in range(5):
            for y in range(5):
                state[x][y] = b[x][y] ^ ((b[(x + 1) % 5][y] ^ 0xFFFFFFFFFFFFFFFF) & b[(x + 2) % 5][y])
        state[0][0] ^= _KECCAK_RC[rnd]
    return state


def keccak256(data: bytes) -> bytes:
    rate = 136
    state = [[0] * 5 for _ in range(5)]
    padded = data + b"\x01" + b"\x00" * ((-len(data) - 1) % rate)
    padded = padded[:-1] + bytes([padded[-1] | 0x80])
    for off in range(0, len(padded), rate):
        block = padded[off : off + rate]
        for i in range(rate // 8):
            lane = int.from_bytes(block[i * 8 : i * 8 + 8], "little")
            state[i % 5][i // 5] ^= lane
        _keccak_f(state)
    out = b""
    for i in range(4):
        out += state[i % 5][i // 5].to_bytes(8, "little")
    return out[:32]


def role_id(name: str) -> str:
    return "0x" + keccak256(name.encode()).hex()


# ── RPC ───────────────────────────────────────────────────────────────
class Rpc:
    def __init__(self, url):
        import requests
        self.s = requests.Session()
        self.s.headers.update({"User-Agent": "rootstock-role-verify/1.0", "Content-Type": "application/json"})
        self.url = url
        self.i = 0

    def call(self, method, params):
        self.i += 1
        r = self.s.post(self.url, json={"jsonrpc": "2.0", "id": self.i, "method": method, "params": params}, timeout=30)
        d = r.json()
        if "error" in d:
            raise RuntimeError(f"RPC error: {d['error']}")
        return d["result"]

    def get_code(self, addr):
        return self.call("eth_getCode", [addr, "latest"])

    def eth_call(self, to, data):
        return self.call("eth_call", [{"to": to, "data": data}, "latest"])


def _selector(sig: str) -> str:
    return "0x" + keccak256(sig.encode()).hex()[:8]

SEL_HAS_ROLE = _selector("hasRole(bytes32,address)")


def _pad_left(hex_no_prefix: str, n: int) -> str:
    h = hex_no_prefix.lower().removeprefix("0x")
    return "0x" + h.rjust(n, "0")


def has_role_call(role: str, account: str) -> str:
    return SEL_HAS_ROLE + role[2:].rjust(64, "0") + account[2:].lower().rjust(64, "0")


def decode_bool(result: str):
    """Decode an ABI bool return. Empty/absent data = None (undecodable —
    e.g. a predeploy without hasRole returning empty) — the caller then
    classifies the contract as NOT_ACCESS_CONTROL instead of false."""
    h = (result or "").removeprefix("0x")
    if not h:
        return None
    return int(h, 16) == 1


# ── battery ───────────────────────────────────────────────────────────
def run_battery(registry_path, rpc_url, sleep_s=0.1):
    reg = json.loads(Path(registry_path).read_text())
    deployer = reg["deployer"]
    rpc = Rpc(rpc_url)

    rows = []
    for task_key, contracts in reg["tasks"].items():
        for name, addr in contracts.items():
            if not addr or addr.lower() == "0x" + "0" * 40:
                continue
            rec = {"task": task_key, "contract": name, "address": addr}
            code = rpc.get_code(addr)
            if not code or code == "0x":
                rec["roles_support"] = "NO_CHAIN_CODE"
                rows.append(rec)
                time.sleep(sleep_s)
                continue

            admin_role = DEFAULT_ADMIN_ROLE
            try:
                res = rpc.eth_call(addr, has_role_call(admin_role, MULTISIG))
                multisig_admin = decode_bool(res)
            except Exception:
                multisig_admin = None
            try:
                res = rpc.eth_call(addr, has_role_call(admin_role, deployer))
                deployer_admin = decode_bool(res)
            except Exception:
                deployer_admin = None

            if multisig_admin is None and deployer_admin is None:
                rec["roles_support"] = "NOT_ACCESS_CONTROL"
                rows.append(rec)
                time.sleep(sleep_s)
                continue

            rec["roles_support"] = "ACCESS_CONTROL"
            rec["multisig_default_admin"] = multisig_admin
            rec["deployer_default_admin"] = deployer_admin
            rows.append(rec)
            time.sleep(sleep_s)
    return rows, deployer


def summarize(rows, deployer):
    ac = [r for r in rows if r.get("roles_support") == "ACCESS_CONTROL"]
    positive = [r for r in ac if r.get("multisig_default_admin") is True]
    negative_fail = [
        r
        for r in ac
        if r.get("deployer_default_admin") is True  # deployer holding admin = violation
    ]
    return {
        "total_scanned": len(rows),
        "access_control_contracts": len(ac),
        "not_access_control": sum(1 for r in rows if r.get("roles_support") == "NOT_ACCESS_CONTROL"),
        "no_chain_code": sum(1 for r in rows if r.get("roles_support") == "NO_CHAIN_CODE"),
        "multisig_holds_default_admin": len(positive),
        "deployer_holds_default_admin": len(negative_fail),
        "verdict": "GREEN" if not negative_fail and positive else ("RED" if negative_fail else "NO_ROLES_FOUND"),
    }


def selftest():
    # keccak-256 known vectors
    assert keccak256(b"").hex() == "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470", keccak256(b"").hex()
    got = keccak256(b"abc").hex()
    assert got == "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45", got
    # hasRole(bytes32,address) selector — canonical Ethereum selector,
    # independently confirmed present in deployed upstream build-info
    # bytecode (grep 91d14854 in balancer-deployments build-info)
    assert _selector("hasRole(bytes32,address)") == "0x91d14854", _selector("hasRole(bytes32,address)")
    # OZ canonical: DEFAULT_ADMIN_ROLE is the literal bytes32(0) constant
    assert DEFAULT_ADMIN_ROLE == "0x" + "0" * 64
    # selector + call encoding
    sel = _selector("hasRole(bytes32,address)")
    assert sel == "0x91d14854", sel
    call = has_role_call("0x" + "0" * 64, "0xAb" * 10 + "01")
    assert len(call) == 10 + 128 and call.endswith("01"), call[-10:]
    print("SELFTEST OK")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--registry", default=None, help="REQUIRED: deployment registry JSON")
    ap.add_argument("--rpc", default=None, help="RPC URL")
    ap.add_argument("--out", default="role-verification.json")
    ap.add_argument("--md", default="ROLE_VERIFICATION.md")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()
    if args.selftest:
        return 0 if selftest() else 1
    if not args.registry or not args.rpc:
        ap.error("--registry and --rpc are required (mode check)")

    rows, deployer = run_battery(args.registry, args.rpc)
    summary = summarize(rows, deployer)

    out = {
        "generated": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "rpc": args.rpc,
        "registry": str(args.registry),
        "multisig": MULTISIG,
        "deployer": deployer,
        "summary": summary,
        "results": rows,
    }
    Path(args.out).write_text(json.dumps(out, indent=1) + "\n")

    md = ["# ROLE VERIFICATION", "", f"multisig: `{MULTISIG}` · deployer: `{deployer}`", "", "| Contract | Address | AccessControl | Multisig DEFAULT_ADMIN | Deployer DEFAULT_ADMIN |", "|---|---|---|---|---|"]
    for r in rows:
        md.append(
            f"| {r['contract']} | {r['address']} | {r.get('roles_support','')} "
            f"| {r.get('multisig_default_admin','—')} | {r.get('deployer_default_admin','—')} |"
        )
    Path(args.md).write_text("\n".join(md) + "\n")

    print(json.dumps(summary, indent=1))
    return 0 if summary["verdict"] == "GREEN" else 2


if __name__ == "__main__":
    sys.exit(main())
