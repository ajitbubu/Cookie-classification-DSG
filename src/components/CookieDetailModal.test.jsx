import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CookieDetailModal from './CookieDetailModal';

const base = { name: '__cf_bm', domain: '.vimeo.com', category: 'Unclassified', mlClassification: 'Strictly Necessary',
  mlConfidence: 0.61, mlConfidenceLevel: 'Medium', httpOnly: true, secure: true, isThirdParty: true };
const open = (cookie) => render(<CookieDetailModal cookie={cookie} onClose={vi.fn()} onOverride={vi.fn()} />);

describe('CookieDetailModal "Why" card', () => {
  it('says where the category came from before any heuristic, and marks HttpOnly as weak', () => {
    open({ ...base, classificationSource: 'known_cookie', knownCookie: { source: 'open_cookie_database', platform: 'Cloudflare' } });
    expect(screen.getByRole('heading', { name: 'Why Strictly Necessary' })).toBeInTheDocument();
    expect(screen.getByText('Listed in the Open Cookie Database (Cloudflare).')).toBeInTheDocument();
    const signal = screen.getByText(/^HttpOnly: page scripts can't read it/).closest('li');
    expect(signal).toHaveTextContent('Weak signal');
    expect(screen.getByText("Only weak signals matched: they don't show what this cookie is for.")).toBeInTheDocument();
    expect(screen.queryByText(/HTTP-only flag indicates server-side security cookie/)).not.toBeInTheDocument();
  });

  it("shows the model's confidence when the model suggested it", () => {
    open({ ...base, classificationSource: 'ml_prediction' });
    expect(screen.getByText('Model suggestion (61% confidence, Medium).')).toBeInTheDocument();
  });
});
