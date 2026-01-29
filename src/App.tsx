import { useMemo, useRef, useState } from 'react';
import {
  buildWarnings,
  computeCompliancePlan,
  computeDepositPlan,
  computeDerivedNumbers,
  computeOutcomeTree,
  computePhasePlan,
  computeRiskLimits,
  currencyFormatter,
  defaultInputs,
  numberFormatter,
  runMonteCarlo
} from './lib/calculations';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import jsPDF from 'jspdf';

const rrOptions = [1, 1.5, 2, 3];
const rrBrokerOptions = [1, 1.3, 1.5, 2];
const instruments = ['XAUUSD', 'EURUSD', 'NAS100', 'GBPJPY', 'Other'];

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'compliance', label: '4-Day Plan' },
  { id: 'phase', label: 'Phase Plan' },
  { id: 'deposit', label: 'Broker Deposit' },
  { id: 'outcomes', label: 'Outcome Tree' },
  { id: 'montecarlo', label: 'Monte Carlo' }
];

const formatCurrency = (value: number) => currencyFormatter.format(Math.round(value));

const parseInputsFromQuery = () => {
  const params = new URLSearchParams(window.location.search);
  if (params.size === 0) {
    return null;
  }
  const updated = { ...defaultInputs } as Record<string, unknown>;
  Object.keys(updated).forEach((key) => {
    if (params.has(key)) {
      const value = params.get(key);
      if (value === null) return;
      if (value === 'true' || value === 'false') {
        updated[key] = value === 'true';
      } else {
        const numericValue = Number(value);
        updated[key] = Number.isNaN(numericValue) ? value : numericValue;
      }
    }
  });
  return updated as typeof defaultInputs;
};

