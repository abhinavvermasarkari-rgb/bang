import { describe, expect, it } from 'vitest';
import {
  computeCompliancePlan,
  computeDepositPlan,
  computeDerivedNumbers,
  computeRiskLimits,
  defaultInputs
} from './calculations';

const inputs = { ...defaultInputs };

describe('calculations', () => {
  it('computes derived numbers correctly', () => {
    const derived = computeDerivedNumbers(inputs);
    expect(derived.dailyDdAmount).toBe(1000);
    expect(derived.maxDdAmount).toBe(2500);
    expect(derived.phase1TargetAmount).toBe(2000);
    expect(derived.phase2TargetAmount).toBe(1500);
    expect(derived.minDailyProfitAmount).toBe(125);
  });

  it('computes risk limits', () => {
    const derived = computeDerivedNumbers(inputs);
    const risk = computeRiskLimits(inputs, derived);
    expect(risk.maxLossesDailyProp).toBe(6);
    expect(risk.maxLossesDailyTotal).toBe(5);
    expect(risk.maxConsecutiveLosses).toBe(13);
  });

  it('builds compliance plan with daily target above minimum', () => {
    const derived = computeDerivedNumbers(inputs);
    const plan = computeCompliancePlan(inputs, derived);
    expect(plan).toHaveLength(4);
    expect(plan[0].dailyTarget).toBeGreaterThanOrEqual(derived.minDailyProfitAmount);
  });

  it('computes deposit plan ranges', () => {
    const deposit = computeDepositPlan(inputs);
    expect(deposit.baseBuffer).toBe(360);
    expect(deposit.minimum).toBeCloseTo(568);
    expect(deposit.conservative).toBeCloseTo(640);
  });
});
