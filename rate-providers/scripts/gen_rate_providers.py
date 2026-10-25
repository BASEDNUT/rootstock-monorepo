#!/usr/bin/env python3
"""Generate RATE_PROVIDERS.md + RATE_PROVIDERS.json for ROOTSTOCK.

Source of truth, in order:
  1. balancer/code-review registry.json (pinned commit, recorded in output)
  2. Live Base RPC reads (symbol/decimals/getRate) at generation time
  3. Live ROOTSTOCK Vault getPoolTokenInfo for what our own pools use

Run: python scripts/gen_rate_providers.py  (see README for env vars)
"""
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from web3 import Web3

# Paths are environment-overridable so this runs anywhere, not just one machine.
HERE = Path(__file__).resolve().parent
OUT_DIR = Path(os.environ.get('RP_OUT_DIR', HERE.parent))
OUT_MD = OUT_DIR / 'RATE_PROVIDERS.md'
OUT_JSON = OUT_DIR / 'RATE_PROVIDERS.json'

# Local clone of https://github.com/balancer/code-review
MIRROR = Path(os.environ.get('RP_CODE_REVIEW_DIR', HERE / 'code-review'))
REGISTRY = MIRROR / 'rate-providers' / 'registry.json'

# Optional: baked pool registry from the app build. If absent, the pool section is skipped.
BAKED = Path(os.environ.get('RP_BAKED_REGISTRY', HERE / 'baked-pool-registry-base.json'))

RPC = os.environ.get('RP_RPC', 'https://base.publicnode.com')
ZERO = '0x0000000000000000000000000000000000000000'

TOKEN_TYPES = {0: 'STANDARD', 1: 'WITH_RATE', 2: 'WITHOUT_RATE'}

# ROOTSTOCK expansion roadmap, 2026-10-25. Lowercase symbols for matching.
# Alias map: base token -> registry asset symbols that are a WRAPPED/SAVINGS form of it.
# A provider on the wrapped form is NOT a provider on the base token; both facts are recorded.
WRAPPED_ALIASES = {
    'gho': ['wabasgho'],
    'usds': ['susds'],
    'usdc': ['wabasusdc', 'statabasusdc'],
    'usdbc': ['wabasusdbc'],
    'weth': ['wabasweth'],
    'eurc': ['wabaseurc'],
    'cbeth': ['wabascbeth'],
    'wsteth': ['wabaswsteth'],
    'ezeth': ['wabasezeth'],
}

WISHLIST = [
    'aero', 'gho', 'dai', 'usds', 'reth', 'weeth', 'morpho', 'well', 'aave',
    'susds', 'usd+', 'lbtc', 'syrupusdc', 'wrseth', 'degen', 'clanker', 'bnkr',
    'keycat', 'chad', 'doginme', 'miggles', 'ski', 'wabasusdc', 'wabasweth',
    'wabasgho', 'wabaseurc', 'mai', 'yfi', 'wsteth', 'usdt', 'usdc', 'jeur',
    'frxusd', 'superoethb', 'ovn', 'red', 'link', 'hunt', 'mint', 'wusdr',
    'usdbc', 'usdz', 'alusdb', 'aixbt',
]

POOL_ABI = json.loads('[{"inputs":[],"name":"getVault","outputs":[{"name":"","type":"address"}],"stateMutability":"view","type":"function"}]')
VAULT_ABI = json.loads('[{"inputs":[{"name":"pool","type":"address"}],"name":"getPoolTokenInfo","outputs":[{"name":"tokens","type":"address[]"},{"components":[{"name":"tokenType","type":"uint8"},{"name":"rateProvider","type":"address"},{"name":"paysYieldFees","type":"bool"}],"name":"tokenInfo","type":"tuple[]"},{"name":"balancesRaw","type":"uint256[]"},{"name":"lastBalancesLiveScaled18","type":"uint256[]"}],"stateMutability":"view","type":"function"}]')
ERC20_ABI = json.loads('[{"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"stateMutability":"view","type":"function"}]')
RP_ABI = json.loads('[{"inputs":[],"name":"getRate","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"}]')


def git_provenance():
    def run(args):
        try:
            return subprocess.run(args, cwd=str(MIRROR), capture_output=True, text=True, timeout=20).stdout.strip()
        except Exception:
            return ''
    return {
        'repo': 'https://github.com/balancer/code-review',
        'commit': run(['git', 'log', '-1', '--format=%H']),
        'commit_date': run(['git', 'log', '-1', '--format=%ci']),
        'commit_subject': run(['git', 'log', '-1', '--format=%s']),
        'review_docs': len(list((MIRROR / 'rate-providers').glob('*.md'))),
        'registry_mtime': datetime.fromtimestamp(REGISTRY.stat().st_mtime, timezone.utc).isoformat(),
    }


