# S3 → Lambda Thumbnail Generator — Complete Setup Guide

> Copy this folder into any project. Edit the CONFIG block in `index.mjs`. Follow every step in order.

---

## How the full flow works

```
Browser
  │
  │  1. POST /api/s3/presign   → your server signs a PUT URL
  │  2. PUT image directly      → S3 bucket (uploads/raw/)
  │
S3 Bucket
  │
  │  3. S3 fires ObjectCreated event  → Lambda trigger
  │
Lambda (thumbnail-generator)
  │
  │  4. Downloads original from S3
  │  5. Resizes to 150×150 WebP via sharp
  │  6. Uploads result back to S3 (uploads/thumbnails/)
  │
Your API
  │  7. Signs GET presigned URLs for both original + thumbnail
  │  8. Returns URLs to the browser → browser renders images
```

---

## Prerequisites

- AWS account with Console access
- AWS CLI installed — `aws --version`
- Node.js 18+ installed locally
- Run `aws configure` before using CLI commands

---

## Step 1 — Create the S3 Bucket

**Path:** `AWS Console → S3 → Create bucket`

### 1.1 Basic settings

| Field | Value |
|---|---|
| Bucket name | `your-app-assets` — must be globally unique |
| AWS Region | `ap-south-1` (or whichever is closest to your users) |

### 1.2 Object Ownership

```
Object Ownership → ACLs disabled (recommended)
```

### 1.3 Public Access

```
Block all public access → ✅ ON  ← keep this ON
```

All image access goes through presigned URLs — you never need the bucket public.

### 1.4 Versioning, Tags, Encryption

```
Bucket Versioning  → Disable
Tags               → optional
Default encryption → SSE-S3 (Amazon S3 managed keys) — default, leave it
```

→ **Create bucket**

---

## Step 2 — Bucket Permissions & Bucket Policy

This is the most common source of errors. Do all three sub-steps.

### 2.1 Bucket Policy (allow your IAM user to sign URLs)

**Path:** `S3 → your-app-assets → Permissions → Bucket policy → Edit`

