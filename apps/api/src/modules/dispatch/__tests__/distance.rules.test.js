import { describe, it, expect } from 'vitest';
import {
  checkPickupRadius,
  checkRelativeDistance,
  evaluateCaptainEligibility,
} from '../distance.rules.js';

// Mumbai test coordinates
const CHURCHGATE = [72.8777, 18.9322];   // pickup
const BANDRA     = [72.8347, 19.0543];   // drop
const DADAR      = [72.8407, 19.0178];   // captain near pickup
const ANDHERI    = [72.8479, 19.1197];   // captain far north — closer to drop than pickup

describe('checkPickupRadius', () => {
  it('passes when captain is within radius', () => {
    const result = checkPickupRadius(DADAR, CHURCHGATE, 10_000);
    expect(result.pass).toBe(true);
    expect(result.distanceMetres).toBeGreaterThan(0);
  });

  it('fails when captain is outside radius', () => {
    const result = checkPickupRadius(ANDHERI, CHURCHGATE, 1_000);
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/exceeds radius/);
  });

  it('distance is symmetric', () => {
    const ab = checkPickupRadius(DADAR, CHURCHGATE, 99_999);
    const ba = checkPickupRadius(CHURCHGATE, DADAR, 99_999);
    expect(Math.abs(ab.distanceMetres - ba.distanceMetres)).toBeLessThan(1);
  });
});

describe('checkRelativeDistance', () => {
  it('passes when captain is closer to pickup than drop (BIKE, rule enabled)', () => {
    // DADAR is ~1.4km from CHURCHGATE pickup, ~2.7km from BANDRA drop
    const result = checkRelativeDistance(DADAR, CHURCHGATE, BANDRA, 'BIKE');
    expect(result.pass).toBe(true);
    expect(result.ruleEnabled).toBe(true);
  });

  it('fails when captain is closer to drop than pickup (BIKE, rule enabled)', () => {
    // ANDHERI is far from CHURCHGATE but close to BANDRA
    const result = checkRelativeDistance(ANDHERI, CHURCHGATE, BANDRA, 'BIKE');
    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/closer to drop/);
  });

  it('always passes for CAB (rule disabled)', () => {
    const result = checkRelativeDistance(ANDHERI, CHURCHGATE, BANDRA, 'CAB');
    expect(result.pass).toBe(true);
    expect(result.ruleEnabled).toBe(false);
  });
});

describe('evaluateCaptainEligibility', () => {
  it('eligible when both rules pass', () => {
    const result = evaluateCaptainEligibility(DADAR, CHURCHGATE, BANDRA, 'BIKE', 10_000);
    expect(result.eligible).toBe(true);
    expect(result.distanceToPickupMetres).toBeGreaterThan(0);
    expect(result.distanceToDropMetres).toBeGreaterThan(0);
  });

  it('ineligible with failedRule A when outside radius', () => {
    const result = evaluateCaptainEligibility(ANDHERI, CHURCHGATE, BANDRA, 'BIKE', 500);
    expect(result.eligible).toBe(false);
    expect(result.failedRule).toBe('A');
  });

  it('ineligible with failedRule B when closer to drop', () => {
    const result = evaluateCaptainEligibility(ANDHERI, CHURCHGATE, BANDRA, 'BIKE', 50_000);
    expect(result.eligible).toBe(false);
    expect(result.failedRule).toBe('B');
  });

  it('eligible for CAB even when closer to drop', () => {
    const result = evaluateCaptainEligibility(ANDHERI, CHURCHGATE, BANDRA, 'CAB', 50_000);
    expect(result.eligible).toBe(true);
  });
});