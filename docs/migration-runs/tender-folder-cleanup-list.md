# Tender folder cleanup list

## Header

| Field | Value |
|---|---|
| Run timestamp | 2026-08-18T23:12:52.179Z |
| API URL | http://localhost:3000 |
| SharePoint mode | unknown |
| Live folder listing | unavailable (see below) |
| Known stubs (always listed) | T260814-XXXX-Rev1, __connection_probe__ |

### Live listing unavailable

The SharePoint listing endpoint was not reachable at capture time. The table below contains the two hard-coded known stubs. Marco must re-run capture against a live API to get the full listing.

```
fetch failed
```

## Cleanup list

| Folder name | Graph itemId | Reason | Marco action |
|---|---|---|---|
| T260814-XXXX-Rev1 | unknown (API unreachable) | pre-model-era stub | delete via SharePoint UI |
| __connection_probe__ | unknown (API unreachable) | pre-model-era stub (SharePoint connection probe) | delete via SharePoint UI |

---

## Standing rules (do-not-merge)

1. Marco deletes stub folders by hand.
2. Nothing on the live library is deleted by this PR or any automation.
3. The PR stays open until Marco confirms the tenders root holds only real tenders.
