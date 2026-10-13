import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DomainDetailsPage from './DomainDetailsPage';
import { LiveRegionProvider } from './ui/LiveRegion';

const cookies = [
  { name: '_ga', domain: '.google-analytics.com', category: 'Unclassified', isThirdParty: true, requiresConsent: true },
  { name: '_fbp', domain: '.facebook.com', category: 'Marketing', isThirdParty: true, requiresConsent: true },
  { name: 'sid', domain: 'shop.com', category: 'Strictly Necessary' },
];
const scan = {
  domain: 'shop.com', scannedAt: '2026-10-11T10:00:00Z', scanType: 'deep', cookies, totalCount: 3,
  statistics: { byCategory: { Unclassified: 1, Marketing: 1, 'Strictly Necessary': 1 }, thirdParty: 2, requiresConsent: 2 },
  pageResults: [{ url: 'https://shop.com/', cookies }], errorPages: ['https://shop.com/broken'],
};
const versions = [
  { id: 'v2', version: 2, timestamp: '2026-10-11T10:00:00Z', totalCookies: 3, failedPages: 1, diff: { added: 2, removed: 1 } },
  { id: 'v1', version: 1, timestamp: '2026-10-01T10:00:00Z', totalCookies: 2, failedPages: 0, diff: null },
];

const selectionBar = () => document.querySelector('.dd-selection');

const setup = (over = {}) => {
  const props = {
    scan, versions, currentVersionId: 'v2', published: { id: 'v1', publishedAt: '2026-10-02T00:00:00Z' },
    onPublish: vi.fn(), onScanNow: vi.fn(), onExport: vi.fn(), onReview: vi.fn(), onBulkUpdate: vi.fn(),
    tableProps: { scanId: 's1', onCategoryUpdate: vi.fn() }, ...over,
  };
  render(<LiveRegionProvider><DomainDetailsPage {...props} /></LiveRegionProvider>);
  return props;
};

