/** Validate before opening any connection or truncating application tables. */
export function validateTestDatabase(environment: NodeJS.ProcessEnv): string {
  const value = environment.DATABASE_URL_TEST;
  if (!value || environment.ALLOW_TEST_DATABASE_RESET !== 'true') {
    throw new Error('Tests require DATABASE_URL_TEST and ALLOW_TEST_DATABASE_RESET=true for a disposable database.');
  }
  const test = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(test.protocol) || !/^\/[a-zA-Z0-9_]+_test$/.test(test.pathname)) {
    throw new Error('DATABASE_URL_TEST must name a disposable PostgreSQL database ending in _test.');
  }
  if (environment.DATABASE_URL) {
    const application = new URL(environment.DATABASE_URL);
    if (application.hostname === test.hostname && (application.port || '5432') === (test.port || '5432') &&
        decodeURIComponent(application.pathname) === decodeURIComponent(test.pathname)) {
      throw new Error('DATABASE_URL_TEST must not point at DATABASE_URL.');
    }
  }
  return value;
}
