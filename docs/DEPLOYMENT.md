# Deployment

Target architecture, matching the interview setup guide:

```
 Browser ──► Frontend (static React build)      Netlify  or  AWS S3 + CloudFront / Amplify
               │  VITE_API_URL
               ▼
           Backend API (Node/Express)           Render   or  AWS App Runner / Elastic Beanstalk / EC2
               │  DATABASE_URL (TLS)
               ▼
           PostgreSQL                           Supabase (free plan)
```

---

## 1. Database: Supabase

1. Sign in at supabase.com (GitHub login is quickest) and create a **new project**. Save the database password.
2. In **Project Settings → Database → Connection string**, copy the **Session pooler** URI. It looks like:
   `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`
   The pooler is IPv4-compatible. The direct connection is IPv6-only on the free plan, and Render and many AWS setups cannot reach it.
3. Apply the schema from your machine. Create `backend/.env` (git-ignored) containing `DATABASE_URL=<uri>` and `DATABASE_SSL=true`, then:
   ```bash
   cd backend
   npm run migrate
   ```
   The server also applies the (idempotent) schema on every start, so this step is a convenience.
4. Check **Table Editor**: `accounts`, `transactions` and `transfers` should exist, with RLS enabled.
5. Free projects **pause after 7 days without activity**. Open the project once on the day you need it.

> Supabase MCP (optional): if you connect an AI tool through Supabase's MCP server, scope it to this project only, prefer read-only mode, and review every SQL statement before approving it.

---

## 2a. Backend on Render (free)

1. Push the repo to GitHub.
2. Go to render.com, choose **New → Blueprint**, and select the repo. `render.yaml` creates the `ledger-api` service (root `backend`, `npm ci`, `npm start`, health check `/health`).
3. In the service's **Environment** tab, set:
   - `DATABASE_URL`: the Supabase session-pooler URI
   - `DATABASE_SSL`: `true` (preset)
   - `CORS_ORIGIN`: your frontend URL, e.g. `https://ledger-ui.netlify.app`
4. Wait for the deploy, then open `https://<service>.onrender.com/health`.
5. Free services **sleep after 15 minutes** without traffic, and the first request takes about a minute. Open the URL about 5 minutes before a demo. Never rely on Render's disk; all data lives in Supabase.

## 2b. Backend on AWS (alternative)

Any of these works. The app is a plain Node process that reads `PORT`, `DATABASE_URL`, `DATABASE_SSL` and `CORS_ORIGIN`.

- **AWS App Runner** (simplest): create a service from the GitHub repo, set the source directory to `backend`, runtime Node.js, build `npm ci`, start `npm start`, port `4000`, add the environment variables. Point the health check at `/health`.
- **Elastic Beanstalk**: create a Node.js environment, zip the `backend` folder (without `node_modules`) and upload it, then add the environment variables under *Configuration → Software*.
- **EC2 (free tier t2/t3.micro)**: install Node 20, clone the repo, `cd backend && npm ci`, create `.env`, and run with `pm2 start src/server.js`. Open the port in the security group, or put Nginx in front on port 80/443.

AWS account hygiene, from the setup guide: turn on MFA for the root user, create a **budget alert**, and do daily work as an **IAM user**, not root.

---

## 3a. Frontend on Netlify (free)

1. On netlify.com, choose **Add new site → Import from Git** and pick the repo. `netlify.toml` sets base `frontend`, command `npm run build`, publish `dist`.
2. **Site configuration → Environment variables**: `VITE_API_URL=https://<your-backend-host>` (no trailing slash, no `/api/v1`).
3. Trigger a deploy. Vite bakes `VITE_API_URL` in at build time, so redeploy whenever it changes.
4. Each production deploy uses credits on the free plan, so keep deploys to a minimum.

## 3b. Frontend on AWS (alternative)

- **Amplify Hosting**: connect the repo, app root `frontend`, build `npm run build`, output `dist`, env `VITE_API_URL`.
- **S3 + CloudFront**: `cd frontend && VITE_API_URL=https://api.example.com npm run build`, then `aws s3 sync dist/ s3://<bucket> --delete`, with CloudFront serving the bucket over HTTPS.

---

## Post-deploy checklist

- [ ] `GET <api>/health` returns `{"status":"ok"}`
- [ ] Creating an account in the UI shows up in Supabase → Table Editor → `accounts`
- [ ] A browser console with no CORS errors (`CORS_ORIGIN` matches the frontend origin exactly)
- [ ] The API status in the top bar shows **Connected**
- [ ] Debit larger than the balance opens the **Insufficient balance** pop-up
- [ ] Supabase project opened recently (not paused); Render service warmed up