def main():
    w3 = Web3(Web3.HTTPProvider(RPC, request_kwargs={'timeout': 30, 'headers': {'User-Agent': 'rootstock/1.0'}}))
    if not w3.is_connected():
        sys.exit('RPC unavailable: ' + RPC)
    block = w3.eth.block_number

    reg = json.loads(REGISTRY.read_text())
    base_reg = reg.get('base', {})

    inventory = []
    for rp_addr, meta in base_reg.items():
        asset = meta.get('asset')
        row = {
            'rateProvider': rp_addr,
            'name': meta.get('name'),
            'asset': asset,
            'summary': meta.get('summary'),
            'review': meta.get('review'),
            'warnings': meta.get('warnings') or [],
            'upgradeable': bool(meta.get('upgradeableComponents')),
            'symbol': None,
            'decimals': None,
            'rate': None,
            'rateReadable': False,
        }
        if asset and Web3.is_address(asset):
            code = w3.eth.get_code(Web3.to_checksum_address(asset)).hex()
            if code not in ('0x', '0x0'):
                tok = w3.eth.contract(address=Web3.to_checksum_address(asset), abi=ERC20_ABI)
                try:
                    row['symbol'] = tok.functions.symbol().call()
                except Exception:
                    row['symbol'] = 'UNREADABLE'
                try:
                    row['decimals'] = tok.functions.decimals().call()
                except Exception:
                    row['decimals'] = None
        try:
            rate = w3.eth.contract(address=Web3.to_checksum_address(rp_addr), abi=RP_ABI).functions.getRate().call()
            row['rate'] = str(rate)
            row['rateReadable'] = True
        except Exception as e:
            row['rateError'] = str(e)[:120]
        inventory.append(row)

    inventory.sort(key=lambda r: ((r['symbol'] or 'zzz').lower(), r['name'] or ''))

    # what our own pools register
    pools = []
    if BAKED.exists():
        for p in json.loads(BAKED.read_text())['pools']:
            paddr = Web3.to_checksum_address(p['address'])
            try:
                vault_addr = w3.eth.contract(address=paddr, abi=POOL_ABI).functions.getVault().call()
                tokens, infos, _, _ = w3.eth.contract(address=vault_addr, abi=VAULT_ABI).functions.getPoolTokenInfo(paddr).call()
            except Exception as e:
                pools.append({'symbol': p.get('symbol'), 'address': p['address'], 'error': str(e)[:100]})
                continue
            entry = {
                'symbol': p.get('symbol'),
                'address': p['address'],
                'poolType': p.get('type'),
                'vault': vault_addr,
                'tokens': [],
            }
            for i, t in enumerate(tokens):
                ttype, rp, pays = infos[i]
                entry['tokens'].append({
                    'address': t,
                    'tokenType': TOKEN_TYPES.get(ttype, str(ttype)),
                    'rateProvider': None if rp == ZERO else rp,
                    'paysYieldFees': pays,
                })
            pools.append(entry)

    # which tokens are used WITH_RATE, per pool
    using = {}
    for p in pools:
        for t in p.get('tokens', []):
            rp = t.get('rateProvider')
            if rp:
                using.setdefault(rp, []).append({'pool': p['symbol'], 'poolAddress': p['address'], 'token': t['address']})

    # wishlist coverage against live-verified symbols
    live_symbols = {}
    for r in inventory:
        if r.get('symbol'):
            live_symbols.setdefault(r['symbol'].lower(), []).append(r)
    wish = []
    for want in WISHLIST:
        direct = live_symbols.get(want, [])
        wrapped = []
        for alias in WRAPPED_ALIASES.get(want, []):
            wrapped.extend(live_symbols.get(alias, []))
        wish.append({
            'token': want,
            'directProvider': bool(direct),
            'wrappedFormProvider': bool(wrapped),
            'hasBaseProvider': bool(direct or wrapped),
            'direct': [{'rateProvider': h['rateProvider'], 'asset': h['asset'], 'name': h['name'], 'symbol': h['symbol']} for h in direct],
            'wrapped': [{'rateProvider': h['rateProvider'], 'asset': h['asset'], 'name': h['name'], 'symbol': h['symbol']} for h in wrapped],
        })

    doc = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'chain': 'base',
        'chainId': 8453,
        'blockNumber': block,
        'rpc': RPC,
        'source': git_provenance(),
        'rootstockVault': '0x0a3af0Da0175afa0Cc05a6ad9092dC740155a0E7',
        'summary': {
            'baseProviders': len(inventory),
            'distinctAssets': len({r['asset'] for r in inventory if r['asset']}),
            'providersInUseByRootstock': len(using),
            'poolsScanned': len(pools),
            'chainsInRegistry': len(reg),
        },
        'inUse': [{'rateProvider': rp, 'usedBy': uses} for rp, uses in using.items()],
        'baseInventory': inventory,
        'ourPools': pools,
        'wishlist': wish,
    }

    OUT_JSON.write_text(json.dumps(doc, indent=2))
    OUT_MD.write_text(render_md(doc))
    print('wrote', OUT_JSON)
    print('wrote', OUT_MD)
    print('providers(base)=%d inUse=%d pools=%d block=%d' % (
        len(inventory), len(using), len(pools), block))


def fmt_rate(r):
    if not r.get('rateReadable'):
        return 'unreadable'
    return '%.6f' % (int(r['rate']) / 1e18)


