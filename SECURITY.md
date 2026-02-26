# DevSecOps Security Framework

This repository follows a strict DevSecOps baseline for source maps, headers, secrets handling, dependency hygiene, and deployment checks.

## Enforced in this repo

- Production frontend builds do **not** generate source maps.
- Production build fails if any `.map` file is found in `frontend/dist`.
- FastAPI responses include baseline hardening headers.
- `/.well-known/security.txt` is provided for vulnerability disclosure.
- `.env` files are ignored from git.

## Operational checklist (before prod deploy)

- `cd frontend && npm run build`
- `cd frontend && npm run lint`
- `cd backend && pytest -q`
- Verify no secrets committed.
- Verify environment variables are injected by hosting platform runtime.
