import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from './Modal';
import Drawer from './Drawer';

// Plan 4.3 (22A): role=dialog + aria-modal, labelled by its title, focus to the
// first field, Tab trapped, Esc and Cancel close, focus returns to the opener.
function Harness({ Component }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Component
        open={open}
        title="Deep Scan"
        onClose={() => setOpen(false)}
        footer={<><button onClick={() => setOpen(false)}>Cancel</button><button>Start</button></>}
      >
        <label>Website URL <input /></label>
      </Component>
    </>
  );
}

describe.each([['Modal', Modal], ['Drawer', Drawer]])('%s dialog rules (22A)', (_, Component) => {
  it('is a labelled modal dialog with focus on the first field', async () => {
    render(<Harness Component={Component} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog', { name: 'Deep Scan' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('textbox', { name: 'Website URL' })).toHaveFocus();
  });

  it('traps Tab inside the dialog', async () => {
    render(<Harness Component={Component} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog');
    for (let i = 0; i < 6; i += 1) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await userEvent.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes on Esc and returns focus to the opener', async () => {
    render(<Harness Component={Component} />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('closes on Cancel and returns focus to the opener', async () => {
    render(<Harness Component={Component} />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(opener);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('closes from its own close button', async () => {
    const onClose = vi.fn();
    render(<Component open title="Deep Scan" onClose={onClose}><p>x</p></Component>);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Modal confirm variant (UCM .ucm-confirm)', () => {
  it('is a labelled dialog with an icon tile, centred title and equal action buttons', async () => {
    const onClose = vi.fn();
    render(
      <Modal open variant="confirm" tone="success" title="Ready to Publish?" onClose={onClose}
        footer={<><button>Cancel</button><button>Publish</button></>}>
        <p>Version 2 goes live.</p>
      </Modal>
    );
    const dialog = screen.getByRole('alertdialog', { name: 'Ready to Publish?' });
    expect(dialog).toHaveClass('ui-modal--confirm');
    expect(dialog.querySelector('.ui-modal__icon')).toHaveClass('ui-modal__icon--success');
    expect(dialog.querySelector('.ui-modal__footer')).toHaveClass('ui-modal__footer--equal');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
