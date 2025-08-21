import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

// Etherscan API for real contract deployments
const EtherscanSchema = z.object({
  status: z.string(),
  result: z.array(z.object({
    contractAddress: z.string(),
    contractCreator: z.string(),
    txHash: z.string(),
    blockNumber: z.string(),
    timestamp: z.string(),
    contractName: z.string().optional(),
    compilerVersion: z.string().optional(),
    optimizationUsed: z.string().optional(),
  }))
});

export class EtherscanFetcher extends BaseFetcher<z.infer<typeof EtherscanSchema>> {
  protected config: FetcherConfig = {
    name: 'Etherscan',
    url: 'https://api.etherscan.io/api',
    headers: {},
    rateLimit: 200, // 5 calls/second max
  };

  protected schema = EtherscanSchema;

  async fetch(): Promise<z.infer<typeof EtherscanSchema>[]> {
    if (!process.env.ETHERSCAN_API_KEY) {
      console.warn('[Etherscan] No API key provided');
      return [];
    }

    try {
      // Get latest verified contracts
      const params = new URLSearchParams({
        module: 'contract',
        action: 'getcontractcreation',
        contractaddresses: '', // Would need specific addresses
        apikey: process.env.ETHERSCAN_API_KEY,
      });

      // Alternative: Get latest transactions for major protocols
      const txParams = new URLSearchParams({
        module: 'account',
        action: 'txlist',
        address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI token as example
        startblock: '0',
        endblock: '99999999',
        page: '1',
        offset: '20',
        sort: 'desc',
        apikey: process.env.ETHERSCAN_API_KEY,
      });

      const response = await fetch(`${this.config.url}?${txParams}`);
      const data = await response.json();

      return [data];
    } catch (error) {
      console.error(`[${this.config.name}] Error:`, error);
      return [];
    }
  }

  transform(dataArray: z.infer<typeof EtherscanSchema>[]): ContentItem[] {
    const items: ContentItem[] = [];

    for (const data of dataArray) {
      if (data.status === '1' && data.result) {
        for (const contract of data.result) {
          items.push({
            source: 'Etherscan',
            type: 'blockchain',
            title: `New Contract: ${contract.contractName || contract.contractAddress.substring(0, 10)}`,
            description: `Contract deployed at ${contract.contractAddress}`,
            url: `https://etherscan.io/address/${contract.contractAddress}`,
            author: contract.contractCreator,
            tags: ['ethereum', 'smart-contract', 'deployment'],
            metadata: {
              contract_address: contract.contractAddress,
              creator: contract.contractCreator,
              tx_hash: contract.txHash,
              block_number: contract.blockNumber,
              timestamp: contract.timestamp,
            }
          });
        }
      }
    }

    return items;
  }
}

// Alchemy API for comprehensive blockchain data
const AlchemySchema = z.object({
  jsonrpc: z.string(),
  result: z.object({
    transfers: z.array(z.object({
      blockNum: z.string(),
      hash: z.string(),
      from: z.string(),
      to: z.string(),
      value: z.number().optional(),
      asset: z.string().optional(),
      category: z.string(),
    })).optional(),
  }).optional(),
});

export class AlchemyFetcher extends BaseFetcher<z.infer<typeof AlchemySchema>> {
  protected config: FetcherConfig = {
    name: 'Alchemy',
    url: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    headers: {
      'Content-Type': 'application/json',
    },
    rateLimit: 100,
  };

  protected schema = AlchemySchema;

  async fetch(): Promise<z.infer<typeof AlchemySchema>[]> {
    if (!process.env.ALCHEMY_API_KEY) {
      console.warn('[Alchemy] No API key provided');
      return [];
    }

    try {
      // Get latest NFT transfers as an indicator of activity
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: this.config.headers as HeadersInit,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getAssetTransfers',
          params: [
            {
              fromBlock: 'latest',
              toBlock: 'latest',
              category: ['erc721', 'erc1155'],
              maxCount: '0x14', // 20 results
              excludeZeroValue: true,
            }
          ]
        })
      });

      const data = await response.json();
      return [data];
    } catch (error) {
      console.error(`[${this.config.name}] Error:`, error);
      return [];
    }
  }

  transform(dataArray: z.infer<typeof AlchemySchema>[]): ContentItem[] {
    const items: ContentItem[] = [];

    for (const data of dataArray) {
      if (data.result?.transfers) {
        for (const transfer of data.result.transfers) {
          items.push({
            source: 'Alchemy',
            type: 'blockchain',
            title: `${transfer.category.toUpperCase()} Transfer`,
            description: `Transfer from ${transfer.from.substring(0, 10)} to ${transfer.to.substring(0, 10)}`,
            url: `https://etherscan.io/tx/${transfer.hash}`,
            author: transfer.from,
            tags: ['ethereum', transfer.category, 'transfer'],
            metadata: {
              block_number: transfer.blockNum,
              tx_hash: transfer.hash,
              from: transfer.from,
              to: transfer.to,
              value: transfer.value,
              asset: transfer.asset,
            }
          });
        }
      }
    }

    return items;
  }
}