This policy allows your app's IAM user (the one whose keys are in `.env`) to read, write, and generate presigned URLs.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowAppUserFullObjectAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:user/YOUR_IAM_USER_NAME"
      },
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:HeadObject"
      ],
      "Resource": "arn:aws:s3:::your-app-assets/*"
    },
    {
      "Sid": "AllowAppUserListBucket",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:user/YOUR_IAM_USER_NAME"
      },
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::your-app-assets"
    }
  ]
}
```

> Replace `YOUR_ACCOUNT_ID` (12 digits, find it top-right in AWS Console) and `YOUR_IAM_USER_NAME`.

→ **Save changes**

### 2.2 Block Public Access — confirm correct state

**Path:** `S3 → your-app-assets → Permissions → Block public access`

```
Block all public access                                    → ✅ ON
Block public access to buckets granted through new ACLs    → ✅ ON
Block public access to buckets granted through any ACLs    → ✅ ON
Block public access to buckets via new public bucket policy → ✅ ON
Block public access if bucket has public policy            → ✅ ON
```

All four toggles ON. Save. This is correct — presigned URLs bypass this, public bucket = wrong approach.

### 2.3 ACL

**Path:** `S3 → your-app-assets → Permissions → Access control list (ACL)`

```
Bucket owner → Read + Write
Everyone (public access) → nothing (all unchecked)
```

Leave default. Do not grant public access here.

---

## Step 3 — S3 CORS Configuration (fixes browser upload errors)

**Path:** `S3 → your-app-assets → Permissions → Cross-origin resource sharing (CORS) → Edit`

Paste this exactly:

```json
[
  {
    "AllowedHeaders": [
      "Content-Type",
      "Content-Length",
      "Authorization",
      "x-amz-date",
      "x-amz-content-sha256",
      "x-amz-security-token",
      "x-amz-tagging"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://yourdomain.com"
    ],
    "ExposeHeaders": ["ETag", "x-amz-request-id"],
    "MaxAgeSeconds": 3000
  }
]
```

→ **Save changes**

### What each CORS field does

| Field | Why it's needed |
|---|---|
| `AllowedHeaders: Content-Type` | Browser sets this on the PUT request |
| `AllowedHeaders: x-amz-*` | AWS signature headers on the PUT |
| `AllowedMethods: PUT` | Browser uploads directly to S3 |
| `AllowedMethods: GET, HEAD` | Browser loads images from S3 |
| `AllowedOrigins` | Your app's domain — add every origin that uploads |
| `ExposeHeaders: ETag` | Needed if you verify upload success by ETag |
| `MaxAgeSeconds: 3000` | Browser caches the preflight for 50 min |

### Common CORS errors and exact fixes

**`Access to fetch blocked by CORS policy: No 'Access-Control-Allow-Origin'`**
→ Your origin is not in `AllowedOrigins`. Add it exactly (no trailing slash).

**`403 SignatureDoesNotMatch`**
→ You included extra headers (like `Cache-Control`) in the presigned `PutObjectCommand` on the server. The signature covers only the headers you add to the command — if the browser sends different headers, AWS rejects it.
Fix: only add `ContentType` to `PutObjectCommand`. Nothing else.

**`400 Bad Request` on PUT**
→ The `Content-Type` header from the browser doesn't match what was signed. Pass `file.type` from the browser to the presign API and use the same value in `PutObjectCommand`.

**Preflight OPTIONS succeeds but PUT still fails**
→ Check `AllowedHeaders` — it must include every header the browser sends. Add `x-amz-date`, `x-amz-content-sha256`.

---

## Step 4 — Create IAM User for Your App

**Path:** `IAM → Users → Create user`

This is the user whose access keys go into your `.env.local`.

### 4.1 Create user

| Field | Value |
|---|---|
| User name | `your-app-s3-user` |
| Provide user access to Console | ❌ No (programmatic only) |

→ Next

### 4.2 Set permissions

```
Permissions options → Attach policies directly
```

Search and attach: **`AmazonS3FullAccess`**

> For production, skip this and use an inline policy instead (Step 4.4 below).

→ Next → **Create user**

### 4.3 Create access keys

**Path:** `IAM → Users → your-app-s3-user → Security credentials → Access keys → Create access key`

```
Use case → Application running outside AWS → Next
```

→ **Create access key**

Copy both values immediately — the secret is shown only once:

```
Access key ID:     AKIA...
Secret access key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Put them in `.env.local`:

```env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=xxxxxxxx...
AWS_REGION=ap-south-1
S3_BUCKET_NAME=your-app-assets
```

### 4.4 Scoped inline policy (recommended, replaces AmazonS3FullAccess)

**Path:** `IAM → Users → your-app-s3-user → Permissions → Add permissions → Create inline policy → JSON`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3ObjectAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:HeadObject"
      ],
      "Resource": "arn:aws:s3:::your-app-assets/*"
    },
    {
      "Sid": "S3ListAccess",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::your-app-assets"
    }
  ]
}
```

→ **Policy name:** `your-app-s3-policy` → **Create policy**

---

## Step 5 — Create IAM Role for Lambda

Lambda uses a role (not user keys) to access S3. The role is assumed automatically at runtime.

**Path:** `IAM → Roles → Create role`

### 5.1 Trusted entity

```
Trusted entity type → AWS service
Use case           → Lambda
```

→ Next

### 5.2 Attach permissions

Search and attach both:

| Policy | Purpose |
|---|---|
| `AWSLambdaBasicExecutionRole` | Write logs to CloudWatch |
| `AmazonS3FullAccess` | Read source image + write thumbnail |

> For production, replace `AmazonS3FullAccess` with an inline policy (Step 5.3 below) after creating the role.

### 5.3 Name and create

| Field | Value |
|---|---|
| Role name | `lambda-thumbnail-generator-role` |
| Description | Role for S3 thumbnail generator Lambda |

→ **Create role**

### 5.4 Add scoped inline policy to the role (production)

**Path:** `IAM → Roles → lambda-thumbnail-generator-role → Permissions → Add permissions → Create inline policy → JSON`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadSourceImage",
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-app-assets/uploads/raw/*"
    },
    {
      "Sid": "WriteThumbnail",
      "Effect": "Allow",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::your-app-assets/uploads/thumbnails/*"
    },
    {
      "Sid": "WriteLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

→ **Policy name:** `lambda-thumbnail-s3-policy` → **Create policy**

Then remove `AmazonS3FullAccess` from the role if you added it — keep only the scoped policy + `AWSLambdaBasicExecutionRole`.

**Path to remove:** `IAM → Roles → lambda-thumbnail-generator-role → Permissions → AmazonS3FullAccess → Remove`

---

## Step 6 — Build the Lambda ZIP

Run in `lambda/thumbnail-generator/`:

```bash
# Step 1 — install sharp compiled for Linux x64 (Lambda runtime)
npm install --os=linux --cpu=x64 --libc=glibc sharp

