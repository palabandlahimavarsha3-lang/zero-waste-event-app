# Neon Serverless Postgres Setup Guide

This guide walks you through setting up a **100% free, serverless PostgreSQL database** on [Neon](https://neon.tech) and connecting it to your deployed Render backend for **permanent, persistent storage** that never vanishes upon application restarts or redeploys.

---

## Why Neon Postgres?

* **Free Tier Forever**: Neon offers a generous free tier with 0.5 GB storage, autoscaling compute, and branching.
* **Serverless & Managed**: Automated backups, instant failover, and zero maintenance.
* **Permanent Data Persistence**: Unlike Render's free ephemeral disk where SQLite files are wiped on redeploy, Neon stores your events, predictions, waste audit logs, and feedback permanently.
* **No Credit Card Required**: Sign up in seconds with GitHub or Google.

---

## Step-by-Step Setup

### Step 1: Create a Free Neon Account
1. Open your browser and navigate to: **[https://neon.tech](https://neon.tech)**
2. Click **Sign Up** (top right).
3. Choose **Continue with GitHub** or **Continue with Google** to register immediately without a credit card.

---

### Step 2: Create a New Postgres Project
1. Once logged in, click **Create Project** (or **New Project**).
2. Configure the project parameters:
   * **Project Name**: `zero-waste-db`
   * **Postgres Version**: `16` (or latest available)
   * **Region**: Choose the region closest to your Render server (e.g., `US East (Ohio)` / `aws-us-east-2` or `Europe (Frankfurt)`).
3. Click **Create Project**.

---

### Step 3: Copy Your Database Connection String
1. On your Neon project dashboard, locate the **Connection Details** widget.
2. Select:
   * **Role / User**: `neondb_owner` (default)
   * **Database**: `neondb` (default)
   * **Connection String Format**: Select **`psycopg2`** or **`URI`**.
3. Toggle the password visibility or click **Copy snippet**.
4. The connection URL will look like:
   ```text
   postgresql://username:password@ep-cool-snowflake-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   *(Ensure `?sslmode=require` is present at the end)*.

---

### Step 4: Add `DATABASE_URL` to Render Environment Variables
1. Go to your **[Render Dashboard](https://dashboard.render.com)**.
2. Click on your backend web service: **`zero-waste-event-app`**.
3. In the left navigation menu, click **Environment**.
4. Click **Add Environment Variable**.
5. Set:
   * **Key**: `DATABASE_URL`
   * **Value**: *[Paste your Neon connection string from Step 3]*
6. Click **Save Changes**.
7. Render will automatically initiate a new deployment with the updated environment variables.

---

### Step 5: Automatic Schema Creation & Seeding
* When the Flask backend boots up, `init_db()` executes automatically.
* It detects `DATABASE_URL`, connects to Neon Postgres via `psycopg2`, and creates the required relational tables:
  * `events`
  * `waste_reports`
  * `waste_predictions`
  * `feedback`
  * `campus_practices`
  * `audit_waste`
* Default campus events and seed metrics will be inserted on the initial start.
* Any events created by you in the frontend will now be stored permanently in Neon Postgres!

---

### Step 6: Verify in Neon SQL Console
1. In the Neon Console, click **SQL Editor** on the left menu.
2. Run the following verification query:
   ```sql
   SELECT id, name, category, attendees, event_date FROM events;
   ```
3. Click **Run**. You will see your campus events listed directly in the Postgres table.

---

## Local Development (Optional)

To connect your local development environment to Neon:
1. Create or edit `backend/.env`:
   ```env
   DATABASE_URL=postgresql://username:password@ep-cool-snowflake-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
2. Run your Flask app:
   ```powershell
   cd backend
   .\venv\Scripts\python app.py
   ```
*(If `DATABASE_URL` is omitted, the app automatically falls back to local SQLite at `backend/instance/zerowaste.db`).*
