import { afterEach, describe, expect, it } from 'vitest';
import { registerAllTools } from './register-tools.js';
import {
  currentRequestAccessToken,
  runWithRequestAccessToken,
} from '../auth/access-token-context.js';

describe('registerAllTools', () => {
  const originalFlag = process.env.GCNV_ACCEPT_DELEGATED_ACCESS_TOKEN;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.GCNV_ACCEPT_DELEGATED_ACCESS_TOKEN;
    } else {
      process.env.GCNV_ACCEPT_DELEGATED_ACCESS_TOKEN = originalFlag;
    }
  });

  it('registers all tools with name, definition, and handler', async () => {
    const calls: Array<{ name: string; tool: any; handler: any }> = [];

    const fakeMcpServer = {
      registerTool: (name: string, tool: any, handler: any) => {
        calls.push({ name, tool, handler });
      },
    } as any;

    registerAllTools(fakeMcpServer);

    // Keep this count in sync with register-tools.ts
    expect(calls.length).toBe(85);

    // Each registration uses the tool's name as the key
    for (const c of calls) {
      expect(c.name).toBeTruthy();
      expect(c.tool?.name).toBe(c.name);
      expect(typeof c.handler).toBe('function');
    }

    // Names should be unique
    const uniqueNames = new Set(calls.map((c) => c.name));
    expect(uniqueNames.size).toBe(calls.length);
  });

  it('does not expose delegated token in public tool schemas by default', async () => {
    delete process.env.GCNV_ACCEPT_DELEGATED_ACCESS_TOKEN;
    const calls: Array<{ name: string; tool: any; handler: any }> = [];
    const fakeMcpServer = {
      registerTool: (name: string, tool: any, handler: any) => {
        calls.push({ name, tool, handler });
      },
    } as any;

    registerAllTools(fakeMcpServer);
    for (const c of calls) {
      expect(c.tool.inputSchema.shape).not.toHaveProperty('_delegated_google_access_token');
    }
  });

  it('forwards delegated token and strips internal arg before handler call when enabled', async () => {
    process.env.GCNV_ACCEPT_DELEGATED_ACCESS_TOKEN = 'true';
    const calls: Array<{ name: string; tool: any; handler: any }> = [];
    const fakeMcpServer = {
      registerTool: (name: string, tool: any, handler: any) => {
        calls.push({ name, tool, handler });
      },
    } as any;

    registerAllTools(fakeMcpServer);
    const auditTool = calls.find((c) => c.name === 'ontap_audit_log');
    expect(auditTool).toBeTruthy();

    const result = await auditTool!.handler({
      action: 'status',
      _delegated_google_access_token: 'token-from-rm',
    });
    expect(result.structuredContent?.result).toBeDefined();
    expect(JSON.stringify(result)).not.toContain('_delegated_google_access_token');
  });

  it('ignores client-supplied delegated token when feature is disabled', async () => {
    delete process.env.GCNV_ACCEPT_DELEGATED_ACCESS_TOKEN;
    const calls: Array<{ name: string; tool: any; handler: any }> = [];
    const fakeMcpServer = {
      registerTool: (name: string, tool: any, handler: any) => {
        calls.push({ name, tool, handler });
      },
    } as any;

    registerAllTools(fakeMcpServer);
    const auditTool = calls.find((c) => c.name === 'ontap_audit_log');
    expect(auditTool).toBeTruthy();

    await runWithRequestAccessToken(undefined, async () => {
      await auditTool!.handler({
        action: 'status',
        _delegated_google_access_token: 'client-supplied',
      });
      expect(currentRequestAccessToken()).toBeUndefined();
    });
  });

  it('handles blank delegated token args without throwing when enabled', async () => {
    process.env.GCNV_ACCEPT_DELEGATED_ACCESS_TOKEN = 'true';
    const calls: Array<{ name: string; tool: any; handler: any }> = [];
    const fakeMcpServer = {
      registerTool: (name: string, tool: any, handler: any) => {
        calls.push({ name, tool, handler });
      },
    } as any;

    registerAllTools(fakeMcpServer);
    const auditTool = calls.find((c) => c.name === 'ontap_audit_log');
    expect(auditTool).toBeTruthy();

    await expect(
      auditTool!.handler({
        action: 'status',
        _delegated_google_access_token: '   ',
      })
    ).resolves.toBeDefined();
  });

  it('keeps delegated wrapper callable with minimal safe args', async () => {
    const calls: Array<{ name: string; tool: any; handler: any }> = [];
    const fakeMcpServer = {
      registerTool: (name: string, tool: any, handler: any) => {
        calls.push({ name, tool, handler });
      },
    } as any;

    registerAllTools(fakeMcpServer);
    const auditTool = calls.find((c) => c.name === 'ontap_audit_log');
    expect(auditTool).toBeTruthy();
    await expect(auditTool!.handler({ action: 'status' })).resolves.toBeDefined();
  });

  it('does not shadow HTTP request token when no delegated token is provided', async () => {
    process.env.GCNV_ACCEPT_DELEGATED_ACCESS_TOKEN = 'true';
    const calls: Array<{ name: string; tool: any; handler: any }> = [];
    const fakeMcpServer = {
      registerTool: (name: string, tool: any, handler: any) => {
        calls.push({ name, tool, handler });
      },
    } as any;

    registerAllTools(fakeMcpServer);
    const listTool = calls.find((c) => c.name === 'gcnv_storage_pool_list');
    expect(listTool).toBeTruthy();

    await runWithRequestAccessToken('http-request-token', async () => {
      await listTool!.handler({ projectId: 'test-project', location: 'us-central1' });
      expect(currentRequestAccessToken()).toBe('http-request-token');
    });
  });

  it('forwards sessionId extra to wrapped handlers', async () => {
    const calls: Array<{ name: string; tool: any; handler: any }> = [];
    const fakeMcpServer = {
      registerTool: (name: string, tool: any, handler: any) => {
        calls.push({ name, tool, handler });
      },
    } as any;

    registerAllTools(fakeMcpServer);
    const volumeListTool = calls.find((c) => c.name === 'ontap_volume_list');
    expect(volumeListTool).toBeTruthy();

    await expect(
      volumeListTool!.handler(
        {
          projectId: 'test-project',
          location: 'us-central1',
          storagePoolId: 'pool-1',
        },
        { sessionId: 'audit-session-123' }
      )
    ).resolves.toBeDefined();
  });
});
