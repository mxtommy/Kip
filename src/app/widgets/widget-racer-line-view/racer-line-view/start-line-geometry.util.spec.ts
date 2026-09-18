import { lineGeometry, offsetFrom, screenVector } from './start-line-geometry.util';

// A line laid due east-west at the equator, so a degree of longitude is a clean
// east/west offset and a degree of latitude a clean north/south one.
const STB = { latitude: 0, longitude: 0 };
const PORT = { latitude: 0, longitude: 0.001 };

describe('start-line geometry', () => {
  describe('offsetFrom', () => {
    it('measures east and north in metres', () => {
      const o = offsetFrom(STB, { latitude: 0.001, longitude: 0.002 });
      expect(o.e).toBeCloseTo(222.4, 0);
      expect(o.n).toBeCloseTo(111.2, 0);
    });

    it('shrinks the east offset with the cosine of the latitude', () => {
      const equator = offsetFrom({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.001 });
      const sixty = offsetFrom({ latitude: 60, longitude: 0 }, { latitude: 60, longitude: 0.001 });
      expect(sixty.e).toBeCloseTo(equator.e / 2, 1);
    });
  });

  describe('lineGeometry', () => {
    it('returns null without both ends', () => {
      expect(lineGeometry(null, STB, null)).toBeNull();
      expect(lineGeometry(PORT, null, null)).toBeNull();
    });

    it('returns null when the two ends coincide', () => {
      expect(lineGeometry(STB, STB, null)).toBeNull();
    });

    it('measures the line length and its bearing from the starboard end to the port end', () => {
      const geo = lineGeometry(PORT, STB, null)!;
      expect(geo.length).toBeCloseTo(111.2, 0);
      // Port lies due east of the committee boat.
      expect(geo.bearing).toBeCloseTo(90, 3);
      expect(geo.boat).toBeNull();
    });

    it('places a boat on the pre-start side at a positive across distance', () => {
      // The pre-start side is 90 degrees anticlockwise of the line bearing, so with the
      // line running east it is to the north.
      const geo = lineGeometry(PORT, STB, { latitude: 0.0005, longitude: 0.0005 })!;
      expect(geo.boat!.a).toBeCloseTo(geo.length / 2, 1);
      expect(geo.boat!.c).toBeCloseTo(55.6, 0);
    });

    it('places an OCS boat at a negative across distance', () => {
      // The course side is the other half, 90 degrees clockwise of the line bearing.
      const geo = lineGeometry(PORT, STB, { latitude: -0.0005, longitude: 0.0005 })!;
      expect(geo.boat!.c).toBeLessThan(0);
    });

    it('measures along from the starboard end towards the port end', () => {
      const atStb = lineGeometry(PORT, STB, STB)!;
      expect(atStb.boat!.a).toBeCloseTo(0, 6);
      const atPort = lineGeometry(PORT, STB, PORT)!;
      expect(atPort.boat!.a).toBeCloseTo(atPort.length, 6);
    });
  });

  describe('screenVector', () => {
    const rad = (deg: number) => deg * Math.PI / 180;

    it('draws the port end to the left', () => {
      // Sailing along the line bearing heads towards the port (pin) end.
      const v = screenVector(rad(90), 90);
      expect(v.x).toBeCloseTo(-1, 6);
      expect(v.y).toBeCloseTo(0, 6);
    });

    it('draws the course side straight up', () => {
      // The course side is 90 degrees clockwise of the line bearing.
      const v = screenVector(rad(180), 90);
      expect(v.x).toBeCloseTo(0, 6);
      expect(v.y).toBeCloseTo(-1, 6);
    });

    it('draws the pre-start side straight down', () => {
      const v = screenVector(rad(0), 90);
      expect(v.x).toBeCloseTo(0, 6);
      expect(v.y).toBeCloseTo(1, 6);
    });

    it('holds the same screen directions whatever the line bearing', () => {
      for (const bearing of [0, 37, 180, 305]) {
        const up = screenVector(rad((bearing + 90) % 360), bearing);
        expect(up.x).toBeCloseTo(0, 6);
        expect(up.y).toBeCloseTo(-1, 6);
      }
    });
  });
});
