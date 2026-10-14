#!/usr/bin/env python3
"""Immutable-slot verification — prove every embedded immutable matches the registry.

For every registry contract with known immutable slots (build-info
immutableReferences ranges, paired with the artifact's deployedBytecode),
fetch on-chain runtime bytecode (eth_getCode), extract each immutable's
embedded value, decode it, and compare against the registry's known
addresses (Vault, Authorizer, WETH, Permit2, routers, factories, ...).

Per-slot verdicts:
  MATCH:<RegistryContract>  — decoded value == that registry address
  UNLISTED_ADDRESS          — address-shaped value matching NO registry entry
                              (the mismatch class: a wire to something the
                              registry does not know — reported, never hidden)
  NOT_ADDRESS_VALUE         — numeric/non-address immutable (informational)

Per-contract statuses:
  VERIFIED    all address-shaped slots MATCH
  MISMATCH    at least one UNLISTED_ADDRESS
  NO_IMMUTABLES / NO_LOCAL_BUILDINFO / UPSTREAM_REUSE / CONFIG_ONLY / MISSING_ARTIFACT

Usage:
  verify_immutables.py --registry PATH --repo PATH --sol PATH [--rpc URL] [--out PATH]
  verify_immutables.py --selftest

RPC defaults by registry chainId: 8453 -> https://base.publicnode.com,
84532 -> https://sepolia.base.org. Read-only (eth_getCode only).
"""
import argparse
import json
import sys
import time
from pathlib import Path

import provenance_sweep as ps

RPC_BY_CHAIN = {8453: "https://base.publicnode.com", 84532: "https://sepolia.base.org"}
CONFIG_ONLY_ZERO = "0x" + "0" * 40
UPSTREAM_REUSE = {a.lower() for a in ps.UPSTREAM_REUSE}
PRIM_NAMES = {"TokenFactory", "WrapperFactory"}


def decode_immutable_slot(chain_bytes: bytes, start: int, length: int) -> dict:
    """Extract + classify one immutable slot from on-chain runtime bytecode.

    Classification (address-shaped values):
      - known system/predeploy addresses (registry + Permit2/WETH) are
        matched by the caller against the known map
      - a 160-bit region with 96 leading zero bits (top 12 bytes of the
        20-byte region all zero) is a NUMERIC constant, not an address —
        addresses like that are astronomically improbable (the canonical
        vanity predeploys are covered by the known map)
      - everything else address-shaped is reported as-is
    """
    if start < 0 or length <= 0 or start + length > len(chain_bytes):
        return {"verdict": "RANGE_ERROR", "raw": None}
    raw = chain_bytes[start : start + length]
    raw_hex = "0x" + raw.hex()
    if length == 32:
        if raw[:12] == bytes(12):
            region = raw[12:32]
            if region == bytes(20):
                return {"verdict": "ZERO_ADDRESS", "raw": raw_hex, "address": "0x" + "0" * 40}
            if region[:12] == bytes(12):
                return {"verdict": "NOT_ADDRESS_VALUE", "raw": raw_hex, "numeric": int.from_bytes(raw, "big")}
            if region[:11] == bytes(11):
                # large numeric (up to ~2^72): mock pool constructor args
                # (initial balances ~1e21) pack here with 11 leading zero bytes
                # in the 20-byte region — real addresses never look like this
                return {"verdict": "NOT_ADDRESS_VALUE", "raw": raw_hex, "numeric": int.from_bytes(raw, "big")}
            return {"verdict": "ADDRESS", "raw": raw_hex, "address": "0x" + region.hex()}
        return {"verdict": "NOT_ADDRESS_VALUE", "raw": raw_hex}
    if length == 20:
        if raw == bytes(20):
            return {"verdict": "ZERO_ADDRESS", "raw": raw_hex, "address": "0x" + "0" * 40}
        if raw[:12] == bytes(12):
            return {"verdict": "NOT_ADDRESS_VALUE", "raw": raw_hex, "numeric": int.from_bytes(raw, "big")}
        if raw[:11] == bytes(11):
            return {"verdict": "NOT_ADDRESS_VALUE", "raw": raw_hex, "numeric": int.from_bytes(raw, "big")}
        return {"verdict": "ADDRESS", "raw": raw_hex, "address": "0x" + raw.hex()}
    return {"verdict": "NOT_ADDRESS_VALUE", "raw": raw_hex}


