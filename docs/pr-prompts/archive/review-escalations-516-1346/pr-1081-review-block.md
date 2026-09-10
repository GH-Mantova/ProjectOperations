**PR #1081 blocked on missing CFX-2 API endpoint.**

CFX-3 (dynamic field rendering) depends on the `/field-definitions?appliesTo=<CLIENT|VENDOR>` REST endpoint, which is shipped by CFX-2 (#1076). CFX-2 has not yet merged to main. The useFieldDefinitions hook will 404 on any attempt to fetch, causing DynamicFieldSection to error and forms to fail.

Tendering-e2e job failed as a result. Do not merge CFX-3 until CFX-2 merges.

Re-fire CFX-3 prompt after CFX-2 reaches main.
