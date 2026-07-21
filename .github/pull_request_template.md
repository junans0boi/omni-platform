## Issue and vertical slice

- Closes:
- Public seam exercised:

## TDD evidence

- Red: failing behavior observed before implementation
- Green: smallest automated test and implementation now pass
- Browser/manual evidence:

## Required checks

- [ ] Behavior changes include tests at a public seam
- [ ] `npm run test:ci` passes
- [ ] No database, credentials, tokens, or generated uploads are committed
- [ ] Supabase migration changes include `tests/supabase/` policy/integration coverage
