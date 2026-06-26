/** Stream schemes a camera may use — mirrors the sk-video plugin's allow-list (a security control). */
export const CAMERA_SCHEMES = ['rtsp', 'rtsps', 'rtmp', 'http', 'https', 'onvif'] as const;
export type TCameraScheme = (typeof CAMERA_SCHEMES)[number];

/** A camera's stream source. */
export interface ICameraSource {
  scheme: TCameraScheme;
  host: string;
  port?: number;
  path?: string;
}

/** A camera definition as stored/served via the Signal K `cameras` resource (never holds credentials). */
export interface ICameraRecord {
  name: string;
  enabled: boolean;
  source: ICameraSource;
}

/** A camera discovered on the network (from the plugin's /cameras/discover). */
export interface ICameraCandidate {
  name: string;
  host: string;
  port?: number;
  onvifUrl?: string;
}

/** The editable fields behind the manual camera form. */
export interface ICameraFields {
  name?: string;
  scheme?: string;
  host?: string;
  port?: number | string | null;
  path?: string | null;
}

export interface ICameraRecordResult {
  valid: boolean;
  errors: string[];
  value?: ICameraRecord;
}

// Client-side mirrors of the plugin's validation, so the user gets immediate feedback. The server
// re-validates and is authoritative.
const HOST_RE = /^[A-Za-z0-9._:-]+$/;
const PATH_RE = /^\/[A-Za-z0-9._~!$&'()*+,;=:@/%-]*$/;

/** Builds and validates a camera record from manual fields. */
export function buildCameraRecord(fields: ICameraFields): ICameraRecordResult {
  const errors: string[] = [];

  const name = (fields.name ?? '').trim();
  if (!name) {
    errors.push('Name is required');
  } else if (name.length > 100) {
    errors.push('Name is too long');
  }

  const scheme = (fields.scheme ?? '').trim().toLowerCase();
  if (!CAMERA_SCHEMES.includes(scheme as TCameraScheme)) {
    errors.push('Choose a valid stream type');
  }

  const host = (fields.host ?? '').trim();
  if (!host) {
    errors.push('Address (host or IP) is required');
  } else if (!HOST_RE.test(host)) {
    errors.push('Address contains invalid characters');
  }

  let port: number | undefined;
  if (fields.port !== undefined && fields.port !== null && `${fields.port}`.trim() !== '') {
    port = Number(fields.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      errors.push('Port must be between 1 and 65535');
      port = undefined;
    }
  }

  let path: string | undefined;
  const rawPath = (fields.path ?? '').trim();
  if (rawPath) {
    if (!rawPath.startsWith('/') || rawPath.includes('..') || !PATH_RE.test(rawPath)) {
      errors.push('Path must be an absolute URL path without ".."');
    } else {
      path = rawPath;
    }
  }

  if (errors.length) {
    return { valid: false, errors };
  }

  const source: ICameraSource = { scheme: scheme as TCameraScheme, host };
  if (port !== undefined) {
    source.port = port;
  }
  if (path !== undefined) {
    source.path = path;
  }
  return { valid: true, errors: [], value: { name, enabled: true, source } };
}

/** Derives a safe `^[A-Za-z0-9-]+$` resource id from a camera name, with a fallback. */
export function slugifyCameraId(name: string, fallback = 'camera'): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

/** Seeds the manual form from a discovered camera (name + address; the user supplies the stream details). */
export function candidateToFields(candidate: ICameraCandidate): ICameraFields {
  return {
    name: candidate.name,
    host: candidate.host,
    port: candidate.port,
    scheme: 'rtsp'
  };
}
