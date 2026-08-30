# Gap/readiness bug fix

Frontend branch: `fix/readiness-gap-rendering`

Paired backend branch: `fix/backend-readiness-safeguards` (API 0.2.1)

Baseline: `4e2603812196112cd1807f87388d53e4c5f9709a`

This is a test/review branch, not a deployment. It adds no role search, manual
role catalogue, new product workflow, database changes or new API endpoints.
The existing automatic default and existing recommendation chips are preserved.

## Cause and fix

The backend safeguards can return no eligible recommendations. Previously the
store set `selectedRole` to null, the gap request was skipped, and the page rendered
no assessment or explanation. HTTP 404/409 not-assessed responses were also treated
as generic failures. The request guard prevented retrying a failed role and did
not reliably protect against stale responses or StrictMode effect cleanup.

The existing flow now:

- sends the recommended role ID, canonical skill IDs, evidence metadata and
  reference version to gap computation;
- explains empty recommendations and not-assessed responses without inventing a
  target, score or skill deficit;
- displays genuine numeric zero and validates malformed successful responses;
- aborts obsolete requests and ignores late responses, with a retry for failures;
- uses full backend requirement counts instead of treating three priority gaps
  as the complete missing-skill list;
- invalidates downstream results when CV/break inputs change and migrates old
  cached assessments while preserving CV and break answers;
- does not mislabel a CV-stated occupation with null confidence as an exploratory
  classifier prediction.

The backend follow-up retrieves candidates using the title independently of its
skills list and supports a narrow, labelled Software Engineer title variant.
Six-digit MASCO eligibility gates and the ESCO comparison remain unchanged.
Unmatched profiles can still legitimately have no approved recommendation.

## Validation — 30 August 2026

- 40 frontend unit tests passed.
- Production build and ESLint passed; all changed files passed Prettier.
- 48 focused desktop/mobile Chromium end-to-end tests passed (gap page, new
  regression scenarios and the existing guest intake journey).
- Full desktop Chromium suite: 56 passed, 3 failed. All three failures reproduce
  on untouched baseline `4e26038`: the snapshot tests expect an old section wrapper
  or inline evidence/activity text, while the existing pill UI uses hover titles.
  Those unrelated tests/components were not rewritten in this bug fix.
- Repository-wide Prettier still flags three untouched baseline files:
  `src/components/snapshot/SkillChip.jsx`, `src/config/activityTaxonomy.js` and
  `src/mocks/fixtures/snapshot.high-confidence.json`.
- Paired backend: 104 tests passed, including 23 disposable PostgreSQL/pgvector
  query tests and an automatic title-variant-to-gap integration regression.

Browser tests use synthetic fixtures and mocked API responses. The backend query
tests use disposable in-memory PGlite, not the deployed database. This does not
replace staging validation with the actual models and D13 dataset.

## Reproduce

```sh
npm ci
npm run test:unit
npx eslint .
npm run build
npx playwright install chromium --only-shell
npm run test:e2e -- tests/e2e/e4-gap.spec.js tests/e2e/gap-regressions.spec.js tests/e2e/journey.spec.js --project=chromium --project=mobile-chrome --retries=0
```

For staging review, build this branch against the paired backend using the existing
API routing configuration. Regenerate the snapshot before checking gap/readiness;
old cached snapshots are intentionally invalidated once. No schema migration or
data import is required. Neither repository's main branch is updated. No deployment
command is run; publishing a branch does not verify what Coolify is running, and
any configured automatic deployment still needs to be checked on staging.
