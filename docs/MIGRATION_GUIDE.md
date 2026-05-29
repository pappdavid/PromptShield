# Prisma & Neon Migration Guide

This guide details the database migration workflows across development, CI, and production environments, leveraging Prisma and a serverless Postgres backend (Neon or Supabase).

## Environments & Terminology

- **Development (`db:push` and `db:migrate:dev`)**: Your local environment.
- **CI / Build (`db:generate`)**: Generating the Prisma Client.
- **Production (`db:migrate`)**: Deploying safe migrations.

## Local Development Workflow

When modifying `prisma/schema.prisma` during development:

1. **For prototyping without generating history:**
   Use `npm run db:push` to immediately synchronize your local database schema with the Prisma schema file without generating migration history.
   ```bash
   npm run db:push
   ```

2. **For creating actual migrations (before committing):**
   Once your schema changes are finalized, generate a migration history to be used in production.
   ```bash
   npm run db:migrate:dev --name description_of_change
   ```
   This command creates a new `.sql` file in `prisma/migrations` and applies it to your local database.

3. **Status Check:**
   Check the status of your migrations relative to the database.
   ```bash
   npm run db:migrate:status
   ```

4. **Reset Database (Caution):**
   This command drops the database, creates a new one, applies all migrations, and runs the seed script.
   ```bash
   npm run db:migrate:reset
   ```

## Continuous Integration (CI) Workflow

In CI pipelines, you typically want to generate the Prisma client and sometimes run test migrations on a temporary database.

1. Generate Prisma Client:
   ```bash
   npm run db:generate:ci
   ```

2. Avoid using `db:push` or `db:migrate:dev` in CI unless testing migration scripts on ephemeral databases.

## Production Migration Workflow

In production, never use `db:push` or `db:migrate:dev`. Only apply generated migrations.

1. **Deployment Command:**
   During the release process (e.g., in a Vercel build step or a GitHub Action), apply pending migrations.
   ```bash
   npm run db:migrate
   ```
   *(This runs `prisma migrate deploy` under the hood).*

2. **Safety Measures:**
   - **Do not run destructive migrations without explicit user approval.**
   - Ensure the database user executing the migration has sufficient privileges.

## Reviewing Schema Changes

Whenever `prisma/schema.prisma` is changed:
1. Make the change.
2. Run `npm run db:migrate:dev --name update_name` to create the migration files.
3. Review the generated `.sql` file inside `prisma/migrations/`.
4. Commit both the `schema.prisma` file and the `prisma/migrations/` directory.

## Required Scripts Overview

Located in `package.json`:
- `npm run db:push` - Pushes schema state without history (Dev prototyping).
- `npm run db:migrate:dev` - Creates and applies a migration (Dev finalized change).
- `npm run db:migrate:status` - Checks migration status.
- `npm run db:migrate:reset` - Resets database and applies migrations.
- `npm run db:migrate` - Deploys migrations (Production).
- `npm run db:generate` - Generates Prisma Client.