def registry_address_map(reg: dict) -> dict:
    """lowercased address -> display name, from tasks + factory_derived."""
    m = {}
    for _task, contracts in reg["tasks"].items():
        for name, addr in contracts.items():
            if addr and addr.lower() != CONFIG_ONLY_ZERO:
                m.setdefault(addr.lower(), name)
    for entry in reg.get("factory_derived", []) or []:
        addr = entry[0]
        label = entry[2] if len(entry) > 2 else addr
        m.setdefault(addr.lower(), label)
    return m


def _split_ranges(evm_db: dict):
    """(immutable_ranges, link_ranges) from a build-info deployedBytecode evm db."""
    imm = []
    for _rid, spots in (evm_db.get("immutableReferences") or {}).items():
        for sp in spots:
            imm.append((int(sp["start"]), int(sp["length"])))
    link = []
    for _file, libs in (evm_db.get("linkReferences") or {}).items():
        for _lib, spots in libs.items():
            for sp in spots:
                link.append((int(sp["start"]), int(sp["length"])))
    return imm, link


def _ast_immutable_types(bi_path: str) -> dict:
    """Map AST-id -> (variable name, declared type) for immutables.

    solc's immutableReferences keys are the AST node IDs of the immutable
    VariableDeclaration nodes — the AST gives each slot its variable NAME
    and declared TYPE. A declared `address` is compared against the known
    map; any uint/int/other type is a value, never guessed as an address.
    """
    try:
        d = json.loads(Path(bi_path).read_text())
    except Exception:
        return {}
    out = {}
    sources = (d.get("output") or {}).get("sources") or {}

    def walk(node):
        if isinstance(node, dict):
            if (
                node.get("nodeType") == "VariableDeclaration"
                and node.get("mutability") == "immutable"
            ):
                type_str = node.get("typeDescriptions", {}).get("typeString", "")
                out[str(node.get("id"))] = (node.get("name", ""), type_str)
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    for _name, src in sources.items():
        walk(src.get("ast") or {})
    return out


def _immutable_ranges_with_types(evm_db: dict, bi_path: str):
    """(ranges, ast_types) — ranges carry the AST id so _slot_rows can type-check."""
    ast_types = _ast_immutable_types(bi_path) if bi_path else {}
    ranges = []
    for rid, spots in (evm_db.get("immutableReferences") or {}).items():
        for sp in spots:
            ranges.append({"ast_id": str(rid), "start": int(sp["start"]), "length": int(sp["length"])})
    return ranges, ast_types


def _pair_buildinfo(repo: Path, task_key: str, deployed_hex: str):
    """Find the same-compilation build-info for a task artifact.

    Returns (imm_ranges, link_ranges, ast_types, bi_path) or (None, None, None, None).
    imm ranges carry the solc AST id so slots resolve their declared type.
    """
    if not deployed_hex:
        return None, None, None, None
    for bi in sorted((repo / task_key / "build-info").glob("*.json")):
        try:
            d = json.loads(bi.read_text())
        except Exception:
            continue
        for _src, contracts in (d.get("output", {}).get("contracts", {}) or {}).items():
            for _cname, entry in (contracts or {}).items():
                evm_db = entry.get("evm", {}).get("deployedBytecode", {}) or {}
                obj = ps.normalize_code(evm_db.get("object") or "")
                if obj == deployed_hex:
                    imm, link = _split_ranges(evm_db)
                    ast_types = _ast_immutable_types(str(bi))
                    # re-key imm ranges with AST ids
                    typed = _typed_immutable_ranges(evm_db)
                    return typed, link, ast_types, str(bi)
    return None, None, None, None


