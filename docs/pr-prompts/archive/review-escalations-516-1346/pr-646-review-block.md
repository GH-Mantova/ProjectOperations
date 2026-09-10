PR #646 blocked: test fixture incomplete and PR gates not satisfied.

The migration file itself looks correct per the diff, but the agent opened the PR without the GATE-ALLOW: migrations marker required by the prompt's gate_allow field. Additionally, tendering.service.spec.ts:79 has a test fixture that doesn't supply the now-required siteId field — this breaks the API test suite at compile time. The agent patched 7 test files but missed this one. Re-fire the prompt and confirm both issues are resolved before merge.
