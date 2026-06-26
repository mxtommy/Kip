import { buildPtzUrl, clampPtzVector, clampUnit, dragToPtzVector } from './ptz-command.util';

const BASE = 'http://boat.local:3000/plugins/sk-video/';

describe('clampUnit', () => {
  it('clamps into [-1, 1] and zeroes non-finite input', () => {
    expect(clampUnit(0.5)).toBe(0.5);
    expect(clampUnit(5)).toBe(1);
    expect(clampUnit(-5)).toBe(-1);
    expect(clampUnit(undefined)).toBe(0);
    expect(clampUnit(Number.NaN)).toBe(0);
  });
});

describe('clampPtzVector', () => {
  it('clamps each component and defaults missing ones to 0', () => {
    expect(clampPtzVector({ pan: 2, tilt: -3 })).toEqual({ pan: 1, tilt: -1, zoom: 0 });
  });
});

describe('buildPtzUrl', () => {
  it('builds each PTZ action URL', () => {
    expect(buildPtzUrl(BASE, 'foredeck', 'ptz')).toBe(
      'http://boat.local:3000/plugins/sk-video/cameras/foredeck/ptz'
    );
    expect(buildPtzUrl(BASE, 'foredeck', 'ptz/stop')).toBe(
      'http://boat.local:3000/plugins/sk-video/cameras/foredeck/ptz/stop'
    );
    expect(buildPtzUrl(BASE, 'foredeck', 'ptz/presets')).toBe(
      'http://boat.local:3000/plugins/sk-video/cameras/foredeck/ptz/presets'
    );
  });

  it('adds a trailing slash to a base that lacks one', () => {
    expect(buildPtzUrl('http://h/plugins/sk-video', 'a', 'ptz')).toBe(
      'http://h/plugins/sk-video/cameras/a/ptz'
    );
  });

  it('rejects unsafe ids and non-http bases', () => {
    expect(buildPtzUrl(BASE, '../x', 'ptz')).toBeNull();
    expect(buildPtzUrl(BASE, 'a/b', 'ptz')).toBeNull();
    expect(buildPtzUrl(null, 'a', 'ptz')).toBeNull();
    expect(buildPtzUrl('javascript:1', 'a', 'ptz')).toBeNull();
  });
});

describe('dragToPtzVector', () => {
  it('maps a drag offset to a joystick velocity (right pans right, up tilts up)', () => {
    // Half the reference distance → half speed.
    expect(dragToPtzVector(60, 0, 120)).toEqual({ pan: 0.5, tilt: 0, zoom: 0 });
    // Dragging up (negative dy) tilts up (positive tilt).
    expect(dragToPtzVector(0, -60, 120)).toEqual({ pan: 0, tilt: 0.5, zoom: 0 });
  });

  it('clamps beyond the reference distance to ±1 and never sets zoom', () => {
    expect(dragToPtzVector(1000, -1000, 120)).toEqual({ pan: 1, tilt: 1, zoom: 0 });
    expect(dragToPtzVector(-1000, 1000, 120)).toEqual({ pan: -1, tilt: -1, zoom: 0 });
  });

  it('treats a non-positive reference as 1 to avoid divide-by-zero', () => {
    expect(dragToPtzVector(0.4, 0, 0)).toEqual({ pan: 0.4, tilt: 0, zoom: 0 });
  });
});
