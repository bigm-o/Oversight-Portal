---
name: deploying-apps
description: Provides deployment strategies and instructions for various tech stacks. Use when the user asks how to deploy or what hosting provider to use.
---

# Deploying Applications

## Overview

You act as a DevOps Engineer. Your goal is to guide the user from development to production, ensuring the application is correctly built, secured, and hosted.

## Workflow

1.  **Analyze Tech Stack**
    *   Examine `package.json`, `requirements.txt`, `Gemfile`, or `Cargo.toml`.
    *   Identify the framework (e.g., Next.js, Django, Rust/Axum).
    *   Understand the database requirements (e.g., PostgreSQL, Redis, SQLite).

2.  **Determine Deployment Type**
    *   **Static Site Generation (SSG):** Build static files -> Netlify, Vercel, GitHub Pages.
    *   **Server-Side Rendering (SSR):** Node.js server -> Vercel, Railway, Heroku.
    *   **Containerized App:** Docker -> AWS ECS, Google Cloud Run, Fly.io, Railway.
    *   **Full VM:** DigitalOcean Droplet, AWS EC2, Linode (Use as last resort for modern apps).

3.  **Generate Deployment Guide**
    *   Provide step-by-step instructions tailored to the chosen provider.
    *   Include commands for local build/verification.
    *   Include secrets management steps (e.g., "Add `DATABASE_URL` to Vercel env vars").

4.  **Verify Pre-Deployment Tasks**
    *   **Linting & Testing:** Ensure `npm test` or equivalent passes.
    *   **Build:** Does `npm run build` succeed locally without errors?
    *   **Environment:** Is `.env.example` up to date?

## Example Output

### [Project Name] Deployment Guide (Next.js -> Vercel)

This project uses Next.js, so Vercel is the recommended platform for optimal performance and simplicity.

**1. Prerequisites**
*   Create a Vercel account.
*   Push your latest code to GitHub used by Vercel.

**2. Configure Project**
*   Log in to Vercel Dashboard -> Add New Project.
*   Select your GitHub repository.
*   **Crucial:** Add Environment Variables. Go to Settings -> Environment Variables.
    *   Add `DATABASE_URL` (from your production DB provider, e.g., Neon or Supabase).
    *   Add `NEXT_PUBLIC_API_URL` if separate.

**3. Build Settings**
*   **Framework Preset:** Next.js (Automatic).
*   **Build Command:** `next build` (default).
*   **Output Directory:** `.next` (default).

**4. Deploy**
*   Click "Deploy".
*   Wait for the build logs to finish.
*   Visit the provided URL (e.g., `project-name.vercel.app`).

**5. Post-Deployment Checks**
*   Verify API routes work.
*   Verify database connection (e.g., create a user).
*   Check for console errors in the browser.

## Alternative: Docker (Generic)

If you prefer to use Docker (e.g., for Fly.io or Railway):

1.  Create `Dockerfile`:
    ```dockerfile
    FROM node:18-alpine
    WORKDIR /app
    COPY package*.json ./
    RUN npm ci --only=production
    COPY . .
    RUN npm run build
    CMD ["npm", "start"]
    EXPOSE 3000
    ```
2.  Build: `docker build -t my-app .`
3.  Run: `docker run -p 3000:3000 my-app`

## Next Steps

Once deployed, remind the user to set up monitoring (Sentry, LogRocket) or analytics.
