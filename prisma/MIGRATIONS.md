# Local database migrations

Fresh checkout:

```bash
npx prisma migrate deploy
npx prisma generate
```

For a pre-migration `prisma/dev.db` created from `main`, back it up first, then mark
the matching baseline as already applied before deploying the additive migration:

```bash
npx prisma migrate resolve --applied 20260720000000_baseline
npx prisma migrate deploy
npx prisma generate
```