# Step 2 — install all other deps
npm install

# Step 3 — create the deployment ZIP
zip -r ../thumbnail-generator.zip index.mjs node_modules package.json
```

The `.npmrc` file here already pins `os=linux cpu=x64 libc=glibc`, so running plain `npm install` in future will also get the correct binary.

> **macOS users** — never skip the `--os=linux --cpu=x64` flag for sharp. macOS installs the darwin binary which crashes Lambda instantly with:
> `Error: Could not load the "sharp" module using the linux-x64 runtime`

---

## Step 7 — Create the Lambda Function

**Path:** `Lambda → Functions → Create function`

### 7.1 Basic settings

| Field | Value |
|---|---|
| Author from scratch | ✅ |
| Function name | `thumbnail-generator` |
| Runtime | `Node.js 22.x` |
| Architecture | `x86_64` |
| Permissions → Execution role | Use an existing role → `lambda-thumbnail-generator-role` |

→ **Create function**

### 7.2 Upload the ZIP

**Path:** `Lambda → thumbnail-generator → Code → Upload from → .zip file`

Select `thumbnail-generator.zip` → **Save**

### 7.3 Set the handler

**Path:** `Lambda → thumbnail-generator → Code → Runtime settings → Edit`

| Field | Value |
|---|---|
| Handler | `index.handler` |
| Runtime | `Node.js 22.x` |

→ **Save**

### 7.4 Increase memory and timeout

**Path:** `Lambda → thumbnail-generator → Configuration → General configuration → Edit`

| Field | Value | Why |
|---|---|---|
| Memory | `512 MB` | sharp needs memory for image decoding |
| Ephemeral storage | `512 MB` | default is fine |
| Timeout | `30 sec` | large images can take a few seconds |

→ **Save**

### 7.5 Environment variables (optional — Lambda uses role, not keys)

Lambda does NOT need `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY`.
The IAM role handles auth automatically.

If you want to make the bucket name configurable:

**Path:** `Lambda → thumbnail-generator → Configuration → Environment variables → Edit → Add`

| Key | Value |
|---|---|
| `BUCKET_NAME` | `your-app-assets` |

Then reference it in `index.mjs` as `process.env.BUCKET_NAME`.

---

## Step 8 — Add S3 Trigger to Lambda

**Path:** `Lambda → thumbnail-generator → Configuration → Triggers → Add trigger`

| Field | Value |
|---|---|
| Source | `S3` |
| Bucket | `your-app-assets` |
| Event types | `PUT` ← under "Object creation events" |
| Prefix | `uploads/raw/` |
| Suffix | *(leave empty)* |

Tick the recursive invocation acknowledgement → **Add**

### Why prefix matters

```
uploads/raw/       ← trigger fires here
uploads/thumbnails/ ← Lambda writes here

Without prefix → Lambda writes thumbnail → S3 fires trigger again
              → Lambda runs again → infinite loop → AWS bill explodes
