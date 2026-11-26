import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModelPerformancePage from './ModelPerformancePage';

const perClass = (f1, support) => ({
  Analytics_Performance: { precision: f1, recall: f1, 'f1-score': f1, support },
  Functional: { precision: f1, recall: f1, 'f1-score': f1, support },
});

// Shape of /api/v1/ml/model-info for a v7.1-style report: three held-out tests.
const info = {
  model_version: '7.1.0',
  model_type: 'xgboost_native',
  feature_count: 61,
  categories: ['Analytics_Performance', 'Functional'],
  acceptance: { internal_gates: { macro_f1: false }, auto_classification_enabled: false },
  // Newer reports also explain each gate (acceptance.gates).
  gates: {
    macro_f1: { group: 'quality', test: 'unseen', measured: 0.438, required: 0.75, status: 'fail' },
    auto_precision: { group: 'quality', test: 'unseen', measured: 0.68, required: 0.95, status: 'not_enough_data',
      detail: { accuracy: 1, predictions: 8, minimum_predictions: 100, sites: 8, minimum_sites: 20 } },
    auto_precision_all_cookies: { group: 'quality', test: 'all', measured: 0.9, required: 0.95, status: 'fail',
      detail: { accuracy: 0.943, predictions: 887, minimum_predictions: 100, sites: 99, minimum_sites: 20 } },
    external_holdout: { group: 'quality', test: 'external', measured: null, required: 0.75, status: 'not_run' },
    site_holdout_is_disjoint: { group: 'setup', test: 'split', measured: 0, required: 0, status: 'pass' },
  },
  samples: { training: 1000, calibration: 200, test: 50 },
  metrics: {
    internal_site_holdout: { accuracy: 0.539, macro_f1: 0.438, per_class: perClass(0.4, 25) },
    internal_site_holdout_all_cookies: {
      accuracy: 0.83, macro_f1: 0.728, per_class: perClass(0.75, 300),
      consensus: { accuracy: 0.946, macro_f1: 0.904, per_class: perClass(0.9, 290) },
    },
  },
};

const renderPage = (data = info) => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => data });
  return render(<ModelPerformancePage onNavigate={vi.fn()} />);
};

describe('ModelPerformancePage test sets', () => {
  afterEach(() => vi.restoreAllMocks());

  it('names the test behind every accuracy figure', async () => {
    renderPage();
    expect(await screen.findByText('Accuracy · All cookies')).toBeInTheDocument();
    const tile = (label) => screen.getByText(label).closest('.mp-stat');
    expect(within(tile('Accuracy · All cookies')).getByText('83.0%')).toBeInTheDocument();
    expect(within(tile('Accuracy · All cookies')).getByText('600 test cookies · Macro F1 72.8%')).toBeInTheDocument();
    expect(within(tile("Accuracy · Other websites' labels accepted")).getByText('94.6%')).toBeInTheDocument();
    expect(within(tile('Accuracy · Never-seen names')).getByText('53.9%')).toBeInTheDocument();
  });

  it('shows all cookies by default and switches the category table by test', async () => {
    renderPage();
    const table = await screen.findByRole('region', { name: 'Performance by category: All cookies' });
    expect(within(table).getAllByText('75.0%').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('tab', { name: 'Never-seen names' }));
    const unseen = screen.getByRole('region', { name: 'Performance by category: Never-seen names' });
    expect(within(unseen).getAllByText('40.0%').length).toBeGreaterThan(0);
    expect(screen.getByText(/never-seen names come from it/)).toBeInTheDocument();
  });

  it('falls back to the one test an older model recorded', async () => {
    renderPage({ ...info, metrics: { internal_site_holdout: info.metrics.internal_site_holdout } });
    expect(await screen.findByRole('region', { name: 'Performance by category: Never-seen names' })).toBeInTheDocument();
    expect(screen.getAllByText('Not recorded for this model')).toHaveLength(2);
    expect(screen.getAllByRole('tab')).toHaveLength(1);
  });
});

