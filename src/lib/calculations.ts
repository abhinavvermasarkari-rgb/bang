export type RRLabel = '1:1' | '1:1.5' | '1:2' | '1:3' | '1:1.3';

export type PlannerInputs = {
  accountSize: number;
  phase1Target: number;
  phase2Target: number;
  dailyDrawdown: number;
  maxDrawdown: number;
  minTradingDays: number;
  minDailyProfit: number;
  profitSplit: number;
  feePaid: number;
  refundableFee: boolean;
  propRisk: number;
  brokerRisk: number;
  rrProp: number;
  rrBroker: number;
  maxTradesPerDay: number;
  maxLosingStreak: number;
  instrument: string;
  hedgeRatio: number;
  brokerIsInsurance: boolean;
  propWinRate: number;
  brokerWinRate: number;
};

export type DerivedNumbers = {
  dailyDdAmount: number;
  maxDdAmount: number;
  phase1TargetAmount: number;
  phase2TargetAmount: number;
  minDailyProfitAmount: number;
};

export type RiskLimits = {
  maxLossesDailyProp: number;
  maxLossesDailyTotal: number;
  maxConsecutiveLosses: number;
  stopLossesDaily: number;
  stopDrawdownPercent: number;
};

export type ComplianceRow = {
  day: string;
  dailyTarget: number;
  recommendedTrades: number;
  propTp: number;
  propSl: number;
  brokerTp: number;
  brokerSl: number;
  stopRule: string;
};

export type PhasePlan = {
  totalTarget: number;
  dailyTarget: number;
  estimatedDays: number;
  tradesIfOnePerDay: number;
  tradesIfTwoPerDay: number;
};

export type DepositPlan = {
  minimum: number;
  recommended: number;
  conservative: number;
  baseBuffer: number;
};

export type OutcomeLeaf = {
  label: string;
  status: string;
  propResult: number;
  brokerResult: number;
  cashResult: number;
};

export type MonteCarloResult = {
  passPhase1Probability: number;
  passPhase2Probability: number;
  payoutProbability: number;
  histogram: { bucket: string; count: number }[];
};

export const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

export const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2
});

export const defaultInputs: PlannerInputs = {
  accountSize: 25000,
  phase1Target: 8,
  phase2Target: 6,
  dailyDrawdown: 4,
  maxDrawdown: 10,
  minTradingDays: 4,
  minDailyProfit: 0.5,
  profitSplit: 80,
  feePaid: 100,
  refundableFee: true,
  propRisk: 150,
  brokerRisk: 30,
  rrProp: 2,
  rrBroker: 1.3,
  maxTradesPerDay: 2,
  maxLosingStreak: 6,
  instrument: 'XAUUSD',
  hedgeRatio: 0.25,
  brokerIsInsurance: true,
  propWinRate: 55,
  brokerWinRate: 52
};

export const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const computeDerivedNumbers = (inputs: PlannerInputs): DerivedNumbers => {
  const dailyDdAmount = (inputs.accountSize * inputs.dailyDrawdown) / 100;
  const maxDdAmount = (inputs.accountSize * inputs.maxDrawdown) / 100;
  const phase1TargetAmount = (inputs.accountSize * inputs.phase1Target) / 100;
  const phase2TargetAmount = (inputs.accountSize * inputs.phase2Target) / 100;
  const minDailyProfitAmount = (inputs.accountSize * inputs.minDailyProfit) / 100;
  return {
    dailyDdAmount,
    maxDdAmount,
    phase1TargetAmount,
    phase2TargetAmount,
    minDailyProfitAmount
  };
};

