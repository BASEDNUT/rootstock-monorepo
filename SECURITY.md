# Security Policy — ROOTSTOCK

## Reporting a vulnerability

**Contact:** [support@basednut.com](mailto:support@basednut.com)

- Report privately. Do not open a public issue for anything exploitable.
- Same `security.txt` is served at `/.well-known/security.txt` on our site.

## Scope

- ROOTSTOCK contracts deployed by this repo: Base mainnet (8453) and Base Sepolia (84532) — see [deployments/base.json](./deployments/base.json) and [deployments/base-sepolia.json](./deployments/base-sepolia.json) for the canonical address registries.
- Predeploys (WETH, Permit2) are out of scope — report those to their own ecosystems.
- The upstream-inherited architecture is also covered by Balancer's historical audits ([audits/](./audits/)); our own primitives (TokenFactory, WrapperFactory) carry our own audit (0 Critical / 0 High / 0 Medium, 2026-09-27).

## Provenance

Every deployed contract is byte-exact proven against its committed build artifact — see [deployments/PROVENANCE.md](./deployments/PROVENANCE.md). A report against a contract not matching the registry is out of scope (impersonator).

## Response

- We triage and respond on a best-effort basis.
- Please allow reasonable time before public disclosure.
- Safe-harbor: good-faith research on our deployed contracts is welcomed; do not exploit beyond demonstration, do not touch funds.
