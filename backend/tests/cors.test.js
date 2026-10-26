import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { parseCorsOrigin } from '../src/config.js';

const SITE = 'https://ephemeral-scone-c3baf6.netlify.app';

describe('CORS configuration', () => {
  test('normalises values pasted into a dashboard', () => {
    for (const raw of [SITE, `${SITE}/`, ` ${SITE}/ `, `"${SITE}"`, `'${SITE}/'`, SITE.toUpperCase()]) {
      assert.deepEqual(parseCorsOrigin(raw), [SITE], JSON.stringify(raw));
    }
    assert.deepEqual(parseCorsOrigin(`${SITE}/, http://localhost:5173`), [SITE, 'http://localhost:5173']);
  });

  test('empty or "*" allows every origin', () => {
    for (const raw of [undefined, '', '  ', '*', `${SITE}, *`]) {
      assert.equal(parseCorsOrigin(raw), '*', JSON.stringify(raw));
    }
  });

  test('allows the configured site and refuses others', async () => {
    const api = request(createApp({ db: { query: async () => ({ rows: [] }) }, corsOrigin: parseCorsOrigin(`${SITE}/`) }));
    const allowed = await api.get('/health').set('Origin', SITE);
    assert.equal(allowed.headers['access-control-allow-origin'], SITE);
    const other = await api.get('/health').set('Origin', 'https://evil.example.com');
    assert.equal(other.headers['access-control-allow-origin'], undefined);
  });
});