export const computeRiskLimits = (inputs: PlannerInputs, derived: DerivedNumbers): RiskLimits => {
  const totalRisk = inputs.propRisk + inputs.brokerRisk;
  const maxLossesDailyProp = Math.floor(derived.dailyDdAmount / inputs.propRisk);
  const maxLossesDailyTotal = Math.floor(derived.dailyDdAmount / totalRisk);
  const maxConsecutiveLosses = Math.floor(derived.maxDdAmount / totalRisk);
  const stopLossesDaily = Math.max(1, Math.min(maxLossesDailyProp, maxLossesDailyTotal));
  return {
    maxLossesDailyProp,
    maxLossesDailyTotal,
    maxConsecutiveLosses,
    stopLossesDaily,
    stopDrawdownPercent: 1.25
  };
};

export const computeCompliancePlan = (
  inputs: PlannerInputs,
  derived: DerivedNumbers
): ComplianceRow[] => {
  const profitPerTrade = inputs.propRisk * inputs.rrProp;
  const dailyTarget = Math.max(
    derived.minDailyProfitAmount,
    derived.phase1TargetAmount / inputs.minTradingDays
  );
  return Array.from({ length: 4 }, (_, index) => {
    const recommendedTrades = dailyTarget <= profitPerTrade ? 1 : 2;
    return {
      day: `Day ${index + 1}`,
      dailyTarget,
      recommendedTrades,
      propTp: profitPerTrade,
      propSl: inputs.propRisk,
      brokerTp: inputs.brokerRisk * inputs.rrBroker,
      brokerSl: inputs.brokerRisk,
      stopRule: 'Stop trading after target hit or after 2 losses.'
    };
  });
};

export const computePhasePlan = (
  totalTarget: number,
  dailyTarget: number
): PhasePlan => {
  const estimatedDays = Math.ceil(totalTarget / dailyTarget);
  return {
    totalTarget,
    dailyTarget,
    estimatedDays,
    tradesIfOnePerDay: estimatedDays,
    tradesIfTwoPerDay: estimatedDays * 2
  };
};

export const computeDepositPlan = (inputs: PlannerInputs): DepositPlan => {
  const baseBuffer = inputs.brokerRisk * inputs.maxLosingStreak * 2;
  const minimum = baseBuffer * 1.3 + 100;
  const recommended = baseBuffer * 1.4 + 100;
  const conservative = baseBuffer * 1.5 + 100;
  return { baseBuffer, minimum, recommended, conservative };
};

export const computeOutcomeTree = (inputs: PlannerInputs, derived: DerivedNumbers): OutcomeLeaf[] => {
  const phase1Profit = derived.phase1TargetAmount;
  const phase2Profit = derived.phase2TargetAmount;
  const propWin = inputs.propRisk * inputs.rrProp;
  const brokerWin = inputs.brokerRisk * inputs.rrBroker;
  const brokerLoss = -inputs.brokerRisk;
  return [
    {
      label: 'Pass P1 → Pass P2',
      status: 'Funded + payout',
      propResult: phase1Profit + phase2Profit,
      brokerResult: brokerWin * 2,
      cashResult: phase1Profit + phase2Profit + brokerWin * 2
    },
    {
      label: 'Pass P1 → Fail P2',
      status: 'Reset after P2',
      propResult: phase1Profit - inputs.feePaid,
      brokerResult: brokerWin + brokerLoss,
      cashResult: phase1Profit - inputs.feePaid + brokerWin + brokerLoss
    },
    {
      label: 'Fail P1',
      status: 'Reset after P1',
      propResult: -inputs.feePaid,
      brokerResult: brokerLoss * 2,
      cashResult: -inputs.feePaid + brokerLoss * 2
    },
    {
      label: 'Break-even cycle',
      status: 'Refund + flat',
      propResult: inputs.refundableFee ? 0 : -inputs.feePaid,
      brokerResult: brokerWin - brokerWin,
      cashResult: inputs.refundableFee ? 0 : -inputs.feePaid
    },
    {
      label: 'Best-case streak',
      status: 'Fast pass',
      propResult: phase1Profit + phase2Profit,
      brokerResult: brokerWin * 3,
      cashResult: phase1Profit + phase2Profit + brokerWin * 3
    }
  ];
};

const defaultRng = () => Math.random();

