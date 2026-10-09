/*
  SOR swap-path fixtures captured from the test API on 2026-10-08
  (MAINNET, WETH->DAI, swapAmount 0.1). Keyed by the serialized GqlSorSwapType
  enum values ('EXACT_IN' / 'EXACT_OUT') — exactly the strings
  DefaultSwapHandler.simulate passes as query variables.

  Used so the SOR route lookup is deterministic: the live sorGetSwapPaths
  intermittently returns empty paths ('Must contain at least 1 path') —
  CI run 37730864242 failed one test of this file while siblings passed;
  local runs went all-empty after the same IP hammered the endpoint all
  night. The SDK swap math itself still runs against the local anvil
  mainnet fork — only the SOR route lookup is pinned to these captures.
*/
export const sorFixtures: Record<string, Record<string, unknown>> = {
  EXACT_IN: {
    effectivePrice: '0.000355944126663091',
    effectivePriceReversed: '2809.42969722470188499',
    swapType: 'EXACT_IN',
    paths: [
      {
        inputAmountRaw: '25000000000000000',
        outputAmountRaw: '64265874281709531798',
        pools: [
          '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019',
          '0x79c58f70905f734641735bc61e45c19dd9ad60bc0000000000000000000004e7',
        ],
        isBuffer: [false, false],
        protocolVersion: 2,
        tokens: [
          {
            address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            decimals: 18,
          },
          {
            address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            decimals: 6,
          },
          {
            address: '0x6b175474e89094c44da98b954eedeac495271d0f',
            decimals: 18,
          },
        ],
      },
      {
        inputAmountRaw: '75000000000000000',
        outputAmountRaw: '216677095440760656701',
        pools: [
          '0xf01b0684c98cd7ada480bfdf6e43876422fa1fc10002000000000000000005de',
          '0xd4f79ca0ac83192693bce4699d0c10c66aa6cf0f00020000000000000000047e',
          '0xc45d42f801105e861e86658648e3678ad7aa70f900010000000000000000011e',
        ],
        isBuffer: [false, false, false],
        protocolVersion: 2,
        tokens: [
          {
            address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            decimals: 18,
          },
          {
            address: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
            decimals: 18,
          },
          {
            address: '0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5',
            decimals: 9,
          },
          {
            address: '0x6b175474e89094c44da98b954eedeac495271d0f',
            decimals: 18,
          },
        ],
      },
    ],
    priceImpact: {
      priceImpact: null,
      error:
        'Price impact could not be calculated for this path. The swap path is still valid and can be executed.',
    },
    returnAmount: '280.942969722470188499',
    swapAmount: '0.1',
    routes: [
      {
        hops: [
          {
            poolId: '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019',
            tokenIn: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            tokenInAmount: '0.025',
            tokenOut: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            tokenOutAmount: '0',
          },
          {
            poolId: '0x79c58f70905f734641735bc61e45c19dd9ad60bc0000000000000000000004e7',
            tokenIn: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            tokenInAmount: '0',
            tokenOut: '0x6b175474e89094c44da98b954eedeac495271d0f',
            tokenOutAmount: '64.265874281709531798',
          },
        ],
        share: 0.5,
        tokenInAmount: '0.025',
        tokenOut: '0x6b175474e89094c44da98b954eedeac495271d0f',
        tokenOutAmount: '64.265874281709531798',
      },
      {
        hops: [
          {
            poolId: '0xf01b0684c98cd7ada480bfdf6e43876422fa1fc10002000000000000000005de',
            tokenIn: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            tokenInAmount: '0.075',
            tokenOut: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
            tokenOutAmount: '0',
          },
          {
            poolId: '0xd4f79ca0ac83192693bce4699d0c10c66aa6cf0f00020000000000000000047e',
            tokenIn: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
            tokenInAmount: '0',
            tokenOut: '0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5',
            tokenOutAmount: '0',
          },
          {
            poolId: '0xc45d42f801105e861e86658648e3678ad7aa70f900010000000000000000011e',
            tokenIn: '0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5',
            tokenInAmount: '0',
            tokenOut: '0x6b175474e89094c44da98b954eedeac495271d0f',
            tokenOutAmount: '216.677095440760656701',
          },
        ],
        share: 0.5,
        tokenInAmount: '0.075',
        tokenOut: '0x6b175474e89094c44da98b954eedeac495271d0f',
        tokenOutAmount: '216.677095440760656701',
      },
    ],
    swaps: [
      {
        amount: '25000000000000000',
        assetInIndex: 0,
        assetOutIndex: 1,
        poolId: '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019',
        userData: '0x',
      },
      {
        amount: '0',
        assetInIndex: 1,
        assetOutIndex: 2,
        poolId: '0x79c58f70905f734641735bc61e45c19dd9ad60bc0000000000000000000004e7',
        userData: '0x',
      },
      {
        amount: '75000000000000000',
        assetInIndex: 0,
        assetOutIndex: 3,
        poolId: '0xf01b0684c98cd7ada480bfdf6e43876422fa1fc10002000000000000000005de',
        userData: '0x',
      },
      {
        amount: '0',
        assetInIndex: 3,
        assetOutIndex: 4,
        poolId: '0xd4f79ca0ac83192693bce4699d0c10c66aa6cf0f00020000000000000000047e',
        userData: '0x',
      },
      {
        amount: '0',
        assetInIndex: 4,
        assetOutIndex: 2,
        poolId: '0xc45d42f801105e861e86658648e3678ad7aa70f900010000000000000000011e',
        userData: '0x',
      },
    ],
    tokenIn: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    tokenInAmount: '100000000000000000',
    tokenOut: '0x6b175474e89094c44da98b954eedeac495271d0f',
    tokenOutAmount: '280942969722470188499',
    protocolVersion: 2,
  },
  EXACT_OUT: {
    effectivePrice: '0.00038664380214102',
    effectivePriceReversed: '2586.359834200242879313',
    swapType: 'EXACT_OUT',
    paths: [
      {
        inputAmountRaw: '38664380214102',
        outputAmountRaw: '100000000000000000',
        pools: ['0xc6a5032dc4bf638e15b4a66bc718ba7ba474ff73000200000000000000000004'],
        isBuffer: [false],
        protocolVersion: 2,
        tokens: [
          {
            address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            decimals: 18,
          },
          {
            address: '0x6b175474e89094c44da98b954eedeac495271d0f',
            decimals: 18,
          },
        ],
      },
    ],
    priceImpact: {
      priceImpact: null,
      error:
        'Price impact could not be calculated for this path. The swap path is still valid and can be executed.',
    },
    returnAmount: '0.000038664380214102',
    swapAmount: '0.1',
    routes: [
      {
        hops: [
          {
            poolId: '0xc6a5032dc4bf638e15b4a66bc718ba7ba474ff73000200000000000000000004',
            tokenIn: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            tokenInAmount: '0.000038664380214102',
            tokenOut: '0x6b175474e89094c44da98b954eedeac495271d0f',
            tokenOutAmount: '0.000038664380214102',
          },
        ],
        share: 1,
        tokenInAmount: '0.000038664380214102',
        tokenOut: '0x6b175474e89094c44da98b954eedeac495271d0f',
        tokenOutAmount: '0.000038664380214102',
      },
    ],
    swaps: [
      {
        amount: '100000000000000000',
        assetInIndex: 0,
        assetOutIndex: 1,
        poolId: '0xc6a5032dc4bf638e15b4a66bc718ba7ba474ff73000200000000000000000004',
        userData: '0x',
      },
    ],
    tokenIn: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    tokenInAmount: '38664380214102',
    tokenOut: '0x6b175474e89094c44da98b954eedeac495271d0f',
    tokenOutAmount: '100000000000000000',
    protocolVersion: 2,
  },
}
