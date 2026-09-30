import { validateTestDatabase } from '../database/testSafety';

describe('destructive integration test safety gate', () => {
  const safe = { DATABASE_URL_TEST: 'postgresql://postgres:local@localhost/task_tracker_test', ALLOW_TEST_DATABASE_RESET: 'true' };
  it('requires an explicit test URL and reset consent', () => {
    expect(() => validateTestDatabase({ DATABASE_URL: 'postgresql://localhost/production' })).toThrow();
    expect(() => validateTestDatabase({ DATABASE_URL_TEST: safe.DATABASE_URL_TEST })).toThrow();
  });
  it('rejects application names, unsupported protocols, and encoded names', () => {
    for (const url of ['postgresql://localhost/production', 'https://localhost/example_test', 'postgresql://localhost/%70roduction_test']) {
      expect(() => validateTestDatabase({ ...safe, DATABASE_URL_TEST: url })).toThrow();
    }
  });
  it('rejects the application database even with different credentials or default port spelling', () => {
    expect(() => validateTestDatabase({ ...safe, DATABASE_URL: 'postgres://different:secret@localhost:5432/task_tracker_test' })).toThrow();
  });
  it('accepts an explicitly isolated disposable test database', () => {
    expect(validateTestDatabase({ ...safe, DATABASE_URL: 'postgresql://localhost/task_tracker' })).toBe(safe.DATABASE_URL_TEST);
  });
});