With prefix   → trigger only fires on uploads/raw/* → safe
```

---

## Step 9 — Grant S3 Permission to Invoke Lambda

AWS automatically adds this when you add the trigger via the Lambda console, but if it's missing:

**Path:** `Lambda → thumbnail-generator → Configuration → Permissions → Resource-based policy statements`

You should see a statement like:

```json
{
  "Sid": "AllowS3Invoke",
  "Effect": "Allow",
  "Principal": { "Service": "s3.amazonaws.com" },
  "Action": "lambda:InvokeFunction",
  "Condition": {
    "StringEquals": { "AWS:SourceAccount": "YOUR_ACCOUNT_ID" },
    "ArnLike": { "AWS:SourceArn": "arn:aws:s3:::your-app-assets" }
  }
}
```

If it's missing, add it via CLI:

```bash
aws lambda add-permission \
  --function-name thumbnail-generator \
  --statement-id AllowS3Invoke \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::your-app-assets \
  --source-account YOUR_ACCOUNT_ID \
  --region ap-south-1
```

---

## Step 10 — Verify S3 Notification is Configured

**Path:** `S3 → your-app-assets → Properties → Event notifications`

You should see one entry:

| Name | Events | Prefix | Destination |
|---|---|---|---|
| (auto-generated) | s3:ObjectCreated:Put | uploads/raw/ | Lambda: thumbnail-generator |

If it's not there, add it manually:

**Path:** `S3 → your-app-assets → Properties → Event notifications → Create event notification`

| Field | Value |
|---|---|
| Event name | `TriggerThumbnailLambda` |
| Prefix | `uploads/raw/` |
| Event types | ✅ `s3:ObjectCreated:Put` |
| Destination | Lambda function |
| Lambda function | `thumbnail-generator` |

→ **Save changes**

---

## Step 11 — App Environment Variables

Add to `.env.local` in your Next.js project root:

```env
# AWS credentials — IAM user created in Step 4
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=ap-south-1

# S3
S3_BUCKET_NAME=your-app-assets

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
```

---

## Step 12 — Test the Full Flow

### Option A — Test via your app

1. Go to `http://localhost:3000`
2. Upload a profile with an image
3. Wait 2–3 seconds
4. Go to `S3 → your-app-assets → Objects → uploads/thumbnails/` — the `.webp` file should appear
5. Go to the profiles listing — thumbnail shows in the table avatar

### Option B — Manual Lambda test

**Path:** `Lambda → thumbnail-generator → Test → Create new test event`

```json
{
  "Records": [
    {
      "s3": {
        "bucket": { "name": "your-app-assets" },
        "object": { "key": "uploads/raw/test-photo.jpg" }
      }
    }
  ]
}
```

→ **Test**

Expected result:
```json
{
  "results": [
    {
      "status": "created",
      "sourceKey": "uploads/raw/test-photo.jpg",
      "thumbnailKey": "uploads/thumbnails/test-photo.jpg.webp"
    }
  ]
}
```

### Option C — Check CloudWatch logs

**Path:** `Lambda → thumbnail-generator → Monitor → View CloudWatch logs → latest log stream`

Every run logs either `Thumbnail created: ...` or an error with full stack trace.

---

## Step 13 — Configure S3 Lifecycle Rule (Orphaned Uploads Cleanup)

To automatically clean up files uploaded to S3 but never saved to MongoDB (e.g., if a user aborts profile creation):

**Path:** `AWS Console → S3 → your-app-assets → Management → Lifecycle rules → Create lifecycle rule`

### 13.1 Rule configuration

| Field | Value |
|---|---|
| Lifecycle rule name | `DeleteOrphanedRawUploads` |
| Choose a rule scope | ✅ Limit the scope of this rule using one or more filters |
| Prefix | `uploads/raw/` |
| Object tags | Add tag → Key: `cleanup`, Value: `true` |

### 13.2 Lifecycle rule actions

- ✅ **Expire current versions of objects** (deletes the objects after a set number of days)

### 13.3 Transition and expiration settings

| Field | Value |
|---|---|
| Days after object creation | `1` (objects are marked for deletion 24 hours after upload) |

→ **Create rule**

---

## Redeploy After Code Changes

```bash
# Inside lambda/thumbnail-generator/
npm run bundle

# Deploy via CLI
aws lambda update-function-code \
  --function-name thumbnail-generator \
  --zip-file fileb://../thumbnail-generator.zip \
  --region ap-south-1
```

---

## Permissions Cheat Sheet

| Who | Needs what | Where to set it |
|---|---|---|
| IAM user (your app) | `s3:PutObject`, `s3:GetObject`, `s3:HeadObject`, `s3:DeleteObject` on bucket/* | IAM → Users → Permissions → Inline policy |
| Lambda role | `s3:GetObject` on `uploads/raw/*`, `s3:PutObject` on `uploads/thumbnails/*` | IAM → Roles → Permissions → Inline policy |
| S3 → Lambda invocation | `lambda:InvokeFunction` | Lambda → Configuration → Resource-based policy |
| Browser → S3 PUT | CORS policy on bucket | S3 → Permissions → CORS |

---

## CORS Error Cheat Sheet

| Symptom | Root cause | Fix |
|---|---|---|
| `No 'Access-Control-Allow-Origin' header` | Origin not in CORS AllowedOrigins | Add your exact origin to S3 CORS config |
| `403 SignatureDoesNotMatch` | Extra headers signed on server but not sent by browser (or vice versa) | Only put `ContentType` in `PutObjectCommand` — nothing else |
| `400 Bad Request` on PUT | Content-Type mismatch between presign and actual upload | Pass `file.type` from browser to presign API and use same value |
| `OPTIONS` preflight fails | `AllowedHeaders` missing required header | Add `x-amz-date`, `x-amz-content-sha256` to AllowedHeaders in CORS |
| CORS error only in production | `AllowedOrigins` has localhost but not production domain | Add `https://yourdomain.com` to AllowedOrigins |
| `ERR_NETWORK` on PUT | `Block all public access` is off + no bucket policy | Turn block public access back ON, use presigned URLs |

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `Could not load the "sharp" module using the linux-x64 runtime` | Sharp installed for macOS, not Linux | `npm install --os=linux --cpu=x64 --libc=glibc sharp` → re-zip → redeploy |
| `NoSuchKey` when loading thumbnail | Lambda hasn't run yet or failed silently | Check CloudWatch logs; re-test with manual event |
| Lambda not triggered | S3 event notification missing or wrong prefix | Check `S3 → Properties → Event notifications` |
| `AccessDenied` in Lambda logs | Role missing `s3:GetObject` or `s3:PutObject` | Add inline policy to the Lambda role (Step 5.4) |
| `AccessDenied` on presign from app | IAM user missing required actions | Add inline policy to IAM user (Step 4.4) |
| `NoSuchBucket` | Wrong bucket name in env vars | Check `S3_BUCKET_NAME` in `.env.local` exactly matches bucket name |
| Lambda times out | Image too large or memory too low | Increase memory to 1024 MB, timeout to 60 sec |
| Infinite Lambda loop | S3 trigger prefix not set | Set prefix to `uploads/raw/` on the S3 trigger |
| Thumbnail exists in S3 but image broken in app | Presigned URL expired | URLs expire in 10 min — fetch fresh URL on page load |

---

## Quick Reference — Every AWS Console Path

```
S3
  Create bucket              →  S3 → Create bucket
  Bucket policy              →  S3 → <bucket> → Permissions → Bucket policy
  Block public access        →  S3 → <bucket> → Permissions → Block public access
  CORS config                →  S3 → <bucket> → Permissions → Cross-origin resource sharing
  ACL                        →  S3 → <bucket> → Permissions → Access control list
  Event notifications        →  S3 → <bucket> → Properties → Event notifications
  Browse objects             →  S3 → <bucket> → Objects

IAM
  Create user                →  IAM → Users → Create user
  User access keys           →  IAM → Users → <user> → Security credentials → Access keys
  User inline policy         →  IAM → Users → <user> → Permissions → Add permissions → Inline policy
  Create role                →  IAM → Roles → Create role
  Role inline policy         →  IAM → Roles → <role> → Permissions → Add permissions → Inline policy

Lambda
  Create function            →  Lambda → Functions → Create function
  Upload ZIP                 →  Lambda → <fn> → Code → Upload from .zip
  Runtime / handler          →  Lambda → <fn> → Code → Runtime settings
  Memory / timeout           →  Lambda → <fn> → Configuration → General configuration
  Environment variables      →  Lambda → <fn> → Configuration → Environment variables
  S3 trigger                 →  Lambda → <fn> → Configuration → Triggers → Add trigger
  Resource-based policy      →  Lambda → <fn> → Configuration → Permissions → Resource-based policy
  Test function              →  Lambda → <fn> → Test
  View logs                  →  Lambda → <fn> → Monitor → View CloudWatch logs
```
