# 🔒 GhostDrop - Secure Ephemeral File Sharing

A lightweight, full-stack, zero-knowledge file sharing web application built with **Next.js (App Router)**, **Tailwind CSS**, and **Supabase** (PostgreSQL + Private Storage).

Files are encrypted with bcrypt passwords, accessible via 6-character secret codes, and automatically deleted from cloud storage after 5 minutes (or custom duration up to 24h).

---

## ✨ Features

- **🚀 Instant Upload Flow**:
  - Drag-and-drop file upload (up to 50MB for free tier).
  - Optional custom 6-character secret code (or auto-generated random code).
  - Required password protection (salted & hashed server-side with bcrypt).
  - Default **5-minute auto-destruction** to keep free cloud storage lean.
  - Interactive confirmation card with 1-click copy for share code and direct download link.
- **🛡️ Secure Access & Download Flow**:
  - Download page at `/download` (or `/download?code=XXXXXX`).
  - Pre-fetch verification showing file metadata and live countdown timer until deletion.
  - Server-side bcrypt password comparison.
  - Direct downloads served through **60-second temporary signed URLs**. Direct public bucket access is blocked.
- **⚡ 3-Tier Automated Deletion**:
  1. **On-Access Purge**: Any query or download request for an expired file immediately purges the file from Supabase Storage and deletes the database record.
  2. **Vercel Cron API (`/api/cron/cleanup`)**: Built-in cron endpoint scheduled in `vercel.json` to purge all expired files every 5 minutes.
  3. **Database Function**: SQL function `delete_expired_file_records()` included in `supabase/schema.sql`.
- **🔐 Brute-Force Rate Limiting**:
  - In-memory rate limiter locks out password attempts after 5 consecutive failures for 10 minutes.

---

## 📁 Project Structure

```
D:\file-share/
├── supabase/
│   └── schema.sql              # Supabase table, RLS policies, and storage configuration
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with navbar and dark theme
│   │   ├── page.tsx            # Home page (Upload flow & confirmation screen)
│   │   ├── download/
│   │   │   └── page.tsx        # Download page with code & password prompt
│   │   ├── api/
│   │   │   ├── upload/         # POST /api/upload (Multipart upload + bcrypt + Supabase)
│   │   │   ├── verify/         # POST /api/verify (Password verification & signed URL)
│   │   │   ├── check-code/     # GET /api/check-code (Code lookup & metadata)
│   │   │   └── cron/cleanup/   # GET/POST /api/cron/cleanup (Automated storage purge)
│   ├── components/
│   │   ├── Navbar.tsx          # Navigation header
│   │   ├── FileUploader.tsx    # Dropzone, password, custom code, expiry selector
│   │   ├── UploadSuccess.tsx   # Confirmation view with copy actions & live countdown
│   │   ├── DownloadCard.tsx    # Code lookup & password-based signed download
│   │   └── ExpiryBadge.tsx     # Dynamic countdown badge with critical warning states
│   └── lib/
│       ├── supabase.ts         # Supabase service role client
│       ├── rate-limit.ts       # In-memory sliding window rate limiter
│       ├── utils.ts            # 6-char code generator, sanitizers, formatters
│       └── types.ts            # TypeScript interfaces
├── vercel.json                 # Scheduled cron configuration for automatic cleanup
├── .env.example                # Environment variables template
└── package.json
```

---

## 🛠️ Step 1: Supabase Setup

### 1. Create a Supabase Project
1. Go to [database.new](https://database.new) and create a free Supabase project.
2. Note your **Project URL** and **API Keys** from **Project Settings > API**.

### 2. Run the SQL Schema
1. In your Supabase Dashboard, go to the **SQL Editor** tab on the left sidebar.
2. Open `supabase/schema.sql` from this repository, copy its contents, and run it.
3. This creates:
   - `public.files` table with unique `share_code` and expiration index.
   - Strict Row Level Security (RLS) policies allowing access only via the Service Role.
   - Private storage bucket `secure-files` (public downloads disabled).
   - `delete_expired_file_records()` cleanup function.

### 3. Retrieve Your API Keys
In **Project Settings > API**:
- Copy **Project URL** (`https://xyzcompany.supabase.co`)
- Copy **anon public** key
- Copy **service_role secret** key (⚠️ Keep this secret! Only used on server-side)

---

## 💻 Step 2: Local Development Setup

### 1. Configure Environment Variables
In `D:\file-share`, copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
CRON_SECRET=my-custom-secret-key-123
```

### 2. Install Dependencies & Run
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

- Go to `/` to upload a file and set a password.
- Copy the 6-character code or link.
- Open `/download` in another tab or incognito window, enter the code, enter the password, and verify the secure download!

---

## 🚀 Step 3: Deploy to Vercel (100% Free)

### 1. Push to GitHub
Initialize and push your repository to GitHub:
```bash
git add .
git commit -m "feat: complete secure file sharing application"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/file-share.git
git push -u origin main
```

### 2. Import into Vercel
1. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
2. Select your `file-share` repository.
3. In **Environment Variables**, add the four variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET`
4. Click **Deploy**.

### 3. Automated Deletion via Vercel Cron
- The repository includes `vercel.json` configured with:
  ```json
  {
    "crons": [
      {
        "path": "/api/cron/cleanup",
        "schedule": "*/5 * * * *"
      }
    ]
  }
  ```
- On Vercel Hobby (Free), crons run automatically once a day, or you can trigger `/api/cron/cleanup?key=YOUR_CRON_SECRET` from a free external pinger like [cron-job.org](https://cron-job.org) every 5 minutes.
- In addition, **On-Access Purge** is active 24/7: whenever any user looks up or attempts to download an expired file, the server instantly purges the file from Supabase Storage and deletes the database record.

---

## 🔒 Security Architecture

| Feature | Implementation |
|---|---|
| **Password Protection** | Salted and hashed with `bcryptjs` (salt rounds: 10). Hashes are stored in Postgres; plaintext passwords are never saved. |
| **Storage Security** | Supabase Storage bucket `secure-files` is **strictly private** (`public = false`). Direct public URLs return 403 Forbidden. |
| **Signed URLs** | Validated downloads receive a temporary signed URL valid for **60 seconds only**. |
| **Brute-Force Protection** | Rate limiter tracks IP and share code. 5 failed password attempts trigger a 10-minute security lockout. |
| **RLS Isolation** | Direct client database queries are blocked by default. All operations run through Next.js server route handlers using `SUPABASE_SERVICE_ROLE_KEY`. |
| **File Sanitization** | Filenames are sanitized to prevent directory traversal attacks and invalid URL characters. |
