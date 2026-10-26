'use strict';

const { haversineMetres } = require('../haversine');

describe('haversineMetres', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineMetres([0, 0], [0, 0])).toBe(0);
  });

  it('returns 0 for identical Mumbai coords', () => {
    const cst = [72.8354, 18.9398]; // Mumbai CST
    expect(haversineMetres(cst, cst)).toBe(0);
  });

  it('is symmetric — distance A→B equals distance B→A', () => {
    const cst = [72.8354, 18.9398]; // Mumbai CST
    const dadar = [72.8436, 19.0183]; // Dadar station
    const d1 = haversineMetres(cst, dadar);
    const d2 = haversineMetres(dadar, cst);
    expect(d1).toBeCloseTo(d2, 5);
  });

  it('Mumbai CST to Dadar is approximately 8.8 km (within 1%)', () => {
    // Actual straight-line distance: ~8.8 km
    const cst = [72.8354, 18.9398];
    const dadar = [72.8436, 19.0183];
    const distM = haversineMetres(cst, dadar);
    const expected = 8800; // metres
    expect(distM).toBeGreaterThan(expected * 0.99);
    expect(distM).toBeLessThan(expected * 1.01);
  });

  it('same longitude, 1 degree latitude apart ≈ 111 195 m (within 1%)', () => {
    const p1 = [0, 0];
    const p2 = [0, 1];
    const distM = haversineMetres(p1, p2);
    const expected = 111195;
    expect(distM).toBeGreaterThan(expected * 0.99);
    expect(distM).toBeLessThan(expected * 1.01);
  });

  it('same latitude, 1 degree longitude apart at equator ≈ 111 195 m (within 1%)', () => {
    const p1 = [0, 0];
    const p2 = [1, 0];
    const distM = haversineMetres(p1, p2);
    const expected = 111195;
    expect(distM).toBeGreaterThan(expected * 0.99);
    expect(distM).toBeLessThan(expected * 1.01);
  });

  it('antipodal points ≈ half Earth circumference (within 0.1%)', () => {
    // Earth circumference ≈ 2 * π * 6371000 = 40 030 170 m
    // Antipodal = half = ~20 015 085 m
    const p1 = [0, 0];
    const p2 = [180, 0];
    const distM = haversineMetres(p1, p2);
    const expected = Math.PI * 6371000; // half circumference
    expect(distM).toBeGreaterThan(expected * 0.999);
    expect(distM).toBeLessThan(expected * 1.001);
  });

  it('Andheri to BKC ≈ 6.9 km (within 1%)', () => {
    const andheri = [72.8501, 19.1197];
    const bkc = [72.8656, 19.0596];
    const distM = haversineMetres(andheri, bkc);
    const expected = 6878; // straight-line ~6.87 km
    expect(distM).toBeGreaterThan(expected * 0.99);
    expect(distM).toBeLessThan(expected * 1.01);
  });
});
