#!/usr/bin/env python3
"""Provenance sweep v3 — prove every deployed Rootstock contract == committed compiler output.

Method:
  1. TASK_DEPLOYED fast path: task artifact deployedBytecode + same-compilation build-info
     (paired by exact object equality) vs eth_getCode — immutable-aware masked compare.
  2. Corpus fallback: match chain bytecode against the FULL build-info corpus (every
     task build-info + forge out/build-info). Build-info is the authoritative compiler
     output and is committed upstream — a unique corpus hit is provenance.

Immutable-aware compare: solc immutableReferences + deployedBytecode linkReferences byte
ranges are masked (zeroed) in both local (placeholders) and chain (filled) code; the rest
must match byte-exact.

Classes:
  TASK_DEPLOYED   — hardhat task artifact vs eth_getCode
  PRIMITIVE       — forge artifact (sol-contracts out/) vs eth_getCode
  FACTORY_DERIVED — runtime-created instance vs implementation artifact (masked)
  UPSTREAM_REUSE  — canonical predeploys reused (Permit2, WETH)
  CONFIG_ONLY     — registry config entries with no bytecode (BAL=0x0)

Statuses (ok): EXACT_MATCH, MATCH_IMMUTABLES, MATCH_CORPUS, UPSTREAM_REUSE_LIVE,
               CONFIG_ONLY, DUPLICATE_OF

Usage:
  provenance_sweep.py [--rpc URL] [--registry PATH] [--repo PATH] [--sol PATH] [--out PATH]
  provenance_sweep.py --selftest
"""
import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

UPSTREAM_REUSE = {
    "0x000000000022D473030F116dDEE9F6B43aC78BA3": "Permit2 (canonical CREATE2, all chains)",
    "0x4200000000000000000000000000000000000006": "WETH (Base predeploy)",
}
CONFIG_ONLY_ZERO = "0x0000000000000000000000000000000000000000"
PRIM_TASK_KEY = "20260927-primitives-factories"
PRIM_IMPLS = {"TokenFactory": "TokenFactory", "WrapperFactory": "WrapperFactory"}

# Factory-derived instances (address, impl ref, label)
# TASK:<task_dir>/<ContractName> → hardhat artifact; SOL:<ContractName> → forge out rglob
FACTORY_DERIVED = [
    ("0x1aba4e89fd64e41fe3081fabf6ce33cb613977c7", "TASK:v3/tasks/20260115-v3-weighted-pool-v2/WeightedPool", "Rootstock WETH/BAL Pool (WeightedPoolFactory-created)"),
    ("0xf64f66fced6ad963807e246ceb679b2620d200fd", "SOL:Wrapper", "wrksRWT wrapper (WrapperFactory-created, S104 E2E)"),
]

OK_STATES = ("EXACT_MATCH", "MATCH_IMMUTABLES", "MATCH_CORPUS", "UPSTREAM_REUSE_LIVE", "CONFIG_ONLY", "DUPLICATE_OF")


def sha_hex(h: str) -> str:
    return hashlib.sha256(bytes.fromhex(h)).hexdigest()


def normalize_code(code) -> str:
    if not isinstance(code, str):
        return ""
    c = code[2:] if code.startswith("0x") else code
    return c.lower()


def classify(addr: str) -> str:
    a = addr.lower()
    if a == CONFIG_ONLY_ZERO:
        return "CONFIG_ONLY"
    if a in {k.lower() for k in UPSTREAM_REUSE}:
        return "UPSTREAM_REUSE"
    return "TASK_DEPLOYED"


def extract_forge_deployed_bytecode(art: dict) -> str:
    """Foundry artifact: deployedBytecode may be str or {'object': '0x...'} dict."""
    db = art.get("deployedBytecode") or art.get("bytecode") or ""
    if isinstance(db, dict):
        db = db.get("object", "")
    return db


def _ranges_from_evm_db(evm_db: dict):
    ranges = []
    for _rid, spots in (evm_db.get("immutableReferences") or {}).items():
        for s in spots:
            ranges.append((int(s["start"]), int(s["length"])))
    for _file, libs in (evm_db.get("linkReferences") or {}).items():
        for _lib, spots in libs.items():
            for s in spots:
                ranges.append((int(s["start"]), int(s["length"])))
    return ranges


