import type { IRouter, Request, Response } from 'express';
import multer from 'multer';
import { ImageStore, ImageValidationError, MAX_UPLOAD_BYTES } from './image-store';

/**
 * Signal K does not expose a request principal in its public plugin API, but its security
 * middleware augments authenticated requests with `skPrincipal` at runtime. We treat:
 *  - principal present with an identifier  => authenticated (allowed)
 *  - security configured but no principal   => anonymous (rejected)
 *  - no security signals at all             => security disabled / no users => allowed
 * SK's own middleware is the primary gate (it already protects the existing write routes); this is
 * a defensive in-handler check. Verify against a secured server during the e2e step.
 */
interface SkRequest extends Request {
  skPrincipal?: { identifier?: string } | null;
  skIsAuthenticated?: boolean;
}

export function isAuthenticatedRequest(req: SkRequest): boolean {
  if (req.skPrincipal === undefined && req.skIsAuthenticated === undefined) {
    return true; // security disabled (no users) — consistent with the plugin's other write routes
  }
  return Boolean(req.skPrincipal && req.skPrincipal.identifier) || req.skIsAuthenticated === true;
}

function principalId(req: SkRequest): string | null {
  return (req.skPrincipal && req.skPrincipal.identifier) || null;
}

const ID_RE = /^[A-Za-z0-9-]+$/;

function sendJson(res: Response, status: number, body: unknown): void {
  res.status(status).json(body);
}
function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

export interface ImageRouterDeps {
  /** Lazily resolve the store (the data dir is only known after the plugin initializes). */
  resolveStore: () => ImageStore | null;
  isAuthenticated?: (req: Request) => boolean;
  log?: (msg: string) => void;
}

/** Register the image-asset routes on the plugin's Express router (mounted at /plugins/kip). */
export function registerImageRoutes(router: IRouter, deps: ImageRouterDeps): void {
  const isAuth = deps.isAuthenticated ?? isAuthenticatedRequest;
  const getStore = (res: Response): ImageStore | null => {
    const store = deps.resolveStore();
    if (!store) sendError(res, 503, 'Image service is not ready');
    return store;
  };
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
  const single = upload.single('file');

  // POST /images — upload (auth required; auth is checked BEFORE multipart parsing).
  router.post('/images', (req: Request, res: Response) => {
    if (!isAuth(req)) return sendError(res, 401, 'Login required to upload images');
    single(req, res, (err: unknown) => {
      void (async () => {
        if (err) {
          const code = (err as { code?: string }).code;
          if (code === 'LIMIT_FILE_SIZE') return sendError(res, 413, `File exceeds ${MAX_UPLOAD_BYTES} byte limit`);
          return sendError(res, 400, `Upload failed: ${(err as Error).message}`);
        }
        const file = (req as Request & { file?: { buffer: Buffer; originalname: string } }).file;
        if (!file || !file.buffer) return sendError(res, 400, 'No file provided (expected form field "file")');
        const store = getStore(res);
        if (!store) return;
        try {
          const meta = await store.ingest(file.buffer, file.originalname, principalId(req as SkRequest));
          return sendJson(res, 201, { ...meta, url: `images/${meta.id}` });
        } catch (e) {
          if (e instanceof ImageValidationError) return sendError(res, 415, e.message);
          deps.log?.(`[KIP][images] ingest error: ${(e as Error).message}`);
          return sendError(res, 500, 'Failed to store image');
        }
      })();
    });
  });

  // GET /images — list the shared library.
  router.get('/images', (_req: Request, res: Response) => {
    const store = getStore(res);
    if (!store) return;
    void (async () => {
      try {
        res.json(await store.list());
      } catch {
        sendError(res, 500, 'Failed to list images');
      }
    })();
  });

  // Cache routes MUST be registered before /images/:id so "cache" is not matched as an id.
  router.get('/images/cache', (_req: Request, res: Response) => {
    const store = getStore(res);
    if (!store) return;
    void (async () => {
      try {
        res.json(await store.cacheStats());
      } catch {
        sendError(res, 500, 'Failed to read cache stats');
      }
    })();
  });

  router.delete('/images/cache', (req: Request, res: Response) => {
    if (!isAuth(req)) return sendError(res, 401, 'Login required to purge the image cache');
    const store = getStore(res);
    if (!store) return;
    void (async () => {
      try {
        await store.purgeCache();
        res.json({ ok: true });
      } catch {
        sendError(res, 500, 'Failed to purge cache');
      }
    })();
  });

  // GET /images/:id?w= — serve a variant (raster re-encoded to WebP) or sanitized SVG.
  router.get('/images/:id', (req: Request, res: Response) => {
    const id = String(req.params.id ?? '');
    if (!ID_RE.test(id)) return sendError(res, 400, 'Invalid image id');
    const rawW = req.query.w;
    const width = typeof rawW === 'string' && rawW.trim() !== '' ? Number(rawW) : undefined;
    const store = getStore(res);
    if (!store) return;
    void (async () => {
      try {
        const servable = await store.getServable(id, Number.isFinite(width) ? width : undefined);
        if (!servable) return sendError(res, 404, 'Image not found');
        for (const [k, v] of Object.entries(servable.headers)) res.setHeader(k, v);
        res.status(200).send(servable.buffer);
      } catch (e) {
        deps.log?.(`[KIP][images] serve error: ${(e as Error).message}`);
        sendError(res, 500, 'Failed to render image');
      }
    })();
  });

  // DELETE /images/:id — remove an image (auth required).
  router.delete('/images/:id', (req: Request, res: Response) => {
    if (!isAuth(req)) return sendError(res, 401, 'Login required to delete images');
    const id = String(req.params.id ?? '');
    if (!ID_RE.test(id)) return sendError(res, 400, 'Invalid image id');
    const store = getStore(res);
    if (!store) return;
    void (async () => {
      try {
        const removed = await store.remove(id);
        if (!removed) return sendError(res, 404, 'Image not found');
        res.json({ ok: true });
      } catch {
        sendError(res, 500, 'Failed to delete image');
      }
    })();
  });
}
