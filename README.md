# PM Dashboard

A multi-user web dashboard for managing projects. The home page shows every
project as a pill (name, completion %, start date, ETA); each pill opens a
detail page with a README/instructions doc, a task tracker, and email drafts.
Completion % is computed from the tracker, or pulled live from a linked
Google Sheet if you set one up.

Each signed-in user only sees their own projects (enforced by Postgres Row
Level Security in Supabase, not just app-level filtering).

Stack: Next.js (App Router) + Supabase (Postgres + Auth), deployed on Vercel.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account/project.
2. In the SQL Editor, paste and run the contents of [`supabase/schema.sql`](supabase/schema.sql).
   This creates the `projects`, `tracker_items`, and `email_drafts` tables with
   RLS policies scoping every row to its owning user.
3. By default Supabase requires email confirmation for new sign-ups. For
   quick internal testing you can disable that under
   Authentication -> Providers -> Email -> "Confirm email" (turn off), or just
   confirm the emails Supabase sends.
4. Go to Project Settings -> API and copy the **Project URL** and **anon public
   key**.

## 2. Configure and run locally

```bash
cp .env.local.example .env.local
# paste your Supabase URL + anon key into .env.local
npm install
npm run dev
```

Open http://localhost:3000, sign up, and start creating projects.

## 3. Google Sheet sync (optional)

Each project's detail page can link a Google Sheet and a cell reference (e.g.
`B2`) holding an overall % — hitting "Sync now" pulls that number in and it
takes priority over the tracker-computed %. New projects can also be created
by pasting a sheet URL, which scrapes a project name and task rows from it.

Every user connects **their own** Google account (OAuth) — the app reads
whatever sheets that person already has access to, no per-sheet sharing step
needed. Setup (one-time, per deployment):

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create
   (or pick) a project.
2. APIs & Services -> Library -> search "Google Sheets API" -> Enable.
3. APIs & Services -> OAuth consent screen: set User Type to **Internal** if
   this is a Google Workspace org (skips Google's verification review
   entirely); otherwise **External** + Testing mode, and add your own
   email(s) as test users. Add the `.../auth/spreadsheets.readonly` scope.
4. APIs & Services -> Credentials -> Create Credentials -> OAuth client ID ->
   Application type **Web application**. Under "Authorized redirect URIs" add:
   - `http://localhost:3000/api/google/oauth/callback` (local dev)
   - `https://<your-vercel-domain>/api/google/oauth/callback` (once deployed)
5. Copy the Client ID and Client Secret into `.env.local`:
   ```
   GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_SECRET=...
   ```
6. In the app, click "Connect Google Account" (top right of the dashboard, or
   next to "Google Sheet tracker" on a project page).

Without these two env vars set, "Connect Google Account" will fail with a
clear error; everything else in the app works fine without this step.

## 4. Update from notes (optional)

Each project's detail page has an "Update from notes" box: paste in quick
notes you jotted while working, and it compares them against that project's
current README, its previously-pasted notes (if any), and its open tracker
tasks — then proposes a set of changes (status/owner/deadline updates, new
tasks, a README addition) that you review and select before anything is
applied.

This calls the Claude API server-side (`claude-sonnet-5`). Get a key at
[console.anthropic.com](https://console.anthropic.com) and add it to
`.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
```
Without this env var set, "Analyze updates" will fail with a clear error;
everything else in the app works fine without this step.

## 5. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In [vercel.com](https://vercel.com), "Add New Project" and import that repo.
3. Under the project's Environment Variables, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GOOGLE_OAUTH_CLIENT_ID` (if using Sheet sync)
   - `GOOGLE_OAUTH_CLIENT_SECRET` (if using Sheet sync)
   - `ANTHROPIC_API_KEY` (if using Update from notes)
   (same values as your `.env.local`)
4. Add the deployed callback URL to the OAuth client's Authorized redirect
   URIs in Google Cloud Console (step 4 above), if you haven't already.
5. Deploy. Any teammate can then sign up on the deployed URL, connect their
   own Google account, and manage their own projects — RLS keeps everyone's
   data separate automatically.

## Notes / follow-ups worth considering later

- Sharing a project with another PM (read-only or edit) isn't implemented —
  currently projects are strictly private to their creator. If needed, add a
  `project_members` join table and extend the RLS policies.
- Email drafts are stored as text only; there's no "send email" integration.
- Sheet sync is manual (a "Sync now" button), not on a schedule.
