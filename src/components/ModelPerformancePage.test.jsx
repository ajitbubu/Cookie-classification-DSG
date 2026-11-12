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
    expect(screen.getByText(/gates are judged on it/)).toBeInTheDocument();
  });

  it('falls back to the one test an older model recorded', async () => {
    renderPage({ ...info, metrics: { internal_site_holdout: info.metrics.internal_site_holdout } });
    expect(await screen.findByRole('region', { name: 'Performance by category: Never-seen names' })).toBeInTheDocument();
    expect(screen.getAllByText('Not recorded for this model')).toHaveLength(2);
    expect(screen.getAllByRole('tab')).toHaveLength(1);
  });
});
