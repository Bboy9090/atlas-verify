# Railway deployment policy

AtlasVerify uses different Prisma deployment behavior for persistent production and disposable preview databases.

- **Production**: `prisma migrate deploy`
- **Pull-request / non-production environments**: `prisma db push --skip-generate`

Why: the historical production database was bootstrapped before the repository had a complete initial migration. Existing production migrations are authoritative and must remain pinned. Fresh ephemeral PR databases have no baseline tables, so they are initialized from the current Prisma schema instead of replaying incomplete legacy migration history.

This policy must not be used to replace production migrations. New production schema changes still require checked-in Prisma migrations.
