# PR-667 Review Block — Missing Test Mocks

The PR introduces calls to `prisma.subcontractorSupplier.findMany()` and `prisma.client.findMany()` within `DirectoryService.create()` and `ContactsService.create()` as part of the advisory duplicate-detection flow. However, existing unit tests for these services rely on Prisma mocks that were not updated to handle these new queries. Result: tests fail with "TypeError: rows is not iterable" when the mock returns its default (non-iterable) value.

Re-fire the prompt with instructions to mock these methods in the test setup (e.g., in the `buildPrismaMock()` helper used by `directory.service.spec.ts`) and verify the full test suite passes locally before opening the PR.
