# Student Management System

Full-stack school management app — React + TypeScript on the front, Node/Express +
PostgreSQL behind it, with a Solidity certificate registry added for Problem 3.

This README covers Problems 1–3. The original skill-test brief (including Problems 4
and 5, which weren't attempted) is in git history at commit `c50d743`.

## Setup

Database:

```bash
createdb school_mgmt
psql -d school_mgmt -f seed_db/tables.sql
psql -d school_mgmt -f seed_db/seed-db.sql
```

Backend and frontend, in separate terminals:

```bash
cd backend  && npm install && npm start   # http://localhost:5007
cd frontend && npm install && npm run dev # http://localhost:5173
```

Log in with `admin@school-admin.com` / `3OU4zn3q6Zh9`.

Two notes if something looks off. `backend/.env` points `DATABASE_URL` at the
Postgres role that owns the database — change it if yours differs. And the API runs
on 5007 rather than 5000, because macOS ControlCenter squats on 5000.

## Problem 1 — Notice description not saving

Branch: [`feature/fix-notice-description`](../../compare/main...feature/fix-notice-description)

The Description input was registered as `content` while everything else in the stack
— Zod schema, types, edit page, repository, and the `NOT NULL` database column — used
`description`. The value went into an unknown field and was dropped before the request
was sent. Whitespace-only descriptions also passed validation, so `.trim()` was added.

The same form component is shared with Edit Notice, so that page was broken too and is
fixed by the same change.

To review: go to `/app/notices/add`, create a notice with a description, and open it
from the list. Then edit it and save again. Try submitting only spaces — it should be
rejected.

## Problem 2 — Student CRUD

Branch: [`feature/student-crud`](../../compare/main...feature/student-crud)

All five handlers in `students-controller.js` were empty, so every `/students` route
returned 200 with no body. The service and repository layers were already there, so
this is mostly wiring, plus a `DELETE` endpoint that didn't exist anywhere.

Delete is guarded to students only, so the route can't remove an admin, and it runs in
a transaction — `users` has no `ON DELETE CASCADE`, so dependent rows go first. If the
student is still referenced by something we deliberately keep, like a notice they
authored, it returns 409 and rolls back rather than half-deleting them. Duplicate email
on create now returns 409 with the real reason instead of a generic 500.

To review, from the UI: Students → Add Student, then edit, toggle system access, and
delete. Or directly:

```bash
# log in and keep the cookies
curl -c cookies.txt -X POST http://localhost:5007/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin@school-admin.com","password":"3OU4zn3q6Zh9"}'

curl -b cookies.txt http://localhost:5007/api/v1/students
curl -b cookies.txt -X DELETE http://localhost:5007/api/v1/students/9999  # 404
```

Adding a student needs at least one class and section to exist — `seed_db/` doesn't
create any, and `user_profiles.class_name` is a foreign key.

## Problem 3 — Certificate verification

Branch: [`feature/certificate-verification`](../../compare/main...feature/certificate-verification)

A Solidity registry stores certificate issuance and revocation on-chain; the full
metadata document lives off-chain and only its IPFS CID is committed. Verification
reads straight from the contract, so it doesn't depend on the application database and
doesn't need a wallet.

```bash
cd blockchain && npm install
npm test              # 15 tests
npm run node          # terminal 1 — local chain on 127.0.0.1:8545
npm run deploy:local  # terminal 2
psql -d school_mgmt -f seed_db/certificate-access-controls.sql
```

Deploying writes the address and ABI into the frontend, so there's nothing to copy by
hand. Point MetaMask at `http://127.0.0.1:8545` (chain id `31337`) and import one of
the private keys Hardhat prints — the deploying account is the owner and first issuer.

Then visit `/app/certificates/issue`, connect the wallet, and issue one. The list page
lets you revoke it; `/app/certificates/verify` takes the certificate id and reports
whether it's valid. A revoked certificate still reads back, but reports invalid.

Certificate ids are `keccak256(studentId, course, issuedAt)`, so a verifier can
recompute one from the printed certificate rather than trusting an id they were given.

On IPFS: with no credentials configured, metadata is content-addressed locally and the
CID is still a real CIDv1 matching `ipfs add --cid-version=1 --raw-leaves` — it just
isn't announced to the network. Set `VITE_PINATA_JWT` to pin for real; no code change.

More detail in [`blockchain/README.md`](blockchain/README.md).

## Reviewing the branches

Problem 1 is worth merging first — `npm run build` runs `tsc` before Vite, and until
that fix lands the notice type error fails the build on the other branches.
