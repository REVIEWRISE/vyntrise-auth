// The suite truncates every table, so it must never be pointed at a database that matters. It
// runs only against TEST_DATABASE_URL, and only when that database's name says it is a test one.
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Point it at a disposable Postgres database whose name contains "test", e.g.\n' +
        '  docker run -d --name vyntrise-test-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=vyntrise_test -p 55432:5432 postgres:16-alpine\n' +
        '  TEST_DATABASE_URL=postgresql://postgres:password@localhost:55432/vyntrise_test npm test'
    );
  }

  const name = new URL(url).pathname.replace(/^\//, '');
  if (!/test/i.test(name)) {
    throw new Error(`Refusing to run: database "${name}" does not look like a test database (its name must contain "test").`);
  }
  return url;
}
