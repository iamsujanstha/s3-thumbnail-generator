# Profile Studio

Production-oriented Next.js profile management app using App Router, TypeScript, Tailwind CSS, MongoDB, direct-to-S3 uploads, and an asynchronous thumbnail Lambda.

---

## Folder Structure

```
Thumbnail-app/
├── lambda/
│   └── thumbnail-generator/         # Standalone AWS Lambda (Node.js + sharp)
│       ├── index.mjs                # Handler — resize raw upload → WebP thumbnail
│       ├── package.json
│       └── SETUP.md                 # Step-by-step AWS setup guide
│
└── src/
    ├── app/                         # Next.js App Router — pages + API routes
    │   ├── api/
    │   │   ├── profiles/
    │   │   │   ├── route.ts         # GET /api/profiles  POST /api/profiles
    │   │   │   └── [id]/route.ts    # GET · PATCH · DELETE /api/profiles/:id
    │   │   ├── s3/presign/route.ts  # POST /api/s3/presign
    │   │   └── img/[...key]/route.ts# GET /api/img/* (S3 image proxy)
    │   ├── profiles/
    │   │   ├── page.tsx             # /profiles — profile directory page
    │   │   └── error.tsx            # Error boundary
    │   ├── layout.tsx               # Root layout (QueryProvider, skip-nav)
    │   ├── page.tsx                 # / — create profile page
    │   └── globals.css
    │
    ├── modules/                     # NestJS-style feature modules (server-only)
    │   ├── profiles/
    │   │   ├── profiles.controller.ts  # Parse request → call service → respond
    │   │   ├── profiles.service.ts     # Business logic + orchestration
    │   │   ├── profiles.repository.ts  # MongoDB queries (all DB access lives here)
    │   │   └── profiles.schema.ts      # Zod validation schemas + inferred types
    │   └── storage/
    │       └── storage.service.ts      # S3 operations (put/get/head/stream)
    │
    ├── components/                  # React UI components (client-side)
    │   ├── profile/
    │   │   ├── ProfileTable.tsx        # Entry point — wires data + context
    │   │   ├── ProfileGridView.tsx     # Table + search + pagination UI
    │   │   ├── ProfileTableRows.tsx    # AvatarCell · ProfileRow · skeleton · empty
    │   │   ├── ProfileTableContext.ts  # Overlay actions context (stable refs)
    │   │   ├── ProfileForm.tsx         # Create profile form shell
    │   │   ├── ImageDropZone.tsx       # Drag-and-drop image picker
    │   │   ├── ProfileDetailSheet.tsx  # Slide-in view panel
    │   │   ├── EditProfileModal.tsx    # Edit text fields modal
    │   │   └── ConfirmDeleteDialog.tsx # Delete confirmation dialog
    │   ├── ui/
    │   │   ├── ProfileImage.tsx        # Generic image (shimmer → fade-in → error)
    │   │   ├── button.tsx
    │   │   ├── badge.tsx
    │   │   ├── card.tsx
    │   │   ├── input.tsx
    │   │   ├── skeleton.tsx
    │   │   └── toast.tsx
    │   └── QueryProvider.tsx          # TanStack Query client provider
    │
    ├── lib/                         # Pure infrastructure utilities (server + client)
    │   ├── env.ts                   # Zod-validated env vars (cached singleton)
    │   ├── mongo.ts                 # MongoDB connection pool singleton
    │   └── utils.ts                 # cn() · sanitizeFilename() · toProxyUrl()
    │
    ├── types/
    │   └── dtos.ts                  # Shared TypeScript types (client + server)
    │
    └── shared/                      # Client-side hooks + re-exports
        ├── useProfileUpload.ts      # 3-step upload flow hook (presign → S3 → save)
        ├── useProfileOverlay.ts     # Modal state + delete mutation hook
        ├── usePersistentPagination.ts # Cursor-based pagination hook
        ├── dtos.ts                  # Re-exports → @/types/dtos (+ Zod schemas)
        ├── utils.ts                 # Re-exports → @/lib/utils
        └── env.ts                   # Re-exports → @/lib/env
```

### Request flow — create profile

```
Browser
  │  POST /api/s3/presign
  ▼
app/api/s3/presign/route.ts        (1 line — delegates)
  ▼
modules/profiles/profiles.controller.ts   presignUpload()
  ▼
modules/profiles/profiles.service.ts      presignUpload()
  ▼
modules/storage/storage.service.ts        createPutUrl()
  ▼
AWS S3 ← browser PUTs image directly (no server in the middle)
  ▼
S3 event → Lambda thumbnail-generator → writes WebP thumbnail
```

### Request flow — list profiles