def render_md(doc):
    s = doc['source']
    L = []
    A = L.append
    A('# RATE_PROVIDERS.md - Base rate provider register')
    A('')
    A('*Generated, do not hand-edit. Regenerate with:*')
    A('')
    A('```')
    A('git clone https://github.com/balancer/code-review')
    A('export RP_CODE_REVIEW_DIR=/path/to/code-review')
    A('export RP_OUT_DIR=.            # where to write')
    A('export RP_RPC=https://base.publicnode.com')
    A('python scripts/gen_rate_providers.py')
    A('```')
    A('')
    A('A rate provider tells a Balancer pool that a token is worth more (or less) than 1:1')
    A('because it accrues value. Without one, the pool prices the token as flat forever.')
    A('')
    A('## Provenance')
    A('')
    A('| Field | Value |')
    A('|---|---|')
    A('| Source repo | %s |' % s['repo'])
    A('| Commit | `%s` |' % s['commit'])
    A('| Commit date | %s |' % s['commit_date'])
    A('| Commit subject | %s |' % s['commit_subject'])
    A('| Registry file mtime (UTC) | %s |' % s['registry_mtime'])
    A('| Review documents in repo | %d |' % s['review_docs'])
    A('| Chains in registry | %d |' % doc['summary']['chainsInRegistry'])
    A('| Base providers | %d |' % doc['summary']['baseProviders'])
    A('| Base distinct assets | %d |' % doc['summary']['distinctAssets'])
    A('| On-chain read at block | %d |' % doc['blockNumber'])
    A('| Generated (UTC) | %s |' % doc['generatedAt'])
    A('')
    A('Local mirror: `balancer/mirrors/code-review/rate-providers/`')
    A('')
    A('## What ROOTSTOCK uses right now')
    A('')
    if doc['inUse']:
        A('| Rate provider | Rate | Used by |')
        A('|---|---|---|')
        for u in doc['inUse']:
            rp = u['rateProvider']
            inv = next((r for r in doc['baseInventory'] if r['rateProvider'] == rp), None)
            rate = fmt_rate(inv) if inv else '?'
            users = ', '.join('%s (%s)' % (x['pool'], x['token'][:10] + '...') for x in u['usedBy'])
            A('| `%s` | %s | %s |' % (rp, rate, users))
    else:
        A('None.')
    A('')
    A('## Base inventory (all reviewed providers)')
    A('')
    A('| Asset | Rate | Provider | Review name | Verdict | Upgradeable |')
    A('|---|---|---|---|---|---|')
    for r in doc['baseInventory']:
        A('| %s `%s` | %s | `%s` | %s | %s | %s |' % (
            r['symbol'] or '?', (r['asset'] or '')[:10] + '...' if r['asset'] else '?',
            fmt_rate(r), r['rateProvider'], (r['name'] or '')[:36],
            r['summary'] or '?', 'yes' if r['upgradeable'] else 'no'))
    A('')
    A('## Our pools and what each token registers')
    A('')
    A('| Pool | Type | Token | TokenType | Rate provider |')
    A('|---|---|---|---|---|')
    for p in doc['ourPools']:
        if 'error' in p:
            A('| %s | ? | ERROR: %s | | |' % (p.get('symbol'), p['error']))
            continue
        first = True
        for t in p['tokens']:
            A('| %s | %s | `%s` | %s | %s |' % (
                p['symbol'] if first else '',
                p['poolType'] if first else '',
                t['address'], t['tokenType'],
                ('`%s`' % t['rateProvider']) if t['rateProvider'] else '-'))
            first = False
    A('')
    A('## Wishlist coverage')
    A('')
    A('Tokens on the ROOTSTOCK expansion roadmap. `Direct provider` means a reviewed')
    A('provider exists on the token itself. `Wrapped-form provider` means one exists only')
    A('on a wrapped or savings form, which is not the same asset and needs care.')
    A('')
    A('| Token | Direct provider | Wrapped-form provider | Detail |')
    A('|---|---|---|---|')
    for w in doc['wishlist']:
        def fmt(lst):
            return ', '.join('%s `%s`' % ((p['name'] or '')[:24], p['rateProvider']) for p in lst) if lst else '-'
        if w['directProvider'] and w['wrappedFormProvider']:
            detail = 'direct: %s | wrapped: %s' % (fmt(w['direct']), fmt(w['wrapped']))
        elif w['directProvider']:
            detail = fmt(w['direct'])
        elif w['wrappedFormProvider']:
            detail = 'only on wrapped form: %s' % fmt(w['wrapped'])
        else:
            detail = '-'
        A('| %s | %s | %s | %s |' % (
            w['token'],
            'yes' if w['directProvider'] else 'no',
            'yes' if w['wrappedFormProvider'] else 'no',
            detail))
    A('')
    A('## Boundaries')
    A('')
    A('- Registry verdicts are Balancer\'s review words, not our audit.')
    A('- A provider existing does not mean the asset is safe or liquid on Base.')
    A('- Wiring a provider is a VaultAdmin call = multisig. No agent execution.')
    A('- Rates are a block-pinned snapshot, not a live price feed for trading.')
    A('')
    return '\n'.join(L)


if __name__ == '__main__':
    main()