def _typed_immutable_ranges(evm_db: dict):
    """immutableReferences as [{ast_id, start, length}] (AST-typed slots)."""
    out = []
    for rid, spots in (evm_db.get("immutableReferences") or {}).items():
        for sp in spots:
            out.append({"ast_id": str(rid), "start": int(sp["start"]), "length": int(sp["length"])})
    return out


def artifact_ranges(repo: Path, task_key: str, name: str):
    """(imm_typed, link, ast_types) for a task contract."""
    ap = repo / task_key / "artifact" / f"{name}.json"
    if not ap.exists():
        return None, None, None
    try:
        artifact = json.loads(ap.read_text())
    except Exception:
        return None, None, None
    deployed = ps.normalize_code(artifact.get("deployedBytecode", ""))
    imm, link, ast_types, _bi = _pair_buildinfo(repo, task_key, deployed)
    return imm, link, ast_types


def primitive_ranges(sol_out: Path, name: str):
    """(imm_typed, link, ast_types) for a forge primitive via its build-info."""
    cands = list(Path(sol_out).rglob(f"{name}.json"))
    if not cands:
        return None, None, None
    try:
        art = json.loads(cands[0].read_text())
    except Exception:
        return None, None, None
    local = ps.normalize_code(ps.extract_forge_deployed_bytecode(art))
    if not local:
        return None, None, None
    for bi in sorted((Path(sol_out) / "build-info").glob("*.json")):
        try:
            d = json.loads(bi.read_text())
        except Exception:
            continue
        for _src, contracts in (d.get("output", {}).get("contracts", {}) or {}).items():
            for cname, entry in (contracts or {}).items():
                evm_db = entry.get("evm", {}).get("deployedBytecode", {}) or {}
                obj = ps.normalize_code(evm_db.get("object") or "")
                if cname == name and obj == local:
                    return _typed_immutable_ranges(evm_db), _split_ranges(evm_db)[1], _ast_immutable_types(str(bi))
    return None, None, None


def run_chain(registry_path: Path, repo: Path, sol_out: Path, rpc_url: str, sleep_s=0.15):
    reg = json.loads(registry_path.read_text())
    chain_id = reg["chainId"]
    addr_map = registry_address_map(reg)
    # known system predeploys (legitimate wires) join the known-address map
    for pre_addr, label in ps.UPSTREAM_REUSE.items():
        addr_map.setdefault(pre_addr.lower(), label)
    rpc = ps.Rpc(rpc_url)
    rows = []

    # corpus fallback (used when a task artifact is missing on this mirror —
    # e.g. the vault quartet deploys under a different task dir upstream)
    corpus = ps.build_corpus(repo, str(sol_out))

    def _corpus_ranges(chain_hex):
        for e in corpus:
            if len(e["bytecode"]) == len(chain_hex):
                c = ps.compare(e["bytecode"], chain_hex, e["ranges"] or None)
                if c["match"]:
                    imm, link, ast_types = _split_ranges_for_entry(e)
                    return imm, link, ast_types, e["source"], e["contract"]
        return None, None, None, None, None

    for task_key, contracts in reg["tasks"].items():
        for name, addr in contracts.items():
            rec = {"chain_id": chain_id, "task": task_key, "contract": name, "address": addr}
            if name in PRIM_NAMES:
                rows.append(_primitive_row(rec, sol_out, rpc, addr_map, sleep_s))
                continue
            low = addr.lower()
            if low == CONFIG_ONLY_ZERO:
                rec["status"] = "CONFIG_ONLY"
                rows.append(rec)
                continue
            if low in UPSTREAM_REUSE:
                rec["status"] = "UPSTREAM_REUSE"
                rows.append(rec)
                continue
            imm, link, ast_types = artifact_ranges(repo, task_key, name)
            if imm is None and link is None and ast_types is None:
                # artifact or paired build-info missing — corpus fallback by
                # chain bytecode (finds the same compilation upstream)
                chain_hex = rpc.get_code(addr)
                imm, link, ast_types, source, cname = _corpus_ranges(chain_hex)
                if imm is None and link is None and ast_types is None:
                    if not chain_hex:
                        rec["status"] = "NO_CHAIN_CODE"
                    else:
                        rec["status"] = "NO_IMMUTABLES" if link is None and imm is None and _has_artifact(repo, task_key, name) else "MISSING_ARTIFACT"
                    rows.append(rec)
                    time.sleep(sleep_s)
                    continue
                rec["corpus_source"] = source
                rec["corpus_contract"] = cname
            rows.append(_slot_rows(rec, rpc, imm, link, ast_types, addr_map, sleep_s))

    # factory-derived instances (registry-driven)
    for entry in reg.get("factory_derived", []) or []:
        addr, impl_ref, label = entry[0], entry[1], entry[2]
        rec = {"chain_id": chain_id, "task": "(factory_derived)", "contract": label, "address": addr}
        imm, link, ast_types = None, None, None
        if impl_ref.startswith("TASK:"):
            task_dir, cname = impl_ref[5:].rsplit("/", 1)
            imm, link, ast_types = artifact_ranges(repo, task_dir, cname)
        elif impl_ref.startswith("SOL:"):
            imm, link, ast_types = primitive_ranges(sol_out, impl_ref[4:])
        if imm is None and link is None:
            chain_hex = rpc.get_code(addr)
            imm, link, ast_types, source, cname = _corpus_ranges(chain_hex)
            if imm is None and link is None and ast_types is None:
                rec["status"] = "NO_IMMUTABLES"
                rows.append(rec)
                time.sleep(sleep_s)
                continue
            rec["corpus_source"] = source
            rec["corpus_contract"] = cname
        rows.append(_slot_rows(rec, rpc, imm, link, ast_types, addr_map, sleep_s))

    return rows