export const runMonteCarlo = (
  inputs: PlannerInputs,
  derived: DerivedNumbers,
  runs = 10000,
  rng: () => number = defaultRng
): MonteCarloResult => {
  const dailyTarget = Math.max(
    derived.minDailyProfitAmount,
    derived.phase1TargetAmount / inputs.minTradingDays
  );
  const profitPerTrade = inputs.propRisk * inputs.rrProp;
  const tradesPerDay = Math.min(inputs.maxTradesPerDay, 2);
  let passPhase1 = 0;
  let passPhase2 = 0;
  let payout = 0;
  const buckets = [0, 0, 0, 0];

  for (let i = 0; i < runs; i += 1) {
    const winRate = inputs.propWinRate / 100;
    const brokerWinRate = inputs.brokerWinRate / 100;
    let p1Profit = 0;
    let p1Days = 0;
    let brokerNet = 0;
    while (p1Profit < derived.phase1TargetAmount && p1Days < 60) {
      p1Days += 1;
      let dayProfit = 0;
      for (let t = 0; t < tradesPerDay; t += 1) {
        dayProfit += rng() < winRate ? profitPerTrade : -inputs.propRisk;
        brokerNet += rng() < brokerWinRate ? inputs.brokerRisk * inputs.rrBroker : -inputs.brokerRisk;
      }
      if (dayProfit >= dailyTarget) {
        p1Profit += dayProfit;
      }
    }
    let passedP1 = p1Profit >= derived.phase1TargetAmount && p1Days >= inputs.minTradingDays;
    let passedP2 = false;
    if (passedP1) {
      passPhase1 += 1;
      let p2Profit = 0;
      let p2Days = 0;
      while (p2Profit < derived.phase2TargetAmount && p2Days < 60) {
        p2Days += 1;
        let dayProfit = 0;
        for (let t = 0; t < tradesPerDay; t += 1) {
          dayProfit += rng() < winRate ? profitPerTrade : -inputs.propRisk;
          brokerNet += rng() < brokerWinRate ? inputs.brokerRisk * inputs.rrBroker : -inputs.brokerRisk;
        }
        if (dayProfit >= dailyTarget) {
          p2Profit += dayProfit;
        }
      }
      passedP2 = p2Profit >= derived.phase2TargetAmount && p2Days >= inputs.minTradingDays;
      if (passedP2) {
        passPhase2 += 1;
      }
    }
    if (passedP2 && brokerNet >= 0) {
      payout += 1;
    }
    if (!passedP1) {
      buckets[0] += 1;
    } else if (passedP1 && !passedP2) {
      buckets[1] += 1;
    } else if (passedP2) {
      buckets[2] += 1;
      if (brokerNet >= 0) {
        buckets[3] += 1;
      }
    }
  }

  return {
    passPhase1Probability: passPhase1 / runs,
    passPhase2Probability: passPhase2 / runs,
    payoutProbability: payout / runs,
    histogram: [
      { bucket: 'Fail P1', count: buckets[0] },
      { bucket: 'Pass P1', count: buckets[1] },
      { bucket: 'Pass P2', count: buckets[2] },
      { bucket: 'Payout', count: buckets[3] }
    ]
  };
};

export const buildWarnings = (
  inputs: PlannerInputs,
  derived: DerivedNumbers,
  risk: RiskLimits
): string[] => {
  const warnings: string[] = [];
  if (derived.minDailyProfitAmount > derived.phase1TargetAmount / inputs.minTradingDays) {
    warnings.push(
      'Minimum daily profit exceeds the required average for Phase 1; consider lowering it or increasing trading days.'
    );
  }
  if (risk.maxLossesDailyTotal < 1) {
    warnings.push('Your daily drawdown only allows 0 losses at the current risk per trade.');
  }
  if (inputs.propRisk > derived.dailyDdAmount * 0.5) {
    warnings.push('Prop risk per trade is high relative to daily drawdown.');
  }
  return warnings;
};
