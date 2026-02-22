import { Request, Response } from 'express';

type TAuthFailureResponder = (res: Response, statusCode: number, message: string) => void;

/**
 * Normalizes a candidate user scope value.
 *
 * @param {unknown} value Candidate scope value.
 * @returns {string | null} Trimmed scope or null when empty.
 *
 * @example
 * const scope = normalizeUserScope(' demo-user ');
 */
export function normalizeUserScope(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized.length > 0 ? normalized : null;
}

/**
 * Resolves authenticated user scope from request identity fields.
 *
 * @param {Request} req Incoming Express request.
 * @returns {string | null} Resolved scope or null when unavailable.
 *
 * @example
 * const scope = resolveAuthenticatedUserScope(req);
 */
export function resolveAuthenticatedUserScope(req: Request): string | null {
  // Check for skPrincipal.identifier as the primary method for authenticated scope resolution
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skPrincipal = (req as any).skPrincipal;
  if (skPrincipal && typeof skPrincipal === 'object') {
    const skPrincipalId = normalizeUserScope(skPrincipal.identifier);
    if (skPrincipalId) {
      return skPrincipalId;
    }
  }

  return null;
}

/**
 * Resolves user scope for read operations, returning a fallback when unauthenticated.
 *
 * @param {Request} req Incoming Express request.
 * @param {string} [fallback='anonymous'] Fallback scope value.
 * @returns {string} Resolved or fallback scope.
 *
 * @example
 * const scope = resolveReadUserScope(req);
 */
export function resolveReadUserScope(req: Request, fallback = 'anonymous'): string {
  return resolveAuthenticatedUserScope(req) ?? fallback;
}

/**
 * Resolves user scope for write operations and rejects the request when unresolved.
 *
 * @param {Request} req Incoming Express request.
 * @param {Response} res Express response used for rejection.
 * @param {string} operation Operation label for diagnostics.
 * @param {(message: string) => void} errorLogger Logger callback for refusal messages.
 * @param {TAuthFailureResponder} sendFail Response helper callback.
 * @returns {string | null} Resolved scope or null when rejected.
 *
 * @example
 * const scope = resolveWriteUserScopeOrReject(req, res, 'PUT /series/:seriesId', console.error, sendFail);
 */
export function resolveWriteUserScopeOrReject(
  req: Request,
  res: Response,
  operation: string,
  errorLogger: (message: string) => void,
  sendFail: TAuthFailureResponder
): string | null {
  const userScope = resolveAuthenticatedUserScope(req);
  if (userScope) {
    return userScope;
  }

  errorLogger(
    `[SERIES AUTH] Refused ${operation}: unresolved authenticated user scope method=${req.method} path=${req.path} ip=${req.ip}`
  );
  sendFail(res, 403, 'Authenticated user scope is required for series write operations');
  return null;
}
