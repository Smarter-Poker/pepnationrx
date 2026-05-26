# PepNationRX Deployment Workflow

Authoritative since 2026-05-25. Every Claude session and every Antigravity
agent that touches PepNationRX MUST follow this document when pushing code or
publishing a deploy. If anything here conflicts with an older memory note, a
prior chat, or an assumption, THIS DOCUMENT WINS. When in doubt, verify against
the live systems described below before acting.

---

## 1. The Authoritative Topology

PepNationRX is a SPLIT deployment. There are two hosts, and they are not
interchangeable.

```
  pepnationrx.com  (Namecheap DNS)
        |
        |  A records -> Vercel
        v
  +-------------------------------+
  |  VERCEL  (project: pepnationrx)|   <-- the public FRONTEND
  |  - serves the static frontend  |
  |    from  frontend/  (app.html) |
  |  - vercel.json rewrites        |
  |    /api/*  ->  api.pepnationrx.com
  +-------------------------------+
        |  /api/* proxied to
        v
  +-------------------------------+
  |  HETZNER  5.161.252.33         |   <-- the BACKEND API
  |  - Node/Express on :4000       |
  |  - nginx reverse proxy         |
  |  - systemd service: pepnationrx|
  +-------------------------------+
        |
        v
  Supabase project cupnhfdwveouenutnveg  (the database)
```

- The FRONTEND (`frontend/`, vanilla Web Components, static) is published by
  VERCEL. Vercel auto-deploys on every push to `main` of the GitHub repo
  `Smarter-Software/pepnationrx`. Vercel project id `prj_GbrD7FROlzdrcA7PsSbUPN1say50`,
  team `team_SVD8r7AOPH065G3usBxVvrBc`.
- The BACKEND API (`backend/`, Node/Express, a long-lived server) runs on the
  HETZNER box `5.161.252.33`. It cannot run on Vercel: Vercel is serverless and
  the Express server holds a persistent Postgres pool and runs background jobs.
- The DATABASE is Supabase project `cupnhfdwveouenutnveg`. Migrations are
  applied with the Supabase MCP `apply_migration`, never against any other
  Supabase project.

`vercel.json` in this directory is the contract: it serves the frontend and
rewrites `/api/*` to `https://api.pepnationrx.com`.

---

## 2. What Went Wrong (Root Cause)

Read this so it does not happen again.

1. The intended architecture (Vercel frontend + Hetzner API at the
   `api.pepnationrx.com` subdomain) was set up in `vercel.json` but NEVER
   documented as a single source of truth.
2. A memory note claimed PepNationRX was "nginx/Hetzner, no Vercel deployment,
   the Vercel project can be deleted." That note was WRONG. Every later session
   trusted it.
3. Acting on that wrong note, sessions deployed the frontend by `scp`-ing files
   to `/opt/pepnationrx/frontend` on the Hetzner box and restarting nginx.
   The public domain is served by VERCEL, not Hetzner nginx — so those frontend
   deploys reached a box no public domain points at. Frontend changes through
   multiple build phases never reached real users.
4. The `api.pepnationrx.com` subdomain that `vercel.json` proxies to was never
   created: no DNS record, no Hetzner nginx server block, no TLS certificate.
   So `pepnationrx.com/api/*` returns 502 in production. The public API has
   never worked end to end.
5. Two PepNationRX chats ran at the same time, both editing the same working
   tree with no branch isolation and no commit discipline, so they overwrote
   each other's files.

The single deepest cause: there was no written, verified source of truth for
where the app is hosted and how a change reaches production. This document is
that source of truth.

---

## 3. The api.pepnationrx.com Subdomain — RESOLVED 2026-05-25

This used to be the outstanding production break. It is now wired and the
public `/api/*` path works end to end. Kept here so future sessions see the
shape of the fix when something similar comes up:

- DNS: A record `api.pepnationrx.com` -> `5.161.252.33` (Namecheap, Automatic
  TTL).
- Hetzner: dedicated nginx server file at `/etc/nginx/sites-available/api.pepnationrx.com`
  (symlinked into `sites-enabled`) — `server_name api.pepnationrx.com`, proxies
  all paths to `http://127.0.0.1:4000`.
- TLS: Let's Encrypt certificate issued via
  `certbot --nginx -d api.pepnationrx.com --non-interactive --redirect`,
  renewing automatically. Cert at `/etc/letsencrypt/live/api.pepnationrx.com/`.
- Verification, all 200: `https://api.pepnationrx.com/api/health`,
  `https://pepnationrx.com/api/health` (Vercel rewrite), and
  `https://www.pepnationrx.com/api/health`.

---

## 4. Push Workflow (getting code into GitHub)

GitHub repo: `Smarter-Software/pepnationrx`, branch `main`.

