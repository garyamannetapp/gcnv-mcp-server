/**
 * Internal delegated-auth plumbing for resource-manager → gcnv-mcp-server calls.
 * Not part of the public MCP tool contract.
 */
export const DELEGATED_ACCESS_TOKEN_ARG = '_delegated_google_access_token';

/** When true, honor runtime-injected delegated tokens from trusted callers (e.g. resource-manager). */
export function isDelegatedAccessTokenEnabled(): boolean {
  const raw = process.env.GCNV_ACCEPT_DELEGATED_ACCESS_TOKEN?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}