def _split_ranges_for_entry(entry):
    """(imm_typed, link, ast_types) from a corpus entry's build-info.

    Corpus entries carry pre-merged ranges (ps._ranges_from_evm_db merges
    immutableReferences + linkReferences). Re-split from the build-info evm
    db stored on the entry's bi path — typed ranges + AST types so slots
    judge by declared type.
    """
    try:
        d = json.loads(Path(entry["bi"]).read_text())
    except Exception:
        return [], [], {}
    for _src, contracts in (d.get("output", {}).get("contracts", {}) or {}).items():
        for _cname, c_entry in (contracts or {}).items():
            evm_db = (c_entry.get("evm", {}).get("deployedBytecode", {}) or {})
            obj = ps.normalize_code(evm_db.get("object") or "")
            if obj == entry["bytecode"]:
                return (
                    _typed_immutable_ranges(evm_db),
                    _split_ranges(evm_db)[1],
                    _ast_immutable_types(entry["bi"]),
                )
    return [], [], {}


def _has_artifact(repo: Path, task_key: str, name: str) -> bool:
    return (repo / task_key / "artifact" / f"{name}.json").exists()


def _slot_rows(rec, rpc, imm_ranges, link_ranges, ast_types, addr_map, sleep_s):
    """Judge IMMUTABLE slots by DECLARED TYPE (build-info AST).

    - declared `address` type: compare the decoded value against the known
      map. MATCH (registry hit) / UNLISTED_LIVE (deployed code exists at
      that address - a registry gap, reported) / UNLISTED_DEAD (no code -
      a genuine mismatch, verdict RED).
    - any other declared type (uint/int/bool/string/bytes): informational
      VALUE slot (variable name + decoded value) - never guessed as an
      address.
    - no AST pairing: UNKNOWN, reported informationally.

    Library LINK slots (linkReferences) are recorded informationally -
    they are byte-proven by the provenance sweep's masked compare.
    """
    chain_hex = rpc.get_code(rec["address"])
    if not chain_hex:
        rec["status"] = "NO_CHAIN_CODE"
        return rec
    chain_bytes = bytes.fromhex(chain_hex)

    slots = []
    mismatch = False
    for i, spec in enumerate(imm_ranges or []):
        if isinstance(spec, dict):
            start = spec["start"]
            length = spec["length"]
            ast_id = str(spec.get("ast_id", ""))
        else:
            start, length = spec
            ast_id = ""
        entry = {"slot": i, "offset": start, "length": length, "kind": "immutable"}
        raw = chain_bytes[start : start + length]
        entry["raw"] = "0x" + raw.hex()
        var = (ast_types or {}).get(ast_id) if ast_id else None
        if var:
            var_name, type_str = var
            entry["name"] = var_name
            entry["type"] = type_str
            is_address_typed = (
                "address" in type_str.lower() or type_str.strip().startswith("contract ")
            )
            if is_address_typed:
                addr = ("0x" + raw[12:32].hex()) if len(raw) == 32 else ("0x" + raw.hex())
                entry["address"] = addr
                if addr == "0x" + "0" * 40:
                    # zero address = canonical 'not set' for optional wires
                    # (e.g. an unset migration router) — informational
                    entry["verdict"] = "ZERO"
                else:
                    hit = addr_map.get(addr.lower())
                    if hit:
                        entry["verdict"] = "MATCH:" + str(hit)
                    else:
                        try:
                            unlisted_code = rpc.get_code(addr)
                        except Exception:
                            unlisted_code = ""
                        if unlisted_code:
                            entry["verdict"] = "UNLISTED_LIVE"
                            entry["unlisted_code_len"] = len(unlisted_code) // 2
                        else:
                            entry["verdict"] = "UNLISTED_DEAD"
                            mismatch = True
            else:
                entry["verdict"] = "VALUE"
                if len(raw) == 32:
                    entry["value"] = int.from_bytes(raw, "big")
        else:
            # no AST pairing (rare: build-info unreadable) — informational
            entry["verdict"] = "UNKNOWN"
        slots.append(entry)

    links = []
    for j, (start, length) in enumerate(link_ranges or []):
        raw = chain_bytes[start : start + length]
        links.append(
            {
                "slot": j,
                "offset": start,
                "length": length,
                "kind": "library_link",
                "raw": "0x" + raw.hex(),
            }
        )

    rec["status"] = "MISMATCH" if mismatch else "VERIFIED"
    rec["immutable_slots"] = len(slots)
    rec["library_links"] = len(links)
    rec["slots"] = slots
    rec["link_slots"] = links
    time.sleep(sleep_s)
    return rec


