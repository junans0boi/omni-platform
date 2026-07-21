# Local database migrations

Fresh checkout:

```bash
DATABASE_URL=file:./dev.db npx prisma migrate deploy
DATABASE_URL=file:./dev.db npx prisma generate
```

For a pre-migration `prisma/dev.db` created from `main`, back it up first, then mark
the matching baseline as already applied before deploying the additive migration:

```bash
DATABASE_URL=file:./dev.db npx prisma migrate resolve --applied 20260720000000_baseline
DATABASE_URL=file:./dev.db npx prisma migrate deploy
DATABASE_URL=file:./dev.db npx prisma generate
```

`DATABASE_URL` is explicit so automation can select an isolated SQLite file. The application
defaults to `prisma/dev.db` when the variable is absent. Never point reset or test commands at
the preserved development database.