describe('ModelPerformancePage gates', () => {
  afterEach(() => vi.restoreAllMocks());
  const withGates = { ...info, acceptance: { ...info.acceptance, gates: info.gates } };
  const gate = (name) => screen.getByText(name).closest('li');

  it('shows each gate with what it measured and what it needs', async () => {
    renderPage(withGates);
    await screen.findByText('Model quality');
    expect(within(gate('Macro F1 meets the minimum')).getByText('0.438 measured · needs 0.750 or more · 0.312 short · never-seen names')).toBeInTheDocument();
    expect(within(gate('Auto-classification precision meets the target (all cookies on test websites)'))
      .getByText('Lower estimate 90.0% (measured 94.3% on 887 picks, 99 websites) · needs 95.0% · all cookies')).toBeInTheDocument();
  });

  it('says how far a failed score is short and which categories pull it down', async () => {
    const classes = {
      Analytics_Performance: { precision: 0.41, recall: 0.42, 'f1-score': 0.415, support: 66 },
      Functional: { precision: 0.42, recall: 0.11, 'f1-score': 0.179, support: 44 },
      Marketing_Advertising: { precision: 0.47, recall: 0.486, 'f1-score': 0.477, support: 74 },
      Strictly_Necessary: { precision: 0.63, recall: 0.74, 'f1-score': 0.681, support: 150 },
    };
    renderPage({
      ...withGates,
      acceptance: { ...withGates.acceptance, gates: {
        ...info.gates,
        marketing_recall: { group: 'quality', test: 'unseen', measured: 0.486, required: 0.7, status: 'fail' },
      } },
      metrics: { ...info.metrics, internal_site_holdout: {
        accuracy: 0.539, macro_f1: 0.438, per_class: classes,
        // Rows are the true category, columns the pick, in per_class order.
        confusion_matrix: [[28, 4, 11, 23], [8, 5, 10, 21], [17, 0, 36, 21], [16, 3, 20, 111]],
      } },
    });
    await screen.findByText('Model quality');
    const macro = gate('Macro F1 meets the minimum');
    expect(within(macro).getByText('0.438 measured · needs 0.750 or more · 0.312 short · never-seen names')).toBeInTheDocument();
    expect(within(macro).getByText('Weakest categories: Functional 0.179, Analytics 0.415')).toBeInTheDocument();
    const marketing = gate('Marketing recall meets the minimum');
    expect(within(marketing).getByText('48.6% measured · needs 70.0% or more · 21.4 points short · never-seen names')).toBeInTheDocument();
    expect(within(marketing).getByText('Missed marketing cookies were labelled Strictly Necessary (21), Analytics (17)')).toBeInTheDocument();
  });

  it('marks gates that could not be judged as grey, not failed', async () => {
    renderPage(withGates);
    await screen.findByText('Model quality');
    const unjudged = gate('Auto-classification precision meets the target (new cookie names)');
    expect(within(unjudged).getByText('Not enough data')).toBeInTheDocument();
    expect(unjudged).toHaveClass('mp-gate--na');
    expect(within(gate('Independent external test set passes')).getByText('Not run')).toBeInTheDocument();
    expect(within(gate('Macro F1 meets the minimum')).getByText('Not met')).toBeInTheDocument();
  });

  it('shows never-seen scores as reported, not as gates, when the report says so', async () => {
    const reportedGates = {
      ...info.gates,
      macro_f1: { ...info.gates.macro_f1, group: 'reported' },
      marketing_recall: { group: 'reported', test: 'unseen', measured: 0.486, required: 0.7, status: 'fail' },
      auto_precision: { ...info.gates.auto_precision, group: 'reported' },
    };
    renderPage({ ...withGates, acceptance: { ...withGates.acceptance, gates: reportedGates } });
    const reported = await screen.findByRole('region', { name: 'Reported, not a gate' });
    expect(within(reported).getByText('Macro F1 on never-seen names')).toBeInTheDocument();
    expect(within(reported).getByText('Marketing recall on never-seen names')).toBeInTheDocument();
    expect(within(reported).getAllByText('Below the bar')).toHaveLength(2);
    const autoUnseen = within(reported).getByText('Auto-classification precision on never-seen names').closest('li');
    expect(within(autoUnseen).getByText('Not enough data')).toBeInTheDocument();
    const quality = screen.getByRole('region', { name: 'Model quality' });
    expect(within(quality).queryByText(/Macro F1/)).not.toBeInTheDocument();
    expect(screen.getByText(/reported for tracking and don't decide promotion/)).toBeInTheDocument();
  });

  it('puts test setup checks in their own group', async () => {
    renderPage(withGates);
    const setup = await screen.findByRole('region', { name: 'Test setup checks' });
    expect(within(setup).getByText('Test websites never seen in training')).toBeInTheDocument();
    expect(within(setup).queryByText('Macro F1 meets the minimum')).not.toBeInTheDocument();
  });
});
