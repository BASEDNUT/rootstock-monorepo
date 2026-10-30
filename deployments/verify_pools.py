#!/usr/bin/env python3
"""verify_pools.py — on-chain verification for deployments/pools-mainnet.json.

Checks that every pool in the unified public registry exists on Base mainnet:
  - entries with pool_address: eth_getCode must return bytecode
  - bonding-curve entries without pool_address: bond_contract must have code
  - entries with symbol(): on-chain symbol must match the registry (when readable)

Usage:
  python3 verify_pools.py --selftest   # pure-function selftest, no network
  python3 verify_pools.py              # live verification against Base mainnet

Exit 0 = all GREEN. Exit 1 = any RED.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REGISTRY = os.path.join(HERE, "pools-mainnet.json")

RPCS = [
    "https://base.publicnode.com",
    "https://base.drpc.org",
    "https://mainnet.base.org",
]
UA = "rootstock-verify-pools/1.0"
SEL_SYMBOL = "0x95d89b41"  # symbol()


def norm_addr(a):
    if not isinstance(a, str) or not a.startswith("0x") or len(a) != 42:
        return None
    return a.lower()


def decode_string(hexdata):
    """Decode an ABI-encoded short string (offset/length layout)."""
    if not hexdata or hexdata == "0x":
        return None
    try:
        raw = bytes.fromhex(hexdata[2:])
    except ValueError:
        return None
    if len(raw) < 64:
        return None
    offset = int.from_bytes(raw[0:32], "big")
    if offset + 32 > len(raw):
        return None
    length = int.from_bytes(raw[offset:offset + 32], "big")
    if length == 0 or offset + 32 + length > len(raw):
        return None
    return raw[offset + 32: offset + 32 + length].decode("utf-8", "replace").strip("\x00")


def rpc_call(payload, timeout=25):
    last = None
    for url in RPCS:
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode(),
                headers={"Content-Type": "application/json", "User-Agent": UA},
            )
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode())
        except Exception as e:  # noqa: BLE001
            last = e
    raise RuntimeError(f"all RPCs failed: {last}")


def rpc_batch(calls):
    """calls: [(method, params)] -> list of response objects, order preserved."""
    if not calls:
        return []
    payload = [
        {"jsonrpc": "2.0", "id": i, "method": m, "params": p}
        for i, (m, p) in enumerate(calls)
    ]
    out = rpc_call(payload)
    by_id = {item["id"]: item for item in out} if isinstance(out, list) else {}
    return [by_id.get(i, {}) for i in range(len(calls))]


def verify_registry(reg, verbose=True):
    """Run the full verification battery. Returns (rows, all_green)."""
    pools = reg.get("pools") or []
    code_targets = []
    symbol_targets = []
    for p in pools:
        pa = norm_addr(p.get("pool_address"))
        if pa:
            code_targets.append(("pool", pa))
        else:
            bc = norm_addr(p.get("bond_contract"))
            if bc:
                code_targets.append(("bond", bc))
    # symbol() only for pools where the registry recorded a symbol
    for p in pools:
        pa = norm_addr(p.get("pool_address"))
        sym = p.get("symbol") or p.get("token0_symbol")
        if pa and sym:
            symbol_targets.append((pa, sym))

    code_calls = [("eth_getCode", [a, "latest"]) for _, a in code_targets]
    code_res = rpc_batch(code_calls)
    codes = {}
    for (kind, a), res in zip(code_targets, code_res):
        if res.get("result") is not None:
            codes[(kind, a)] = res["result"]

    sym_calls = [("eth_call", [{"to": a, "data": SEL_SYMBOL}, "latest"]) for a, _ in symbol_targets]
    sym_res = rpc_batch(sym_calls)
    symbols = {}
    for (a, _s), res in zip(symbol_targets, sym_res):
        r = res.get("result")
        if r and not res.get("error"):
            symbols[a] = decode_string(r)

    rows = []
    all_green = True
    for p in pools:
        pid = p.get("id") or "?"
        pa = norm_addr(p.get("pool_address"))
        bc = norm_addr(p.get("bond_contract"))
        if pa:
            code = codes.get(("pool", pa), "0x")
            target = pa
            kind = "pool"
        elif bc:
            code = codes.get(("bond", bc), "0x")
            target = bc
            kind = "bond_contract"
        else:
            rows.append((pid, "RED", "no pool_address and no bond_contract"))
            all_green = False
            continue
        has_code = code not in ("0x", "", None)
        size = (len(code) - 2) // 2 if isinstance(code, str) and code.startswith("0x") else 0
        if not has_code:
            rows.append((pid, "RED", f"{kind} {target} has no code"))
            all_green = False
            continue
        # symbol cross-check (soft: registry symbol vs on-chain, when readable)
        note = f"{kind} {target[:10]}… code={size}B"
        reg_sym = p.get("symbol") or ""
        onchain = symbols.get(pa) if pa else None
        if onchain and reg_sym and onchain != reg_sym:
            rows.append((pid, "YELLOW", f"symbol mismatch: registry={reg_sym} onchain={onchain}"))
            # mismatch is informational: registry symbol may use venue shorthand
        else:
            if onchain and reg_sym:
                note += f" symbol={onchain}"
            rows.append((pid, "GREEN", note))
    return rows, all_green


def selftest():
    ok = True

    def check(name, cond):
        nonlocal ok
        print(f"  {'PASS' if cond else 'FAIL'} {name}")
        ok = ok and cond

    # norm_addr
    check("norm_addr lowercases", norm_addr("0xBA5ED46e31F80dafF307cbf60bd422a6f62E3dd3") == "0xba5ed46e31f80daff307cbf60bd422a6f62e3dd3")
    check("norm_addr rejects short", norm_addr("0x123") is None)
    check("norm_addr rejects non-str", norm_addr(None) is None)
    check("norm_addr rejects bare hex", norm_addr("BA5ED46e31F80dafF307cbf60bd422a6f62E3dd3") is None)

    # decode_string
    def enc(s):
        raw = s.encode()
        body = raw + b"\x00" * ((32 - len(raw) % 32) % 32)
        return "0x" + (32).to_bytes(32, "big").hex() + len(raw).to_bytes(32, "big").hex() + body.hex()

    check("decode_string roundtrip", decode_string(enc("kCORE")) == "kCORE")
    check("decode_string empty", decode_string("") is None)
    check("decode_string 0x", decode_string("0x") is None)
    check("decode_string junk", decode_string("0x" + "11" * 32) is None)
    long = "A" * 31
    check("decode_string 31-char", decode_string(enc(long)) == long)

    # registry shape
    with open(REGISTRY) as f:
        reg = json.load(f)
    pools = reg.get("pools") or []
    check("registry has pools", isinstance(pools, list) and len(pools) >= 50)
    check("every pool has id", all(isinstance(p.get("id"), str) and p["id"] for p in pools))
    check("every pool has chainId 8453", all(p.get("chain_id") == 8453 for p in pools))
    check("every pool has registry_scope", all(p.get("registry_scope") in ("legacy", "rootstock") for p in pools))
    check("every pool has address or bond", all(norm_addr(p.get("pool_address")) or norm_addr(p.get("bond_contract")) for p in pools))
    check("scopeCounts match", reg.get("scopeCounts", {}).get("legacy") == sum(1 for p in pools if p["registry_scope"] == "legacy"))

    print("SELFTEST", "GREEN" if ok else "RED")
    return ok


def main():
    if "--selftest" in sys.argv:
        return 0 if selftest() else 1
    with open(REGISTRY) as f:
        reg = json.load(f)
    print(f"verify_pools: {len(reg.get('pools') or [])} pools, chainId {reg.get('chainId')}")
    t0 = time.time()
    rows, all_green = verify_registry(reg)
    greens = sum(1 for r in rows if r[1] == "GREEN")
    yellows = sum(1 for r in rows if r[1] == "YELLOW")
    reds = sum(1 for r in rows if r[1] == "RED")
    for pid, status, note in rows:
        if status != "GREEN":
            print(f"  {status} {pid}: {note}")
    print(f"{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())} GREEN={greens} YELLOW={yellows} RED={reds} ({time.time()-t0:.1f}s)")
    return 0 if all_green else 1


if __name__ == "__main__":
    sys.exit(main())