def _primitive_row(rec, sol_out, rpc, addr_map, sleep_s):
    imm, link, ast_types = primitive_ranges(sol_out, rec["contract"])
    if imm is None and link is None and ast_types is None:
        rec["status"] = "NO_IMMUTABLES"
        return rec
    return _slot_rows(rec, rpc, imm, link, ast_types, addr_map, sleep_s)


def summarize(rows):
    statuses = {}
    mismatched = []
    verified_slots = 0
    unlisted = 0
    for r in rows:
        statuses[r["status"]] = statuses.get(r["status"], 0) + 1
        for s in r.get("slots", []) or []:
            if s["verdict"].startswith("MATCH:"):
                verified_slots += 1
            elif s["verdict"] == "UNLISTED_ADDRESS":
                unlisted += 1
        if r["status"] == "MISMATCH":
            mismatched.append(f"{r['contract']}@{r['address']}")
    unlisted_live = sum(
        1
        for r in rows
        for s in (r.get("slots") or [])
        if s.get("verdict") == "UNLISTED_LIVE"
    )
    zero_unwired = sum(
        1
        for r in rows
        for s in (r.get("slots") or [])
        if s.get("verdict") == "ZERO"
    )
    unlisted_dead = sum(
        1
        for r in rows
        for s in (r.get("slots") or [])
        if s.get("verdict") == "UNLISTED_DEAD"
    )
    return {
        "total_contracts": len(rows),
        "by_status": statuses,
        "slots_matched_registry": verified_slots,
        "slots_unlisted_live": unlisted_live,
        "slots_zero_unwired": zero_unwired,
        "slots_unlisted_dead": unlisted_dead,
        "mismatched_contracts": mismatched,
        "verdict": "GREEN" if unlisted_dead == 0 else "RED",
    }


