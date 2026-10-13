import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CookieClassificationTable from './CookieClassificationTable';

/**
 * The table's job is to make the rule engine / ML model relationship legible in
 * Figma's columns: Category is the current category (with the rule engine's
 * answer noted when it differs), ML Classification is the model's suggestion in
 * the publish dropdown, Confidence is the model's level.
 */

const baseCookie = {
  name: '_ga',
  domain: 'example.com',
  requiresConsent: true,
  isThirdParty: false,
  mlConfidence: 0.82,
  mlConfidenceLevel: 'High',
};

const agreeing = {
  ...baseCookie,
  originalCategory: 'Analytics',
  category: 'Analytics',
  mlClassification: 'Analytics',
  classificationSource: 'ml_prediction',
  classificationStatus: 'classified',
};

const disagreeing = {
  ...baseCookie,
  name: '_fbp',
  originalCategory: 'Analytics',
  category: 'Analytics',
  mlClassification: 'Marketing',
  classificationSource: 'ml_prediction',
  classificationStatus: 'classified',
};

const noCall = {
  ...baseCookie,
  name: 'sessionid',
  originalCategory: 'Strictly Necessary',
  category: 'Unclassified',
  mlClassification: 'Strictly Necessary',
  classificationSource: 'rules_fallback',
  classificationStatus: 'abstained',
  abstainReason: 'model_unavailable',
  mlConfidence: 0,
  mlConfidenceLevel: 'Low',
};

function renderTable(cookies, props = {}) {
  return render(
    <CookieClassificationTable
      cookies={cookies}
      scanId="test-scan"
      totalCount={cookies.length}
      onCategoryUpdate={vi.fn()}
      {...props}
    />
  );
}

describe('CookieClassificationTable (Figma 12.12.39 columns)', () => {
  it('has the Figma columns', () => {
    renderTable([agreeing], { onSelectCookie: vi.fn() });
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Cookie Name', 'Domain', 'Category', 'ML Classification', 'Confidence', 'Consent', 'Party Type', 'Action']);
  });

  it('shows the current category, the model suggestion and its confidence', () => {
    renderTable([disagreeing]);
    const row = screen.getByRole('row', { name: /_fbp/ });
    const cells = within(row).getAllByRole('cell');
    expect(within(cells[2]).getByText('Analytics')).toHaveClass('ui-chip--solid');
    expect(within(cells[3]).getByRole('button', { name: /ML suggests: Marketing/ })).toHaveTextContent('Marketing');
    expect(within(cells[4]).getByText('High')).toBeInTheDocument();
    expect(row).toHaveAttribute('data-flagged', 'true');
  });

  it('does not flag a row where the model agrees', () => {
    renderTable([agreeing]);
    expect(screen.getByRole('row', { name: /_ga/ })).toHaveAttribute('data-flagged', 'false');
  });

  it('keeps the rule engine answer visible when it differs from the current category', () => {
    renderTable([noCall]);
    const row = screen.getByRole('row', { name: /sessionid/ });
    const category = within(row).getAllByRole('cell')[2];
    expect(within(category).getByText('Unclassified')).toBeInTheDocument();
    expect(within(category).getByText('Rule engine: Strictly Necessary')).toBeInTheDocument();
  });

  it('states once that the model did not run instead of showing a fake prediction', () => {
    renderTable([noCall]);
    expect(screen.getByText(/ML model did not run/)).toBeInTheDocument();
    expect(screen.getByText('No prediction')).toBeInTheDocument();
    expect(screen.queryByText('Low')).not.toBeInTheDocument();
  });

  it('keeps the per-row reason when only some rows lack a prediction', () => {
    renderTable([agreeing, noCall]);
    expect(screen.queryByText(/ML model did not run/)).not.toBeInTheDocument();
    expect(screen.getByText('ML service unavailable')).toBeInTheDocument();
  });

  it('marks consent and third-party in the Figma red', () => {
    renderTable([{ ...agreeing, isThirdParty: true }]);
    expect(screen.getByText('Required')).toHaveClass('cct-flag');
    expect(screen.getByText('3rd Party')).toHaveClass('cct-flag');
  });

  it('opens the cookie history from the Action column', async () => {
    const onSelectCookie = vi.fn();
    renderTable([agreeing], { onSelectCookie });
    await userEvent.click(screen.getByRole('button', { name: 'History for _ga' }));
    expect(onSelectCookie).toHaveBeenCalledWith(agreeing);
  });

  it('explains an empty scan instead of rendering a bare table', () => {
    renderTable([]);
    expect(screen.getByRole('heading', { name: 'No cookies found' })).toBeInTheDocument();
    expect(screen.getByText(/did not set any cookies/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('says the filters hide everything when the scan did find cookies', () => {
    renderTable([], { totalCount: 4 });
    expect(screen.getByRole('heading', { name: 'No cookies match these filters' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('row selection for bulk update (T9, opt-in)', () => {
  const rows = [
    { name: '_ga', domain: '.a.com', category: 'Unclassified' },
    { name: 'sid', domain: 'a.com', category: 'Functional' },
  ];

  it('has no checkboxes unless selection is enabled', () => {
    render(<CookieClassificationTable cookies={rows} scanId="s" totalCount={2} onCategoryUpdate={vi.fn()} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('selects one row, or all rows, without opening the row', async () => {
    const onToggleSelect = vi.fn();
    const onToggleSelectAll = vi.fn();
    const onSelectCookie = vi.fn();
    render(<CookieClassificationTable cookies={rows} scanId="s" totalCount={2} onCategoryUpdate={vi.fn()}
      onSelectCookie={onSelectCookie} selectedKeys={new Set(['_ga|.a.com'])}
      onToggleSelect={onToggleSelect} onToggleSelectAll={onToggleSelectAll} />);

    const ga = screen.getByRole('checkbox', { name: 'Select _ga' });
    expect(ga).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select sid' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select all cookies' })).toHaveProperty('indeterminate', true);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select sid' }));
    expect(onToggleSelect).toHaveBeenCalledWith(rows[1]);
    expect(onSelectCookie).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all cookies' }));
    expect(onToggleSelectAll).toHaveBeenCalled();
  });
});
