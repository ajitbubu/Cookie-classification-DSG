import { describe, it, expect } from 'vitest';
import { responseErrorMessage } from './apiError';

const res = (status, statusText, body) => ({
  status,
  statusText,
  json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
});

describe('responseErrorMessage', () => {
  it("shows the API's detail message", async () => {
    const r = res(503, 'Service Unavailable', { detail: "Scanning is unavailable: the scan egress proxy can't be reached." });
    expect(await responseErrorMessage(r, 'Backend error: ')).toBe("Scanning is unavailable: the scan egress proxy can't be reached.");
  });

  it('falls back to the status when the body has no usable detail', async () => {
    expect(await responseErrorMessage(res(502, 'Bad Gateway', '<html>nginx</html>'), 'Backend error: ')).toBe('Backend error: 502 Bad Gateway');
    expect(await responseErrorMessage(res(422, 'Unprocessable Entity', { detail: [{ msg: 'bad url' }] }), 'HTTP ')).toBe('HTTP 422 Unprocessable Entity');
    expect(await responseErrorMessage(res(500, '', {}), 'HTTP ')).toBe('HTTP 500');
  });
});
