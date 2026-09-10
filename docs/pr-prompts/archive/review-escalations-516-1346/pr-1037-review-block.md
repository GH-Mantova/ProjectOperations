# PR #1037 — Test fixture failures from constructor signature change

The PR adds `pushExecutor: PushExecutorService` as a required 7th parameter to FormsEngineService, but test files that instantiate it were not updated. Four test suites fail compilation: pre-starts-today.spec.ts, approvals-waiting.spec.ts, forms-engine-gps.spec.ts, and one additional file. These are mechanical test-fixture updates (pass a mock pushExecutor to the constructor). The PR's substance (schema, migration, service logic, integration into submit/approval paths) is sound and should be preserved when re-firing.