Rules:

- COMMIT ONLY THE FILES YOUR TASK CHANGED. The working tree often carries
  unrelated churn from other chats or the legacy storefront. Never `git add -A`.
  Stage explicit paths only.
- One feature or fix = one focused commit with a clear message.
- Pull/refresh before you start; the local clone is frequently behind the
  GitHub remote because pushes are made through the GitHub connector.
- If you cannot use git directly, push the exact changed files through the
  GitHub MCP (`push_files` for a multi-file commit). Push the real on-disk
  content, never a reconstructed guess.
- After pushing, confirm the commit is on `main` on GitHub.

A push to `main` automatically triggers a Vercel production build. That is the
publish step for the frontend -- see Section 5.

---

## 5. Publish Workflow (getting code to real users)

There are TWO publish targets. Decide which your change touches. Most features
touch both.

### 5a. Frontend changes (anything in `frontend/`)

1. Push the change to `main` on GitHub (Section 4).
2. Vercel auto-builds and deploys the `pepnationrx` project to production.
3. VERIFY ON THE PUBLIC DOMAIN, not on the Hetzner box:
   - `curl -s -o /dev/null -w "%{http_code}" https://pepnationrx.com/` -> 200
   - Load the changed page/component in a browser and confirm the change is
     visible.
4. Do NOT `scp` frontend files to Hetzner. The Hetzner `frontend/` directory is
   not what the public sees. Stop doing this.

### 5b. Backend changes (anything in `backend/`)

1. Push the change to `main` on GitHub (Section 4) so the repo stays the source
   of truth.
2. Deploy to Hetzner over SSH (key `/tmp/pnrx_deploy_key`, `chmod 600` first):
   - copy the changed `backend/` files to `/opt/pepnationrx/backend/`
   - `systemctl restart pepnationrx`
   - `systemctl is-active pepnationrx` -> `active`
3. VERIFY ON THE PUBLIC API once `api.pepnationrx.com` is wired (Section 3):
   - `curl https://pepnationrx.com/api/health` -> `{"status":"ok"}`
   Until then, verify on the box (`curl http://127.0.0.1:4000/api/health`) and
   state plainly that the public path is still blocked.

### 5c. Database changes

- Apply migrations with the Supabase MCP `apply_migration` against project
  `cupnhfdwveouenutnveg` ONLY.
- Migrations are sequential files in `database/migrations/NNNN_name.sql`. Use
  the next number. Keep the committed `.sql` file identical to what was applied.
- Verify with `list_migrations` / a `SELECT` against the new objects.

---

## 6. Concurrency Rule

More than one chat or agent may have PepNationRX open at once. To avoid
clobbering each other:

- Before editing a file, assume another agent may be in it. Re-read the file
  immediately before editing; never edit from stale memory of its contents.
- Keep each session's changes scoped to its own feature. Do not "tidy up"
  files another task owns.
- Push early and often so other sessions can pull your work instead of
  diverging from it.
- If you see uncommitted changes you did not make, leave them alone and commit
  only your own paths.

---

## 7. Pre-Publish Checklist

Do not tell the user something is "live" or "published" until every box is
checked:

- [ ] Code committed and pushed to `main` on GitHub (only the intended files).
- [ ] Backend: deployed to Hetzner, `systemctl is-active pepnationrx` is active.
- [ ] Frontend: Vercel production deploy finished (READY state).
- [ ] Database: migration applied to `cupnhfdwveouenutnveg` and verified.
- [ ] Verified by hitting the PUBLIC domain `https://pepnationrx.com` — not
      localhost, not the Hetzner IP, not a `.vercel.app` preview URL.
- [ ] If the public check fails, say so explicitly and name the blocker.

"It works on the box" is not "it is published." Only the public domain counts.

---

## 8. Quick Reference

| Thing            | Value                                                   |
|------------------|---------------------------------------------------------|
| Public domain    | https://pepnationrx.com (DNS on Namecheap -> Vercel)    |
| Frontend host    | Vercel project `pepnationrx` (`prj_GbrD7FROlzdrcA7PsSbUPN1say50`) |
| Frontend publish | git push to `main` -> Vercel auto-deploy                |
| Backend host     | Hetzner `5.161.252.33`, systemd service `pepnationrx`, Node on :4000 |
| Backend publish  | SSH deploy to `/opt/pepnationrx/backend` + restart      |
| API subdomain    | https://api.pepnationrx.com (live with TLS, proxies to :4000) |
| Database         | Supabase project `cupnhfdwveouenutnveg`                 |
| GitHub repo      | Smarter-Software/pepnationrx, branch `main`                       |
| SSH key          | `/tmp/pnrx_deploy_key` (chmod 600 before use)           |