export default function App() {
  const initial = typeof window !== 'undefined' ? parseInputsFromQuery() : null;
  const [inputs, setInputs] = useState(initial ?? defaultInputs);
  const [page, setPage] = useState<'landing' | 'calculator'>(
    initial ? 'calculator' : 'landing'
  );
  const [activeTab, setActiveTab] = useState('overview');
  const [showExamples, setShowExamples] = useState(true);
  const reportRef = useRef<HTMLDivElement | null>(null);

  const derived = useMemo(() => computeDerivedNumbers(inputs), [inputs]);
  const riskLimits = useMemo(() => computeRiskLimits(inputs, derived), [inputs, derived]);
  const compliancePlan = useMemo(() => computeCompliancePlan(inputs, derived), [inputs, derived]);
  const phase1Plan = useMemo(
    () => computePhasePlan(derived.phase1TargetAmount, compliancePlan[0].dailyTarget),
    [derived, compliancePlan]
  );
  const phase2Plan = useMemo(
    () => computePhasePlan(derived.phase2TargetAmount, compliancePlan[0].dailyTarget),
    [derived, compliancePlan]
  );
  const depositPlan = useMemo(() => computeDepositPlan(inputs), [inputs]);
  const outcomes = useMemo(() => computeOutcomeTree(inputs, derived), [inputs, derived]);
  const monteCarlo = useMemo(() => runMonteCarlo(inputs, derived), [inputs, derived]);
  const warnings = useMemo(() => buildWarnings(inputs, derived, riskLimits), [inputs, derived, riskLimits]);

  const handleChange = (key: keyof typeof defaultInputs, value: number | boolean | string) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const handleDownload = async () => {
    if (!reportRef.current) return;
    const doc = new jsPDF('p', 'pt', 'a4');
    await doc.html(reportRef.current, {
      callback: () => {
        doc.save('prop-hedge-plan.pdf');
      },
      x: 24,
      y: 24,
      width: 555,
      windowWidth: reportRef.current.scrollWidth
    });
  };

  const handleCopyPlan = async () => {
    const summary = `Prop Hedge Planner\nDaily DD: ${formatCurrency(derived.dailyDdAmount)}\nMax DD: ${
      formatCurrency(derived.maxDdAmount)
    }\nPhase 1 Target: ${formatCurrency(derived.phase1TargetAmount)}\nPhase 2 Target: ${
      formatCurrency(derived.phase2TargetAmount)
    }\nDaily Target: ${formatCurrency(compliancePlan[0].dailyTarget)}\nMax losses/day: ${
      riskLimits.maxLossesDailyTotal
    }`;
    await navigator.clipboard.writeText(summary);
  };

  const handleShareLink = async () => {
    const params = new URLSearchParams();
    Object.entries(inputs).forEach(([key, value]) => {
      params.set(key, String(value));
    });
    const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    await navigator.clipboard.writeText(shareUrl);
    window.history.replaceState({}, '', shareUrl);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">Prop Hedge Planner</p>
            <h1 className="text-lg font-semibold">Structured hedging + risk management</h1>
          </div>
          <button
            className="rounded-full border border-emerald-400/50 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
            onClick={() => setPage('calculator')}
          >
            Start Calculator
          </button>
        </div>
      </header>

      {page === 'landing' ? (
        <main className="mx-auto max-w-6xl px-6 py-12">
          <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Prop challenge planning</p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">
                Plan your prop challenge with structured risk + hedge sizing
              </h2>
              <p className="mt-4 text-lg text-slate-300">
                Prop Hedge Planner maps your prop firm rules, hedging model, and risk assumptions into an
                actionable daily plan. Stay inside daily drawdown while progressing through Phase 1 and
                Phase 2.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-300"
                  onClick={() => setPage('calculator')}
                >
                  Start Calculator
                </button>
                <button className="rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200">
                  View Example Plan
                </button>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-800/70 bg-slate-900/60 p-6 shadow-xl">
              <h3 className="text-lg font-semibold">Quick Highlights</h3>
              <ul className="mt-4 space-y-4 text-sm text-slate-300">
                <li>
                  <strong className="text-slate-100">Risk Limits:</strong> Daily + max drawdown guardrails.
                </li>
                <li>
                  <strong className="text-slate-100">Daily Targets:</strong> Minimum profit plans per trading
                  day.
                </li>
                <li>
                  <strong className="text-slate-100">Broker Deposit:</strong> Cushion for hedge risk + losing
                  streaks.
                </li>
              </ul>
            </div>
          </section>

          <section className="mt-12 grid gap-6 md:grid-cols-3">
            {['Risk Limits', 'Daily Targets', 'Broker Deposit'].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6">
                <h3 className="text-lg font-semibold">{item}</h3>
                <p className="mt-2 text-sm text-slate-300">
                  Detailed safeguards, daily trade limits, and broker sizing to keep risk structured.
                </p>
              </div>
            ))}
          </section>
          <footer className="mt-12 text-xs text-slate-500">
            Disclaimer: Not financial advice. Prop firm rules vary and may restrict hedging. Always verify
            your firm’s requirements.
          </footer>
        </main>
      ) : (
        <main className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[1fr_1.2fr]">
          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 shadow-lg">
              <h2 className="text-lg font-semibold">Prop Firm Settings</h2>
              <div className="mt-4 grid gap-4">
                <label className="text-sm">
                  Account size
                  <input
                    type="number"
                    className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                    value={inputs.accountSize}
                    onChange={(event) => handleChange('accountSize', Number(event.target.value))}
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm">
                    Phase 1 target %
                    <input
                      type="number"
                      className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      value={inputs.phase1Target}
                      onChange={(event) => handleChange('phase1Target', Number(event.target.value))}
                    />
                  </label>
                  <label className="text-sm">
                    Phase 2 target %
                    <input
                      type="number"
                      className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      value={inputs.phase2Target}
                      onChange={(event) => handleChange('phase2Target', Number(event.target.value))}
                    />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm">
                    Daily drawdown %
                    <input
                      type="number"
                      className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      value={inputs.dailyDrawdown}
                      onChange={(event) => handleChange('dailyDrawdown', Number(event.target.value))}
                    />
                  </label>
                  <label className="text-sm">
                    Max drawdown %
                    <input
                      type="number"
                      className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      value={inputs.maxDrawdown}
                      onChange={(event) => handleChange('maxDrawdown', Number(event.target.value))}
                    />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm">
                    Minimum trading days
                    <input
                      type="number"
                      className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      value={inputs.minTradingDays}
                      onChange={(event) => handleChange('minTradingDays', Number(event.target.value))}
                    />
                  </label>
                  <label className="text-sm">
                    Minimum daily profit %
                    <input
                      type="number"
                      className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      value={inputs.minDailyProfit}
                      onChange={(event) => handleChange('minDailyProfit', Number(event.target.value))}
                    />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm">
                    Profit split %
                    <input
                      type="number"
                      className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      value={inputs.profitSplit}
                      onChange={(event) => handleChange('profitSplit', Number(event.target.value))}
                    />
                  </label>
                  <label className="text-sm">
                    Fee paid
                    <input
                      type="number"
                      className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      value={inputs.feePaid}
                      onChange={(event) => handleChange('feePaid', Number(event.target.value))}
                    />
                  </label>
                </div>
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-700"
                    checked={inputs.refundableFee}
                    onChange={(event) => handleChange('refundableFee', event.target.checked)}
                  />
                  Refundable fee
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 shadow-lg">
              <h2 className="text-lg font-semibold">Trading Plan</h2>
              <div className="mt-4 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm">
                    Prop risk per trade ($)
                    <input
                      type="number"
                      className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      value={inputs.propRisk}
                      onChange={(event) => handleChange('propRisk', Number(event.target.value))}
                    />
                  </label>
                  <label className="text-sm">
                    Broker risk per trade ($)
                    <input
                      type="number"
                      className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      value={inputs.brokerRisk}
                      onChange={(event) => handleChange('brokerRisk', Number(event.target.value))}
                    />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm">
                    Expected prop R:R
                    <select
                      className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      value={inputs.rrProp}
                      onChange={(event) => handleChange('rrProp', Number(event.target.value))}
                    >
                      {rrOptions.map((value) => (
                        <option key={value} value={value}>
                          1:{value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    Expected broker R:R
                    <select
                      className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      value={inputs.rrBroker}
                      onChange={(event) => handleChange('rrBroker', Number(event.target.value))}
                    >
                      {rrBrokerOptions.map((value) => (
                        <option key={value} value={value}>
                          1:{value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm">
                    Max trades/day
                    <input
                      type="number"
                      className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      value={inputs.maxTradesPerDay}
                      onChange={(event) => handleChange('maxTradesPerDay', Number(event.target.value))}
                    />
                  </label>
                  <label className="text-sm">
                    Max losing streak assumption
                    <input
                      type="number"
                      className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      value={inputs.maxLosingStreak}
                      onChange={(event) => handleChange('maxLosingStreak', Number(event.target.value))}
                    />
                  </label>
                </div>
                <label className="text-sm">
                  Trading instrument
                  <select
                    className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                    value={inputs.instrument}
                    onChange={(event) => handleChange('instrument', event.target.value)}
                  >
                    {instruments.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 shadow-lg">
              <h2 className="text-lg font-semibold">Hedge Behavior</h2>
              <div className="mt-4 space-y-4 text-sm">
                <label>
                  Hedge ratio ({numberFormatter.format(inputs.hedgeRatio)})
                  <input
                    type="range"
                    min={0.1}
                    max={0.5}
                    step={0.01}
                    className="mt-2 w-full"
                    value={inputs.hedgeRatio}
                    onChange={(event) => handleChange('hedgeRatio', Number(event.target.value))}
                  />
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-700"
                    checked={inputs.brokerIsInsurance}
                    onChange={(event) => handleChange('brokerIsInsurance', event.target.checked)}
                  />
                  Broker is insurance
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-6 text-sm text-amber-100">
              <p className="font-semibold">Disclaimer</p>
              <p className="mt-2 text-amber-200">
                Not financial advice. Prop firm rules vary and some firms do not allow hedging. Verify all
                rules before trading.
              </p>
            </div>
          </section>

          <section className="space-y-6" ref={reportRef}>
            <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Plan Results</h2>
                  <p className="text-sm text-slate-400">
                    Calculations update as you edit inputs. All values shown in USD.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200"
                    onClick={handleCopyPlan}
                  >
                    Copy Plan
                  </button>
                  <button
                    className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200"
                    onClick={handleShareLink}
                  >
                    Share link
                  </button>
                  <button
                    className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950"
                    onClick={handleDownload}
                  >
                    Download PDF
                  </button>
                </div>
              </div>

              {warnings.length > 0 && (
                <div className="mt-4 space-y-2 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-xs text-amber-100">
                  {warnings.map((warning) => (
                    <p key={warning}>⚠️ {warning}</p>
                  ))}
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                      activeTab === tab.id
                        ? 'border-emerald-400 bg-emerald-400 text-slate-950'
                        : 'border-slate-700 text-slate-200 hover:border-slate-500'
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'overview' && (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-800/70 bg-slate-950/70 p-4">
                    <p className="text-xs uppercase text-slate-400">Derived numbers</p>
                    <ul className="mt-3 space-y-2 text-sm">
                      <li>Daily DD: {formatCurrency(derived.dailyDdAmount)}</li>
                      <li>Max DD: {formatCurrency(derived.maxDdAmount)}</li>
                      <li>Phase 1 target: {formatCurrency(derived.phase1TargetAmount)}</li>
                      <li>Phase 2 target: {formatCurrency(derived.phase2TargetAmount)}</li>
                      <li>Minimum daily profit: {formatCurrency(derived.minDailyProfitAmount)}</li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-slate-800/70 bg-slate-950/70 p-4">
                    <p className="text-xs uppercase text-slate-400">Risk limits</p>
                    <ul className="mt-3 space-y-2 text-sm">
                      <li>Max losses/day (prop only): {riskLimits.maxLossesDailyProp}</li>
                      <li>Max losses/day (total): {riskLimits.maxLossesDailyTotal}</li>
                      <li>Max consecutive losses: {riskLimits.maxConsecutiveLosses}</li>
                      <li>Stop after {riskLimits.stopLossesDaily} losses/day</li>
                      <li>Stop if down ~{riskLimits.stopDrawdownPercent}% in a day</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'compliance' && (
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase text-slate-400">
                        <th className="pb-2">Day</th>
                        <th className="pb-2">Daily target</th>
                        <th className="pb-2">Trades</th>
                        <th className="pb-2">Prop TP/SL</th>
                        <th className="pb-2">Broker TP/SL</th>
                        <th className="pb-2">Stop rule</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compliancePlan.map((row) => (
                        <tr key={row.day} className="border-t border-slate-800/70">
                          <td className="py-3">{row.day}</td>
                          <td className="py-3">{formatCurrency(row.dailyTarget)}</td>
                          <td className="py-3">{row.recommendedTrades}</td>
                          <td className="py-3">
                            {formatCurrency(row.propTp)} / {formatCurrency(row.propSl)}
                          </td>
                          <td className="py-3">
                            {formatCurrency(row.brokerTp)} / {formatCurrency(row.brokerSl)}
                          </td>
                          <td className="py-3 text-slate-300">{row.stopRule}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'phase' && (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {[{ label: 'Phase 1', plan: phase1Plan }, { label: 'Phase 2', plan: phase2Plan }].map(
                    ({ label, plan }) => (
                      <div key={label} className="rounded-xl border border-slate-800/70 bg-slate-950/70 p-4">
                        <p className="text-xs uppercase text-slate-400">{label} pass plan</p>
                        <ul className="mt-3 space-y-2 text-sm">
                          <li>Total target: {formatCurrency(plan.totalTarget)}</li>
                          <li>Daily target: {formatCurrency(plan.dailyTarget)}</li>
                          <li>Estimated trading days: {plan.estimatedDays}</li>
                          <li>Trades needed (1/day): {plan.tradesIfOnePerDay}</li>
                          <li>Trades needed (2/day): {plan.tradesIfTwoPerDay}</li>
                        </ul>
                      </div>
                    )
                  )}
                </div>
              )}

              {activeTab === 'deposit' && (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-800/70 bg-slate-950/70 p-4">
                    <p className="text-xs uppercase text-slate-400">Deposit recommendation</p>
                    <ul className="mt-3 space-y-2 text-sm">
                      <li>Minimum: {formatCurrency(depositPlan.minimum)}</li>
                      <li>Recommended: {formatCurrency(depositPlan.recommended)}</li>
                      <li>Conservative: {formatCurrency(depositPlan.conservative)}</li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-slate-800/70 bg-slate-950/70 p-4 text-sm text-slate-300">
                    <p className="text-xs uppercase text-slate-400">How it is built</p>
                    <p className="mt-3">
                      Base buffer = brokerRisk × losing streak × 2. Add a 30-50% safety margin plus $100 for
                      spreads/slippage.
                    </p>
                    <p className="mt-3">Base buffer: {formatCurrency(depositPlan.baseBuffer)}</p>
                  </div>
                </div>
              )}

              {activeTab === 'outcomes' && (
                <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase text-slate-400">Scenario tree</p>
                      <label className="flex items-center gap-2 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-700"
                          checked={showExamples}
                          onChange={(event) => setShowExamples(event.target.checked)}
                        />
                        Show example numbers
                      </label>
                    </div>
                    <svg viewBox="0 0 320 200" className="mt-4 w-full">
                      <line x1="20" y1="100" x2="100" y2="40" stroke="#38bdf8" strokeWidth="2" />
                      <line x1="20" y1="100" x2="100" y2="160" stroke="#38bdf8" strokeWidth="2" />
                      <line x1="100" y1="40" x2="200" y2="20" stroke="#22c55e" strokeWidth="2" />
                      <line x1="100" y1="40" x2="200" y2="80" stroke="#f97316" strokeWidth="2" />
                      <line x1="100" y1="160" x2="200" y2="140" stroke="#f97316" strokeWidth="2" />
                      <line x1="100" y1="160" x2="200" y2="190" stroke="#ef4444" strokeWidth="2" />
                      <circle cx="20" cy="100" r="6" fill="#38bdf8" />
                      <circle cx="100" cy="40" r="6" fill="#22c55e" />
                      <circle cx="100" cy="160" r="6" fill="#f97316" />
                      <circle cx="200" cy="20" r="6" fill="#22c55e" />
                      <circle cx="200" cy="80" r="6" fill="#f97316" />
                      <circle cx="200" cy="140" r="6" fill="#f97316" />
                      <circle cx="200" cy="190" r="6" fill="#ef4444" />
                      <text x="10" y="90" fill="#e2e8f0" fontSize="10">
                        Start
                      </text>
                      <text x="82" y="30" fill="#e2e8f0" fontSize="10">
                        Pass P1
                      </text>
                      <text x="80" y="175" fill="#e2e8f0" fontSize="10">
                        Fail P1
                      </text>
                      <text x="190" y="12" fill="#e2e8f0" fontSize="10">
                        Pass P2
                      </text>
                      <text x="190" y="92" fill="#e2e8f0" fontSize="10">
                        Fail P2
                      </text>
                      <text x="190" y="152" fill="#e2e8f0" fontSize="10">
                        Reset
                      </text>
                      <text x="190" y="195" fill="#e2e8f0" fontSize="10">
                        Loss
                      </text>
                    </svg>
                  </div>
                  <div className="space-y-3">
                    {outcomes.map((outcome) => (
                      <div key={outcome.label} className="rounded-xl border border-slate-800/70 bg-slate-950/70 p-4">
                        <p className="text-sm font-semibold">{outcome.label}</p>
                        <p className="text-xs text-slate-400">{outcome.status}</p>
                        {showExamples && (
                          <div className="mt-2 text-xs text-slate-300">
                            <p>Prop result: {formatCurrency(outcome.propResult)}</p>
                            <p>Broker result: {formatCurrency(outcome.brokerResult)}</p>
                            <p>Cash result: {formatCurrency(outcome.cashResult)}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'montecarlo' && (
                <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
                  <div className="space-y-4 text-sm">
                    <label>
                      Expected prop win-rate (%)
                      <input
                        type="number"
                        className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                        value={inputs.propWinRate}
                        onChange={(event) => handleChange('propWinRate', Number(event.target.value))}
                      />
                    </label>
                    <label>
                      Expected broker win-rate (%)
                      <input
                        type="number"
                        className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                        value={inputs.brokerWinRate}
                        onChange={(event) => handleChange('brokerWinRate', Number(event.target.value))}
                      />
                    </label>
                    <div className="rounded-xl border border-slate-800/70 bg-slate-950/70 p-4 text-xs text-slate-300">
                      <p className="font-semibold text-slate-200">Monte Carlo (10,000 runs)</p>
                      <p className="mt-2">Probability of passing Phase 1: {(monteCarlo.passPhase1Probability * 100).toFixed(1)}%</p>
                      <p>Probability of passing Phase 2: {(monteCarlo.passPhase2Probability * 100).toFixed(1)}%</p>
                      <p>Probability of 1 payout: {(monteCarlo.payoutProbability * 100).toFixed(1)}%</p>
                      <p className="mt-3 text-[11px] text-slate-400">
                        Estimates only. Monte Carlo outputs are not guarantees.
                      </p>
                    </div>
                  </div>
                  <div className="h-64 rounded-xl border border-slate-800/70 bg-slate-950/70 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monteCarlo.histogram}>
                        <XAxis dataKey="bucket" stroke="#94a3b8" fontSize={10} />
                        <YAxis stroke="#94a3b8" fontSize={10} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            <details className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 text-sm">
              <summary className="cursor-pointer text-sm font-semibold text-emerald-200">
                Explain the formulas
              </summary>
              <div className="mt-4 space-y-3 text-slate-300">
                <p>Daily DD $ = account size × daily drawdown %</p>
                <p>Max DD $ = account size × max drawdown %</p>
                <p>Phase targets = account size × phase target %</p>
                <p>Min daily profit $ = account size × min daily profit %</p>
                <p>Max losses/day (prop) = floor(daily DD $ ÷ prop risk)</p>
                <p>Max losses/day (total) = floor(daily DD $ ÷ (prop risk + broker risk))</p>
                <p>Max consecutive losses = floor(max DD $ ÷ (prop risk + broker risk))</p>
                <p>Deposit buffer = broker risk × losing streak × 2, then add 30-50% + $100 cushion.</p>
              </div>
            </details>
          </section>
        </main>
      )}
    </div>
  );
}
