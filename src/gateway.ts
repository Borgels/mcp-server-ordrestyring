import { formatUnknownError } from './errors.js';
import { OrdrestyringClient, type OrdrestyringClientOptions } from './ordrestyring/client.js';
import { registerOrdrestyringTools } from './tools/ordrestyring.js';

export type GatewayRiskLevel = 'read' | 'write' | 'destructive';
export type GatewayJsonValue =
  | string
  | number
  | boolean
  | null
  | GatewayJsonValue[]
  | { [key: string]: GatewayJsonValue };
export type GatewayJsonObject = { [key: string]: GatewayJsonValue };

export interface GatewayToolDefinition {
  name: string;
  title: string;
  description: string;
  riskLevel: GatewayRiskLevel;
  enabledByDefault: boolean;
  inputSchema: GatewayJsonObject;
}

export interface GatewayToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: GatewayJsonValue;
  isError?: boolean;
}

export interface OrdrestyringGatewayOptions extends OrdrestyringClientOptions {}

type RegisteredToolHandler = (input: Record<string, unknown>) => Promise<unknown>;

const emptyInput = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} satisfies GatewayJsonObject;

const paginationProperties = {
  cursor: { type: ['string', 'null'], description: 'Optional Ordrestyring cursor.' },
  limit: { type: 'number', minimum: 1, maximum: 500, description: 'Maximum records to return.' },
} satisfies GatewayJsonObject;

const caseIdProperties = {
  caseId: { type: 'number', minimum: 1, description: 'Ordrestyring case id.' },
  includeSubCases: { type: 'boolean', description: 'Include subcases where the live schema supports it.' },
  ...paginationProperties,
} satisfies GatewayJsonObject;

const operationalWriteInput = {
  type: 'object',
  properties: {
    input: {
      type: 'object',
      description: 'Operation-specific Ordrestyring mutation input.',
      additionalProperties: true,
    },
    reason: { type: 'string', minLength: 1 },
    idempotencyKey: { type: 'string', minLength: 8 },
  },
  required: ['input', 'reason', 'idempotencyKey'],
  additionalProperties: false,
} satisfies GatewayJsonObject;

export const ordrestyringGatewayTools: GatewayToolDefinition[] = [
  {
    name: 'check_connection',
    title: 'Check Ordrestyring connection',
    description: 'Verify that the configured Ordrestyring token can access the GraphQL API.',
    riskLevel: 'read',
    enabledByDefault: true,
    inputSchema: emptyInput,
  },
  {
    name: 'search_cases',
    title: 'Search Ordrestyring cases',
    description: 'Search or filter cases using schema-supported arguments from the live Ordrestyring schema.',
    riskLevel: 'read',
    enabledByDefault: true,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        status: { type: 'string' },
        statusId: { type: 'number', minimum: 1 },
        customerId: { type: 'number', minimum: 1 },
        updatedFrom: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        updatedTo: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        orderByField: { type: 'string' },
        orderDirection: { type: 'string', enum: ['ASC', 'DESC'] },
        ...paginationProperties,
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_case_health',
    title: 'Get Ordrestyring case health',
    description: 'Collect case overview, activity, work, documents, quality checks, and billing readiness.',
    riskLevel: 'read',
    enabledByDefault: true,
    inputSchema: {
      type: 'object',
      properties: caseIdProperties,
      required: ['caseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'find_billable_cases',
    title: 'Find Ordrestyring billable cases',
    description: 'Find operational cases that look ready for billing review.',
    riskLevel: 'read',
    enabledByDefault: true,
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'number', minimum: 1 },
        statusId: { type: 'number', minimum: 1 },
        includeReadiness: { type: 'boolean' },
        ...paginationProperties,
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_invoice_readiness',
    title: 'Get Ordrestyring invoice readiness',
    description: 'Inspect one case for billing readiness: overview, uninvoiced work, draft invoice, and financials.',
    riskLevel: 'read',
    enabledByDefault: true,
    inputSchema: {
      type: 'object',
      properties: caseIdProperties,
      required: ['caseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_customer',
    title: 'Create Ordrestyring customer',
    description: 'Create an operational customer in Ordrestyring when writes and policy explicitly allow it.',
    riskLevel: 'write',
    enabledByDefault: false,
    inputSchema: operationalWriteInput,
  },
  {
    name: 'delete_products',
    title: 'Delete Ordrestyring products',
    description: 'Delete product/item master data in Ordrestyring when writes and policy explicitly allow it.',
    riskLevel: 'destructive',
    enabledByDefault: false,
    inputSchema: operationalWriteInput,
  },
];

const handlerNames: Record<string, string> = {
  check_connection: 'ordrestyring_check_connection',
  search_cases: 'ordrestyring_search_cases',
  get_case_health: 'ordrestyring_get_case_health',
  find_billable_cases: 'ordrestyring_find_billable_cases',
  get_invoice_readiness: 'ordrestyring_get_invoice_readiness',
  create_customer: 'ordrestyring_create_customer',
  delete_products: 'ordrestyring_delete_products',
};

export function createOrdrestyringGateway(options: OrdrestyringGatewayOptions = {}) {
  const client = new OrdrestyringClient(options);
  const handlers = captureHandlers(client);

  return {
    tools: ordrestyringGatewayTools,
    async callTool(toolName: string, input: GatewayJsonObject = {}): Promise<GatewayToolResult> {
      const handlerName = handlerNames[toolName];
      if (!handlerName) {
        return errorResult(`Unsupported Ordrestyring gateway tool: ${toolName}`);
      }

      const handler = handlers[handlerName];
      if (!handler) {
        return errorResult(`Ordrestyring handler is not registered: ${handlerName}`);
      }

      try {
        return normalizeResult(await handler(input));
      } catch (error) {
        return errorResult(formatUnknownError(error));
      }
    },
  };
}

function captureHandlers(client: OrdrestyringClient): Record<string, RegisteredToolHandler> {
  const handlers: Record<string, RegisteredToolHandler> = {};
  const server = {
    registerTool(name: string, _config: unknown, handler: RegisteredToolHandler): void {
      handlers[name] = handler;
    },
  };

  registerOrdrestyringTools(server as never, client);
  return handlers;
}

function normalizeResult(result: unknown): GatewayToolResult {
  if (!result || typeof result !== 'object' || !Array.isArray((result as { content?: unknown }).content)) {
    return jsonResult('Ordrestyring gateway result.', toGatewayJson(result));
  }

  const content = (result as { content: Array<{ type: 'text'; text: string }> }).content;
  const text = content[0]?.text;
  if (typeof text !== 'string') {
    return { content };
  }

  try {
    return {
      content,
      structuredContent: toGatewayJson(JSON.parse(text)),
    };
  } catch {
    return { content };
  }
}

function jsonResult(text: string, structuredContent: unknown): GatewayToolResult {
  return {
    content: [{ type: 'text', text }],
    structuredContent: toGatewayJson(structuredContent),
  };
}

function errorResult(text: string): GatewayToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text }],
  };
}

function toGatewayJson(value: unknown): GatewayJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as GatewayJsonValue;
}