```
Browser  GET /api/profiles?limit=10
  ▼
app/api/profiles/route.ts          (1 line — delegates)
  ▼
modules/profiles/profiles.controller.ts   listProfiles()
  ▼
modules/profiles/profiles.service.ts      list()
  ▼
modules/profiles/profiles.repository.ts   findMany()   ← MongoDB
  ▼
Service maps records to DTOs with stable proxy image URLs
  ▼
Browser fetches images via /api/img/[...key]
  ▼
app/api/img/[...key]/route.ts → modules/storage/storage.service.ts → S3
```

---

## Architecture Decisions

| Decision | Reason |
|---|---|
| NestJS-style modules in `src/modules/` | Controller → Service → Repository separation without a full framework |
| Route files are 1–3 lines | All logic lives in the module layer; routes are just adapters |
| Image proxy at `/api/img/` | Stable same-origin URLs → browser HTTP cache works; no CORS errors; presigned URLs stay server-side |
| `staleTime: 0` on page 1 | Ensures the list always refetches after creating a profile |
| `memo()` + context for table rows | Overlay state changes (open modal) never cause image re-renders |
| Plain `<img>` replaced with `next/image` | Automatic WebP/AVIF, responsive srcset, blur placeholder |
| `src/lib/` for infrastructure | Shared by both modules and client hooks without circular deps |
| `src/shared/` re-exports `src/lib/` | Backward-compatible path aliases — existing imports unchanged |

---

## Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Update `.env.local` with real values:

```env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/profile-management
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=ap-south-1
S3_BUCKET_NAME=your-profile-image-bucket
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For Vercel, add the same values in **Project Settings → Environment Variables**. Set `NEXT_PUBLIC_APP_URL` to your deployed app URL.

---

## AWS Setup Overview

The application uses this image workflow:

1. Browser asks `/api/s3/presign` for a secure S3 upload URL
2. Browser uploads the original image directly to S3 under `uploads/raw/`
3. App saves only the raw S3 key in MongoDB (never stores URLs)
4. S3 automatically invokes Lambda when a new raw object is created
5. Lambda creates a 150×150 WebP thumbnail under `uploads/thumbnails/`
6. Profile listing returns stable `/api/img/` proxy URLs — browser caches forever

See `lambda/thumbnail-generator/SETUP.md` for the complete step-by-step AWS setup including IAM, CORS, S3 triggers, and Lambda deployment.

---

## S3 CORS

Allow browser `PUT` uploads from your origins:

```json
[
  {
    "AllowedHeaders": ["Content-Type", "x-amz-date", "x-amz-content-sha256"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["http://localhost:3000", "https://your-app.vercel.app"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

**Path in AWS Console:** `S3 → your-bucket → Permissions → Cross-origin resource sharing (CORS)`

---

## IAM Permissions

**App IAM user** (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:HeadObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::your-profile-image-bucket/*"
    }
  ]
}
```

**Lambda execution role:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::your-profile-image-bucket/uploads/raw/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::your-profile-image-bucket/uploads/thumbnails/*"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "*"
    }
  ]
}
```

---

## Lambda Deployment

The thumbnail generator lives in `lambda/thumbnail-generator/`. It must be compiled for `linux-x64` regardless of your dev machine OS:

```bash
cd lambda/thumbnail-generator
npm install --os=linux --cpu=x64 --libc=glibc sharp
npm install
zip -r ../thumbnail-generator.zip index.mjs node_modules package.json
```

**Recommended Lambda settings:**

| Setting | Value |
|---|---|
| Runtime | Node.js 22.x |
| Handler | `index.handler` |
| Architecture | `x86_64` |
| Memory | 512 MB |
| Timeout | 30 sec |

Deploy via CLI:

```bash
aws lambda update-function-code \
  --function-name thumbnail-generator \
  --zip-file fileb://../thumbnail-generator.zip \
  --region ap-south-1
```

**S3 trigger:** prefix `uploads/raw/`, event type `s3:ObjectCreated:Put`.

---

## MongoDB

The app writes to a `profiles` collection. No manual setup needed — indexes are created on first use.

Stored document shape:

```ts
{
  fullName:  string
  jobTitle:  string
  company:   string
  imageKey:  string   // e.g. "uploads/raw/{uuid}-avatar.png"
  createdAt: Date
  updatedAt: Date
}
```

---

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

---

## Useful Commands

```bash
npm run typecheck   # TypeScript check
npm run lint        # ESLint
npm run build       # Production build
```

---

## Deploy to Vercel

1. Push the repository to GitHub
2. Import the project in Vercel
3. Add all environment variables from `.env.example`
4. Set `NEXT_PUBLIC_APP_URL` to the production Vercel URL
5. Deploy
6. Update S3 CORS `AllowedOrigins` to include the production URL