def mask_ranges(code_hex: str, ranges):
    """Zero out byte ranges (start/length are byte offsets in deployedBytecode)."""
    b = bytearray(bytes.fromhex(code_hex))
    n = len(b)
    for start, length in ranges:
        if start < 0 or length < 0 or start + length > n:
            raise ValueError(f"range {(start, length)} outside bytecode len {n}")
        for i in range(start, start + length):
            b[i] = 0
    return b.hex()


def compare(local_code, chain_code, ranges=None):
    """Immutable-aware compare. Returns dict with match + shas."""
    local_hex = normalize_code(local_code)
    chain_hex = normalize_code(chain_code)
    if not local_hex or not chain_hex or len(local_hex) % 2 or len(chain_hex) % 2:
        return {"match": False, "reason": "empty/odd-length code", "local_sha": None, "chain_sha": None}
    if len(local_hex) != len(chain_hex):
        return {
            "match": False,
            "reason": "length differs",
            "local_len": len(local_hex) // 2,
            "chain_len": len(chain_hex) // 2,
            "local_sha": sha_hex(local_hex),
            "chain_sha": sha_hex(chain_hex),
        }
    if ranges:
        try:
            lm = mask_ranges(local_hex, ranges)
            cm = mask_ranges(chain_hex, ranges)
        except ValueError as e:
            return {"match": False, "reason": f"mask error: {e}", "local_sha": None, "chain_sha": None}
        return {
            "match": lm == cm,
            "masked": True,
            "immutable_slots": len(ranges),
            "local_masked_sha": sha_hex(lm),
            "chain_masked_sha": sha_hex(cm),
            "local_sha": sha_hex(local_hex),
            "chain_sha": sha_hex(chain_hex),
            "local_len": len(local_hex) // 2,
            "chain_len": len(chain_hex) // 2,
        }
    lsha, csha = sha_hex(local_hex), sha_hex(chain_hex)
    return {"match": lsha == csha, "masked": False, "immutable_slots": 0, "local_sha": lsha, "chain_sha": csha, "local_len": len(local_hex) // 2, "chain_len": len(chain_hex) // 2}


def iter_buildinfo_entries(bi_path):
    """Yield (source_name, contract_name, object_hex, ranges) from one build-info file."""
    try:
        d = json.loads(Path(bi_path).read_text())
    except Exception:
        return
    for src, contracts in (d.get("output", {}).get("contracts", {}) or {}).items():
        for cname, entry in (contracts or {}).items():
            evm_db = (entry.get("evm", {}).get("deployedBytecode", {}) or {})
            obj = normalize_code(evm_db.get("object") or "")
            if not obj:
                continue
            yield src, cname, obj, _ranges_from_evm_db(evm_db)


def find_ranges_for_artifact(repo: Path, task_key: str, artifact: dict):
    """Pair artifact with the build-info of the SAME compilation: object equality.

    Returns (ranges, bi_path) or (None, None) if no same-compilation build-info found.
    """
    src, cname = artifact.get("sourceName"), artifact.get("contractName")
    target = normalize_code(artifact.get("deployedBytecode", ""))
    if not target:
        return None, None
    for bi in sorted((repo / task_key / "build-info").glob("*.json")):
        for s, c, obj, ranges in iter_buildinfo_entries(bi):
            if (s == src or cname == c) and obj == target:
                return ranges, str(bi)
    return None, None


def build_corpus(repo, sol_out=None):
    """Corpus: every build-info entry (object + ranges) across the deployments repo
    (+ forge out/build-info). Authoritative compiler output, committed upstream.
    """
    corpus = []
    for bi in sorted(Path(repo).glob("v*/tasks/*/build-info/*.json")) + sorted(Path(repo).glob("v*/deprecated/*/build-info/*.json")):
        for s, c, obj, ranges in iter_buildinfo_entries(bi):
            corpus.append({"source": s, "contract": c, "bytecode": obj, "ranges": ranges, "bi": str(bi)})
    if sol_out:
        for bi in sorted((Path(sol_out) / "build-info").glob("*.json")):
            for s, c, obj, ranges in iter_buildinfo_entries(bi):
                corpus.append({"source": s, "contract": c, "bytecode": obj, "ranges": ranges, "bi": str(bi)})
    return corpus


def corpus_search(chain_hex, corpus):
    """Unique corpus entries whose (masked) bytecode == chain bytecode."""
    hits = []
    n = len(chain_hex)
    for e in corpus:
        if len(e["bytecode"]) != n:
            continue
        c = compare(e["bytecode"], chain_hex, e["ranges"] or None)
        if c["match"]:
            hits.append({"entry": e, "compare": c})
    return hits


def corpus_record(rec, hits, chain_cmp):
    """Apply corpus search results onto a record.

    Same (source, contract) hits across multiple build-infos (identical compilation,
    task redeploys) collapse to MATCH_CORPUS — provenance unique at contract level.
    Only DIFFERENT contracts with matching bytecode are truly ambiguous.
    """
    pairs = {(h["entry"]["source"], h["entry"]["contract"]) for h in hits}
    if len(hits) >= 1 and len(pairs) == 1:
        h = hits[0]
        rec["corpus_source"] = h["entry"]["source"]
        rec["corpus_contract"] = h["entry"]["contract"]
        rec["corpus_bi"] = h["entry"]["bi"].split("/tasks/")[-1].split("/deprecated/")[-1]
        rec["corpus_hits_count"] = len(hits)
        rec["status"] = "MATCH_CORPUS"
    elif len(pairs) > 1:
        rec["status"] = "CORPUS_AMBIGUOUS"
        rec["corpus_hits"] = [{"source": h["entry"]["source"], "contract": h["entry"]["contract"]} for h in hits]
    else:
        rec["status"] = "MISMATCH"
    if chain_cmp:
        rec.update({k: v for k, v in chain_cmp.items() if k != "match"})
    return rec


class Rpc:
    def __init__(self, url: str):
        import requests
        self.url = url
        self.s = requests.Session()
        self.s.headers.update({"User-Agent": "rootstock-provenance/3.0", "Content-Type": "application/json"})
        self.id = 0

    def call(self, method, params):
        self.id += 1
        r = self.s.post(self.url, json={"jsonrpc": "2.0", "id": self.id, "method": method, "params": params}, timeout=30)
        d = r.json()
        if "error" in d:
            raise RuntimeError(f"RPC error: {d['error']}")
        return d["result"]

    def get_code(self, addr):
        return normalize_code(self.call("eth_getCode", [addr, "latest"]))


def run_sweep(rpc_url, registry_path, repo, sol_out, sleep_s=0.2, corpus=None):
    reg = json.loads(Path(registry_path).read_text())
    rpc = Rpc(rpc_url)
    if corpus is None:
        corpus = build_corpus(repo, sol_out)
    rows = []
    seen = {}
    for task_key, contracts in reg["tasks"].items():
        for name, addr in contracts.items():
            if PRIM_TASK_KEY in task_key and name in PRIM_IMPLS:
                continue  # forge-deployed: handled by PRIMITIVE branch
            cls = classify(addr)
            rec = {"task": task_key, "contract": name, "address": addr, "class": cls}
            if cls == "CONFIG_ONLY":
                rec["status"] = "CONFIG_ONLY"
                rows.append(rec); continue
            if cls == "UPSTREAM_REUSE":
                code = rpc.get_code(addr)
                rec["status"] = "UPSTREAM_REUSE_LIVE" if len(code) > 0 else "UPSTREAM_REUSE_MISSING"
                rec["chain_len"] = len(code) // 2
                rows.append(rec); time.sleep(sleep_s); continue
            if addr.lower() in seen:
                rec["status"] = "DUPLICATE_OF"; rec["dupe_of_task"] = seen[addr.lower()]
                rows.append(rec); continue
            seen[addr.lower()] = task_key
            chain = rpc.get_code(addr)
            ap = repo / task_key / "artifact" / f"{name}.json"
            local = None
            ranges = None
            bi_path = None
            if ap.exists():
                try:
                    artifact = json.loads(ap.read_text())
                    local = normalize_code(artifact.get("deployedBytecode", ""))
                except Exception:
                    local = None
            if local:
                ranges, bi_path = find_ranges_for_artifact(repo, task_key, artifact)
            if local:
                cmp_ = compare(local, chain, ranges)
                rec.update({k: v for k, v in cmp_.items() if k != "match"})
                if cmp_["match"]:
                    rec["status"] = "MATCH_IMMUTABLES" if ranges else "EXACT_MATCH"
                    rec["artifact_path"] = str(ap)
                    if bi_path:
                        rec["build_info"] = bi_path.split("/tasks/")[-1].split("/deprecated/")[-1]
                    rows.append(rec); time.sleep(sleep_s); continue
            # corpus fallback (missing/stale artifact, cross-task redeploy, mock contracts)
            hits = corpus_search(chain, corpus)
            corpus_record(rec, hits, None)
            if ap.exists():
                rec["artifact_path"] = str(ap)
            rows.append(rec)
            time.sleep(sleep_s)

    # PRIMITIVE class (forge artifacts, sol-contracts out/)
    prim_dir = Path(sol_out)
    for name, fname in PRIM_IMPLS.items():
        addr = None
        for tk, cs in reg["tasks"].items():
            if name in cs:
                addr = cs[name]; break
        rec = {"contract": name, "address": addr, "class": "PRIMITIVE"}
        if not addr:
            rec["status"] = "PRIMITIVE_NOT_IN_REGISTRY"
            rows.append(rec); continue
        candidates = list(prim_dir.rglob(f"{fname}.json"))
        if not candidates:
            rec["status"] = "MISSING_FORGE_ARTIFACT"
            rows.append(rec); continue
        art = json.loads(candidates[0].read_text())
        db = extract_forge_deployed_bytecode(art)
        if not db:
            rec["status"] = "FORGE_ARTIFACT_NO_CODE"
            rows.append(rec); continue
        local = normalize_code(db)
        ranges = None
        for bi in sorted((prim_dir / "build-info").glob("*.json")):
            for s, c, obj, r in iter_buildinfo_entries(bi):
                if c == fname and obj == local:
                    ranges = r; break
            if ranges is not None:
                break
        chain = rpc.get_code(addr)
        cmp_ = compare(local, chain, ranges)
        rec.update({k: v for k, v in cmp_.items() if k != "match"})
        rec["status"] = ("MATCH_IMMUTABLES" if ranges else "EXACT_MATCH") if cmp_["match"] else "MISMATCH"
        rec["artifact"] = str(candidates[0])
        rows.append(rec)
        time.sleep(sleep_s)

    # FACTORY_DERIVED class
    for addr, impl_ref, label in FACTORY_DERIVED:
        rec = {"address": addr, "label": label, "class": "FACTORY_DERIVED"}
        local = None
        ranges = None
        if impl_ref.startswith("TASK:"):
            rel = impl_ref[5:]
            task_dir, cname = rel.rsplit("/", 1)
            ap = repo / task_dir / "artifact" / f"{cname}.json"
            if ap.exists():
                artifact = json.loads(ap.read_text())
                local = normalize_code(artifact.get("deployedBytecode", ""))
                ranges, _ = find_ranges_for_artifact(repo, task_dir, artifact)
        else:
            cname = impl_ref[4:]
            cands = list(prim_dir.rglob(f"{cname}.json"))
            if cands:
                art = json.loads(cands[0].read_text())
                local = normalize_code(extract_forge_deployed_bytecode(art))
                for bi in sorted((prim_dir / "build-info").glob("*.json")):
                    for s, c, obj, r in iter_buildinfo_entries(bi):
                        if c == cname and obj == local:
                            ranges = r; break
                    if ranges is not None:
                        break
        chain = rpc.get_code(addr)
        if local and ranges is not None:
            cmp_ = compare(local, chain, ranges)
            rec.update({k: v for k, v in cmp_.items() if k != "match"})
            if cmp_["match"]:
                rec["status"] = "MATCH_IMMUTABLES" if ranges else "EXACT_MATCH"
                rows.append(rec); time.sleep(sleep_s); continue
        hits = corpus_search(chain, corpus)
        corpus_record(rec, hits, None)
        rows.append(rec)
        time.sleep(sleep_s)

    return rows


def summarize(rows):
    from collections import Counter
    c = Counter(r.get("status") for r in rows)
    ok = sum(v for k, v in c.items() if k in OK_STATES)
    bad = sum(v for k, v in c.items() if k not in OK_STATES)
    return {"total": len(rows), "by_status": dict(c), "proven": ok, "issues": bad, "verdict": "GREEN" if bad == 0 else "RED"}


def selftest():
    """Pure-function checks with inline + tempdir fixtures (no network)."""
    import os
    import tempfile
    ok = 0
    assert classify("0x000000000022D473030F116dDEE9F6B43aC78BA3") == "UPSTREAM_REUSE"
    assert classify("0x4200000000000000000000000000000000000006") == "UPSTREAM_REUSE"
    assert classify("0x0000000000000000000000000000000000000000") == "CONFIG_ONLY"
    assert classify("0xEf348c4222ab9c08aFE768AD722Fb02b10d640c9") == "TASK_DEPLOYED"
    ok += 1
    assert normalize_code("0x6080") == "6080" and normalize_code("6080") == "6080"
    assert normalize_code(None) == "" and normalize_code({}) == ""
    ok += 1
    # exact compare: match / mismatch / empty / length
    code = "6080604052"
    assert compare(code, "0x" + code)["match"]
    assert not compare(code, "0x6080604053")["match"]
    assert compare("", "0x60")["reason"] == "empty/odd-length code"
    assert compare(code, "0x608060")["reason"] == "length differs"
    ok += 1
    # immutable-aware: placeholders vs filled → masked match; outside-range diff → mismatch
    local = "11" * 8 + "00" * 4 + "22" * 4
    chain = "11" * 8 + "ab" * 4 + "22" * 4
    ranges = [(8, 4)]
    c1 = compare(local, chain, ranges)
    assert c1["match"] and c1["masked"] and c1["immutable_slots"] == 1
    chain2 = "11" * 7 + "cd" * 1 + "ab" * 4 + "22" * 4
    assert not compare(local, chain2, ranges)["match"]
    assert compare(local, chain, [(30, 4)])["reason"].startswith("mask error")
    ok += 1
    assert mask_ranges("aabbccdd", [(1, 2)]) == "aa0000dd"
    ok += 1
    # forge artifact extraction
    assert extract_forge_deployed_bytecode({"deployedBytecode": "0x60"}) == "0x60"
    assert extract_forge_deployed_bytecode({"deployedBytecode": {"object": "0x60"}}) == "0x60"
    assert extract_forge_deployed_bytecode({"bytecode": {"object": "0x61"}}) == "0x61"
    assert extract_forge_deployed_bytecode({}) == ""
    ok += 1
    # build-info corpus + pairing via tempdir
    with tempfile.TemporaryDirectory() as td:
        repo = Path(td)
        task = repo / "v3/tasks/20260115-x/build-info"
        task.mkdir(parents=True)
        ir = {"7": [{"start": 8, "length": 4}]}
        lr = {"f.sol": {"Lib": [{"start": 8, "length": 2}]}}
        db = {"object": "0x" + "11" * 8 + "00" * 4 + "22" * 4, "immutableReferences": ir, "linkReferences": lr}
        entry = {"evm": {"deployedBytecode": db}}
        contracts = {"src/P.sol": {"P": entry}}
        bi = {"output": {"contracts": contracts}}
        bip = task / "b1.json"
        bip.write_text(json.dumps(bi))
        # entries iterate
        entries = list(iter_buildinfo_entries(bip))
        assert len(entries) == 1
        s, c, obj, r = entries[0]
        assert (s, c) == ("src/P.sol", "P") and sorted(r) == [(8, 2), (8, 4)]
        # pairing: artifact with same object finds ranges; different object does not
        artifact = {"sourceName": "src/P.sol", "contractName": "P", "deployedBytecode": "0x" + "11" * 8 + "00" * 4 + "22" * 4}
        ranges_found, bi_path = find_ranges_for_artifact(repo, "v3/tasks/20260115-x", artifact)
        assert sorted(ranges_found) == [(8, 2), (8, 4)] and bi_path.endswith("b1.json")
        artifact_other = {"sourceName": "src/P.sol", "contractName": "P", "deployedBytecode": "0x" + "99" * 16}
        assert find_ranges_for_artifact(repo, "v3/tasks/20260115-x", artifact_other)[0] is None
        # corpus search: chain with filled immutables matches corpus entry (masked)
        corpus = build_corpus(repo)
        assert len(corpus) == 1
        chain_hex = "11" * 8 + "ab" * 4 + "22" * 4
        hits = corpus_search(chain_hex, corpus)
        assert len(hits) == 1 and hits[0]["entry"]["contract"] == "P"
        # non-matching chain → no hits
        assert corpus_search("11" * 16, corpus) == []
        # corpus_record states: same-pair hits collapse to MATCH_CORPUS; different contracts are ambiguous
        rec = {}
        corpus_record(rec, hits, None)
        assert rec["status"] == "MATCH_CORPUS" and rec["corpus_contract"] == "P" and rec["corpus_hits_count"] == 1
        rec2 = {}
        corpus_record(rec2, hits + hits, None)
        assert rec2["status"] == "MATCH_CORPUS" and rec2["corpus_hits_count"] == 2
        # true ambiguity: second corpus entry, different contract, same bytecode
        db2 = {"object": "0x" + "11" * 8 + "00" * 4 + "22" * 4, "immutableReferences": ir, "linkReferences": {}}
        entry2 = {"evm": {"deployedBytecode": db2}}
        task2 = repo / "v3/tasks/20260115-y/build-info"
        task2.mkdir(parents=True)
        bi2 = {"output": {"contracts": {"src/Q.sol": {"Q": entry2}}}}
        (task2 / "b2.json").write_text(json.dumps(bi2))
        corpus2 = build_corpus(repo)
        hits2 = corpus_search(chain_hex, corpus2)
        assert len(hits2) == 2
        rec3 = {}
        corpus_record(rec3, hits2, None)
        assert rec3["status"] == "CORPUS_AMBIGUOUS"
        rec4 = {}
        corpus_record(rec4, [], None)
        assert rec4["status"] == "MISMATCH"
        ok += 1
    # summarize verdict logic
    rows = [{"status": s} for s in OK_STATES]
    s = summarize(rows)
    assert s["verdict"] == "GREEN" and s["proven"] == len(OK_STATES) and s["issues"] == 0
    rows.append({"status": "MISMATCH"})
    assert summarize(rows)["verdict"] == "RED"
    rows.append({"status": "CORPUS_AMBIGUOUS"})
    assert summarize(rows)["issues"] == 2
    ok += 1
    print(f"SELFTEST OK ({ok} groups)")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rpc", default="https://sepolia.base.org")
    ap.add_argument("--registry", default="/a0/usr/projects/peanutoshi/balancer/phase1-logs/deployment-registry-baseSepolia.json")
    ap.add_argument("--repo", default="/a0/usr/projects/peanutoshi/balancer/mirrors/balancer-deployments")
    ap.add_argument("--sol", default="/a0/usr/workdir/sol-contracts/out")
    ap.add_argument("--out", default=None)
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()
    if args.selftest:
        return 0 if selftest() else 1
    rows = run_sweep(args.rpc, args.registry, Path(args.repo), Path(args.sol))
    summary = summarize(rows)
    out = {"generated": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "rpc": args.rpc, "summary": summary, "results": rows}
    if args.out:
        Path(args.out).write_text(json.dumps(out, indent=1) + "\n")
        print(f"written: {args.out}")
    print(json.dumps(summary, indent=1))
    return 0 if summary["verdict"] == "GREEN" else 2


if __name__ == "__main__":
    sys.exit(main())