describe('DomainDetailsPage', () => {
  it('shows the identity row: domain, version, scan type, status', () => {
    setup();
    const identity = screen.getByRole('region', { name: 'shop.com' });
    expect(within(identity).getByRole('heading', { name: 'shop.com' })).toBeInTheDocument();
    expect(within(identity).getByText('Version 2')).toBeInTheDocument();
    expect(within(identity).getByText('Scan Type: Deep Scan')).toBeInTheDocument();
    expect(within(identity).getByText('Partial (1 Failed)')).toBeInTheDocument();
  });

  it('has the Figma "Domain Details" title with a back button to Scan Results', async () => {
    const props = setup({ onBack: vi.fn() });
    expect(screen.getByRole('heading', { name: 'Domain Details' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to scan results' }));
    expect(props.onBack).toHaveBeenCalled();
  });

  it('runs Scan Now and Export report', async () => {
    const p = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Scan Now' }));
    await userEvent.click(screen.getByRole('button', { name: 'Export report' }));
    expect(p.onScanNow).toHaveBeenCalled();
    expect(p.onExport).toHaveBeenCalled();
  });

  it('warns that a partial scan is incomplete, with exact counts (9A)', () => {
    setup();
    expect(screen.getByRole('status', { name: 'Partial scan' })).toHaveTextContent('1 of 2 pages failed');
  });

  it('has five tabs with counts and Overview selected', () => {
    setup();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Overview', 'Cookies3', 'Categories3', 'Pages2', 'Vendors3']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('moves between tabs with arrow keys', async () => {
    setup();
    screen.getByRole('tab', { name: 'Overview' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Cookies/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Cookies/ })).toHaveFocus();
  });

  it('overview: Unclassified KPI offers Review, risk rows per regulation', async () => {
    const p = setup();
    const unclassified = screen.getByText('Unclassified').closest('.ui-kpi');
    expect(unclassified).toHaveTextContent('1');
    await userEvent.click(within(unclassified).getByRole('button', { name: 'Review' }));
    expect(p.onReview).toHaveBeenCalled();
    expect(screen.getByText('Time Taken').closest('.ui-kpi')).toHaveTextContent('—');
    const risk = screen.getByRole('region', { name: 'Risk Assessment' });
    for (const reg of ['GDPR', 'CCPA / CPRA', 'DPDP']) expect(within(risk).getByText(reg)).toBeInTheDocument();
  });

  it('version history marks the published version and its change counts', () => {
    setup();
    const table = screen.getByRole('table', { name: 'Version history' });
    const [v2, v1] = within(table).getAllByRole('row').slice(1);
    expect(within(v2).getByText('+1')).toBeInTheDocument(); // 2 added, 1 removed
    expect(within(v1).getByText('(Published)')).toBeInTheDocument();
    expect(screen.getByText('Published Version:').nextSibling).toHaveTextContent('V 1');
  });

  it('publishing a partial version asks to confirm first (9A)', async () => {
    const p = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Actions for version 2' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Publish' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Publish a partial scan?' });
    expect(dialog).toHaveTextContent('1 page failed');
    expect(p.onPublish).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Publish anyway' }));
    expect(p.onPublish).toHaveBeenCalledWith(versions[0]);
  });

  it('publishing a complete version needs no confirmation', async () => {
    const p = setup({ versions: [{ ...versions[0], failedPages: 0 }, versions[1]], published: null, scan: { ...scan, errorPages: [] } });
    await userEvent.click(screen.getByRole('button', { name: 'Actions for version 2' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Publish' }));
    expect(p.onPublish).toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('cookies: select rows → selection bar → drawer → confirm calls bulk update', async () => {
    const p = setup();
    await userEvent.click(screen.getByRole('tab', { name: /Cookies/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select _ga' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select sid' }));
    expect(selectionBar()).toHaveTextContent('2 items selected');
    expect(screen.getAllByRole('status').some((s) => s.textContent.includes('2 items selected'))).toBe(true);

    // Figma 12.12.45 -> 12.13.08 -> 12.12.53: pick a category, Apply, review, confirm.
    await userEvent.selectOptions(screen.getByLabelText('Category for selected cookies'), 'Analytics');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    const drawer = screen.getByRole('dialog', { name: 'Bulk Update Cookie Type' });
    expect(within(drawer).getByText('2 Selected!')).toBeInTheDocument();
    expect(within(drawer).getByLabelText('Category for _ga')).toHaveValue('Analytics');
    await userEvent.selectOptions(within(drawer).getByLabelText('Category for sid'), 'Strictly Necessary');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Confirm' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Bulk Update Cookie Type' });
    expect(p.onBulkUpdate).not.toHaveBeenCalled();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Confirm' }));
    expect(p.onBulkUpdate).toHaveBeenCalledWith({ '_ga|.google-analytics.com': 'Analytics' });
    expect(selectionBar()).toBeNull();
  });

  it('clears the selection from the bar', async () => {
    setup();
    await userEvent.click(screen.getByRole('tab', { name: /Cookies/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all cookies' }));
    expect(selectionBar()).toHaveTextContent('3 items selected');
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(selectionBar()).toBeNull();
  });

  it('categories, pages and vendors tabs list their rows; failed pages are marked', async () => {
    setup();
    await userEvent.click(screen.getByRole('tab', { name: /Categories/ }));
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(3);
    await userEvent.click(screen.getByRole('tab', { name: /Pages/ }));
    expect(screen.getByText('https://shop.com/broken').closest('tr')).toHaveTextContent('Failed');
    await userEvent.click(screen.getByRole('tab', { name: /Vendors/ }));
    expect(screen.getByText('google-analytics.com')).toBeInTheDocument();
  });

  it('pages tab: empty state with Scan Now when the scan stored no pages (6A)', async () => {
    const p = setup({ scan: { ...scan, pageResults: undefined, errorPages: [] } });
    await userEvent.click(screen.getByRole('tab', { name: /Pages/ }));
    expect(screen.getByRole('heading', { name: 'No pages recorded for this scan' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tabpanel').querySelector('.ui-empty__action'));
    expect(p.onScanNow).toHaveBeenCalled();
  });

  it('opens on the routed tab and reports tab changes for the URL (E3)', async () => {
    const onTabChange = vi.fn();
    setup({ initialTab: 'vendors', onTabChange });
    expect(screen.getByRole('tab', { name: /Vendors/ })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: /Cookies/ }));
    expect(onTabChange).toHaveBeenCalledWith('cookies');
  });
});
