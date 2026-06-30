import { z, type ZodObject, type ZodRawShape } from 'zod';
import { isDelegatedAccessTokenEnabled } from './delegated-access-token.js';

/**
 * Build the MCP tool input schema. When delegated auth is enabled, passthrough
 * allows resource-manager to inject runtime-only args without advertising them
 * in list_tools JSON schema.
 */
export function buildToolInputSchema(shape: ZodRawShape): ZodObject<any> {
  const base = z.object(shape);
  return isDelegatedAccessTokenEnabled() ? base.passthrough() : base;
}
