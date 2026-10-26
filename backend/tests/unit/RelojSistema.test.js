import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RelojSistema } from '../../src/shared/infrastructure/time/RelojSistema.js';

test('RelojSistema devuelve la fecha en formato YYYY-MM-DD', () => {
  assert.match(new RelojSistema().hoy(), /^\d{4}-\d{2}-\d{2}$/);
});
