# NBAshowdown Test Standard

This document is the repository-level testing standard for NBAshowdown.  
It defines **required checks**, **quality gates**, and **release criteria**.

## Scope

Applies to:
- Backend (`backend/`): FastAPI API logic and middleware.
- Frontend (`frontend/`): React + Vite app quality and production build integrity.
- Security checks: sourcemap leakage and hardcoded-secret detection.

## Required checks (every PR)

All of the following must pass before merge:

1. Backend unit tests

```bash
cd backend && pytest -q
```

2. Frontend lint

```bash
cd frontend && npm run lint
```

3. Frontend production build

```bash
cd frontend && npm run build
```

4. Security predeploy checks

```bash
cd frontend && npm run predeploy:security
```

## Minimum acceptance criteria

- Backend tests pass with no collection/import errors.
- Build output contains **no `*.map` source map files**.
- Secret scan reports no hardcoded credentials/tokens in tracked source.
- API security middleware coverage remains green (headers set, identifying headers stripped).

## Release gates (pre-prod)

In addition to PR checks:

1. Run load/performance check for `GET /api/daily-deck` and validate p95/error-rate thresholds.
2. Generate Lighthouse report on the main route and verify no regression against agreed targets.
3. Confirm deployment environment variables are runtime-injected and no secrets are committed.

## Failure policy

- If any required check fails, the change is blocked from promotion.
- Re-run full check set after remediation.

## Related docs

- `QA_PERFORMANCE_PLAN.md` (detailed QA/performance strategy)
- `SECURITY.md` (security baseline and pre-deploy guidance)