def selftest():
    # decode rules — synthetic bytecode
    code = b"\x60" * 100
    addr = bytes.fromhex("".join("00" for _ in range(12)) + "ab" * 20)
    code = code[:40] + addr + code[72:]
    dec = decode_immutable_slot(code, 40, 32)
    assert dec["verdict"] == "ADDRESS" and dec["address"] == "0x" + "ab" * 20, dec
    # numeric 32-byte value (high bytes nonzero)
    num = bytes.fromhex("ff" * 32)
    code2 = b"\x00" * 40 + num
    dec2 = decode_immutable_slot(code2, 40, 32)
    assert dec2["verdict"] == "NOT_ADDRESS_VALUE", dec2
    # zero address
    dec3 = decode_immutable_slot(b"\x00" * 72, 40, 32)
    assert dec3["verdict"] == "ZERO_ADDRESS", dec3
    # range error
    assert decode_immutable_slot(code, 90, 32)["verdict"] == "RANGE_ERROR"
    # registry map
    reg = {
        "tasks": {
            "v3/tasks/20241204-v3-vault": {"Vault": "0xAb" * 10 + "01"},
            "v2/tasks/00000000-tokens": {"BAL": "0x" + "0" * 40, "WETH": "0x42" * 10},
        },
        "factory_derived": [["0x" + "cd" * 20, "SOL:Wrapper", "wrksRWT wrapper"]],
    }
    m = registry_address_map(reg)
    assert len(m) == 3 and "wrksRWT wrapper" in m.values() and "BAL" not in m.values()
    # AST typing from a synthetic standard-json build-info (output.sources)
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        bi = Path(td) / "bi.json"
        bi.write_text(json.dumps({
            "output": {
                "sources": {
                    "src/Foo.sol": {
                        "ast": {
                            "nodes": [
                                {"nodeType": "ContractDefinition", "nodes": [
                                    {"nodeType": "VariableDeclaration", "id": 7, "name": "vault", "mutability": "immutable", "typeDescriptions": {"typeString": "address"}},
                                    {"nodeType": "VariableDeclaration", "id": 8, "name": "pauseWindow", "mutability": "immutable", "typeDescriptions": {"typeString": "uint32"}},
                                    {"nodeType": "VariableDeclaration", "id": 9, "name": "regular", "mutability": "mutable", "typeDescriptions": {"typeString": "address"}},
                                ]}
                            ]
                        }
                    }
                }
            }
        }))
        types = _ast_immutable_types(str(bi))
        assert types == {"7": ("vault", "address"), "8": ("pauseWindow", "uint32")}, types
    print("SELFTEST OK")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--registry", default=None, help="REQUIRED: deployment registry JSON")
    ap.add_argument("--repo", default=None, help="REQUIRED: balancer-deployments mirror path")
    ap.add_argument("--sol", default=None, help="REQUIRED: local forge out/ path (primitives)")
    ap.add_argument("--rpc", default=None, help="RPC URL (default: by registry chainId)")
    ap.add_argument("--out", default=None, help="output JSON path")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()
    if args.selftest:
        return 0 if selftest() else 1
    missing = [n for n, v in (("--registry", args.registry), ("--repo", args.repo), ("--sol", args.sol)) if not v]
    if missing:
        ap.error("the following arguments are required: " + ", ".join(missing))

    reg = json.loads(Path(args.registry).read_text())
    rpc = args.rpc or RPC_BY_CHAIN.get(reg["chainId"])
    if not rpc:
        ap.error(f"no default RPC for chainId {reg['chainId']} — pass --rpc")

    rows = run_chain(Path(args.registry), Path(args.repo), Path(args.sol), rpc)
    summary = summarize(rows)
    out = {
        "generated": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "rpc": rpc,
        "registry": str(args.registry),
        "chain_id": reg["chainId"],
        "summary": summary,
        "results": rows,
    }
    if args.out:
        Path(args.out).write_text(json.dumps(out, indent=1) + "\n")
        print(f"written: {args.out}")
    print(json.dumps(summary, indent=1))
    return 0 if summary["verdict"] == "GREEN" else 2


if __name__ == "__main__":
    sys.exit(main())
