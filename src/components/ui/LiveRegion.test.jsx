import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiveRegionProvider, useAnnounce } from './LiveRegion';

function Announcer({ text }) {
  const announce = useAnnounce();
  return <button onClick={() => announce(text)}>Go</button>;
}

describe('LiveRegion (plan 4.3: one polite region)', () => {
  it('renders a single polite status region before anything is announced', () => {
    render(<LiveRegionProvider><p>app</p></LiveRegionProvider>);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
  });

  it('announces text through that region', async () => {
    render(<LiveRegionProvider><Announcer text="3 items selected" /></LiveRegionProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(screen.getByRole('status')).toHaveTextContent('3 items selected');
  });

  it('re-announces identical text', async () => {
    render(<LiveRegionProvider><Announcer text="Saved" /></LiveRegionProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    await act(async () => { await userEvent.click(screen.getByRole('button', { name: 'Go' })); });
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });

  it('is a no-op outside a provider', async () => {
    render(<Announcer text="x" />);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
  });
});
