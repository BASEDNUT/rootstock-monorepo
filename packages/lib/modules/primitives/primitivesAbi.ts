/**
 * Rootstock primitive factory ABIs (S106).
 *
 * Human-readable viem mirrors of src/primitives/{TokenFactory,WrapperFactory}.sol
 * (solc 0.8.36, deployedBytecode sha-verified S105).
 */

export const tokenFactoryAbi = [
  {
    type: 'function',
    name: 'create',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'supply', type: 'uint256' },
    ],
    outputs: [{ name: 'token', type: 'address' }],
  },
  {
    type: 'event',
    name: 'TokenCreated',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'symbol', type: 'string', indexed: false },
      { name: 'supply', type: 'uint256', indexed: false },
    ],
  },
  { type: 'error', name: 'TokenFactory__ZeroSupply', inputs: [] },
  { type: 'error', name: 'TokenFactory__EmptyName', inputs: [] },
  { type: 'error', name: 'TokenFactory__EmptySymbol', inputs: [] },
] as const

export const wrapperFactoryAbi = [
  {
    type: 'function',
    name: 'create',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'underlying', type: 'address' },
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
    ],
    outputs: [{ name: 'wrapper', type: 'address' }],
  },
  {
    type: 'event',
    name: 'WrapperCreated',
    inputs: [
      { name: 'wrapper', type: 'address', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'underlying', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'symbol', type: 'string', indexed: false },
    ],
  },
  {
    type: 'error',
    name: 'WrapperFactory__NotAContract',
    inputs: [{ name: 'underlying', type: 'address' }],
  },
  { type: 'error', name: 'WrapperFactory__EmptyName', inputs: [] },
  { type: 'error', name: 'WrapperFactory__EmptySymbol', inputs: [] },
] as const
