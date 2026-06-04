import { describe, expect, it, vi } from 'vitest';
import { createOrdrestyringGateway, ordrestyringGatewayTools } from '../src/gateway.js';

describe('Ordrestyring gateway export', () => {
  it('exposes a stable first-wedge gateway surface with writes disabled by default', () => {
    expect(ordrestyringGatewayTools.map(tool => [tool.name, tool.riskLevel, tool.enabledByDefault])).toEqual([
      ['check_connection', 'read', true],
      ['search_cases', 'read', true],
      ['get_case_health', 'read', true],
      ['find_billable_cases', 'read', true],
      ['get_invoice_readiness', 'read', true],
      ['create_customer', 'write', false],
      ['delete_products', 'destructive', false],
    ]);
  });

  it('calls the configured client without credentials in tool input', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe('https://example.test/graphql');
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer test-token',
      });
      expect(JSON.parse(String(init?.body)).query).toContain('query OrdrestyringMcpCheckConnection');

      return jsonResponse({ data: { __typename: 'Query' } });
    });
    const gateway = createOrdrestyringGateway({
      apiToken: 'test-token',
      baseUrl: 'https://example.test',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const result = await gateway.callTool('check_connection');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({ ok: true, typename: 'Query' });
  });

  it('blocks write calls by default before contacting Ordrestyring', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const gateway = createOrdrestyringGateway({
      apiToken: 'test-token',
      baseUrl: 'https://example.test',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const result = await gateway.callTool('create_customer', {
      input: { name: 'ACME ApS' },
      reason: 'Approved test setup.',
      idempotencyKey: 'customer-acme',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/writes are disabled/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns an MCP-style error for unsupported gateway tools', async () => {
    const gateway = createOrdrestyringGateway({
      apiToken: 'test-token',
      baseUrl: 'https://example.test',
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });

    await expect(gateway.callTool('unknown_tool')).resolves.toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'Unsupported Ordrestyring gateway tool: unknown_tool' }],
    });
  });
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}