// Dune Analytics for aggregated blockchain metrics
const DuneSchema = z.object({
  execution_id: z.string(),
  query_id: z.number(),
  state: z.string(),
  result: z.object({
    rows: z.array(z.record(z.any())),
    metadata: z.object({
      column_names: z.array(z.string()),
      result_set_bytes: z.number(),
      total_row_count: z.number(),
    }),
  }).optional(),
});

export class DuneFetcher extends BaseFetcher<z.infer<typeof DuneSchema>> {
  protected config: FetcherConfig = {
    name: 'Dune Analytics',
    url: 'https://api.dune.com/api/v1',
    headers: {
      'X-Dune-API-Key': process.env.DUNE_API_KEY || '',
    },
    rateLimit: 1000,
  };

  protected schema = DuneSchema;

  // Popular queries to track
  private readonly QUERIES = [
    { id: 1234567, name: 'Top DeFi Protocols by TVL' },
    { id: 2345678, name: 'New Token Launches' },
    { id: 3456789, name: 'NFT Market Activity' },
  ];

  async fetch(): Promise<z.infer<typeof DuneSchema>[]> {
    if (!process.env.DUNE_API_KEY) {
      console.warn('[Dune] No API key provided');
      return [];
    }

    const results: z.infer<typeof DuneSchema>[] = [];

    for (const query of this.QUERIES) {
      try {
        // Execute query
        const execResponse = await fetch(
          `${this.config.url}/query/${query.id}/execute`,
          {
            method: 'POST',
            headers: this.config.headers as HeadersInit,
          }
        );

        if (!execResponse.ok) continue;

        const execData = await execResponse.json();
        const executionId = execData.execution_id;

        // Wait and get results
        await this.delay(2000);

        const resultResponse = await fetch(
          `${this.config.url}/execution/${executionId}/results`,
          { headers: this.config.headers as HeadersInit }
        );

        if (resultResponse.ok) {
          const resultData = await resultResponse.json();
          results.push(resultData);
        }
      } catch (error) {
        console.error(`[Dune] Error with query ${query.id}:`, error);
      }
    }

    return results;
  }

  transform(dataArray: z.infer<typeof DuneSchema>[]): ContentItem[] {
    const items: ContentItem[] = [];

    for (const data of dataArray) {
      if (data.state === 'QUERY_STATE_COMPLETED' && data.result) {
        for (const row of data.result.rows.slice(0, 5)) {
          items.push({
            source: 'Dune Analytics',
            type: 'analytics',
            title: `Analytics Update: ${Object.values(row)[0]}`,
            description: JSON.stringify(row).substring(0, 500),
            url: `https://dune.com/queries/${data.query_id}`,
            author: 'Dune Analytics',
            tags: ['analytics', 'blockchain', 'data'],
            metadata: {
              query_id: data.query_id,
              execution_id: data.execution_id,
              data: row,
            }
          });
        }
      }
    }

    return items;
  }

}

// The Graph Protocol for indexed blockchain data
const TheGraphSchema = z.object({
  data: z.record(z.any()),
});

export class TheGraphFetcher extends BaseFetcher<z.infer<typeof TheGraphSchema>> {
  protected config: FetcherConfig = {
    name: 'The Graph',
    url: 'https://api.thegraph.com/subgraphs/name',
    headers: {
      'Content-Type': 'application/json',
    },
    rateLimit: 500,
  };

  protected schema = TheGraphSchema;

  // Popular subgraphs to query
  private readonly SUBGRAPHS = [
    { 
      name: 'uniswap/uniswap-v3',
      query: `{
        pools(first: 5, orderBy: totalValueLockedUSD, orderDirection: desc) {
          id
          token0 { symbol }
          token1 { symbol }
          totalValueLockedUSD
          volumeUSD
        }
      }`
    },
    {
      name: 'aave/protocol-v3',
      query: `{
        markets(first: 5, orderBy: totalValueLockedUSD, orderDirection: desc) {
          id
          name
          totalValueLockedUSD
          totalBorrowsUSD
        }
      }`
    }
  ];

  async fetch(): Promise<z.infer<typeof TheGraphSchema>[]> {
    const results: z.infer<typeof TheGraphSchema>[] = [];

    for (const subgraph of this.SUBGRAPHS) {
      try {
        const response = await fetch(
          `${this.config.url}/${subgraph.name}`,
          {
            method: 'POST',
            headers: this.config.headers as HeadersInit,
            body: JSON.stringify({ query: subgraph.query })
          }
        );

        if (response.ok) {
          const data = await response.json();
          results.push(data);
        }
      } catch (error) {
        console.error(`[TheGraph] Error with ${subgraph.name}:`, error);
      }
    }

    return results;
  }

  transform(dataArray: z.infer<typeof TheGraphSchema>[]): ContentItem[] {
    const items: ContentItem[] = [];

    for (const data of dataArray) {
      if (data.data) {
        // Process different types of data
        const firstKey = Object.keys(data.data)[0];
        const records = data.data[firstKey];

        if (Array.isArray(records)) {
          for (const record of records.slice(0, 3)) {
            items.push({
              source: 'The Graph',
              type: 'analytics',
              title: `${firstKey}: ${record.name || record.id}`,
              description: JSON.stringify(record).substring(0, 300),
              url: 'https://thegraph.com',
              author: 'The Graph Protocol',
              tags: ['defi', 'analytics', firstKey],
              metadata: record,
            });
          }
        }
      }
    }

    return items;
  }
}