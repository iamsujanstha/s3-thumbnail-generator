# Profile Studio

Production-oriented Next.js profile management app using App Router, TypeScript, Tailwind CSS, MongoDB, direct-to-S3 uploads, and an asynchronous thumbnail Lambda.

## Architecture

- `src/app`: Next.js delivery layer and API routes.
- `src/components`: presentation components and profile UI.
- `src/core`: domain entities, repository contracts, and use cases.
- `src/infrastructure`: MongoDB and S3 adapters.
- `src/shared`: DTO schemas, environment validation, and utility functions.
- `lambda/thumbnail-generator`: standalone Node.js Lambda using `sharp`.

## Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Update `.env.local` with real values:

```bash
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/profile-management
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-profile-image-bucket
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For Vercel, add the same values in Project Settings -> Environment Variables. Set `NEXT_PUBLIC_APP_URL` to your deployed app URL, for example `https://your-app.vercel.app`.

## AWS Setup Overview

The application uses this image workflow:

1. The browser asks `/api/s3/presign` for a secure S3 upload URL.
2. The browser uploads the original image directly to S3 under `uploads/raw/`.
3. The app saves only the raw S3 key in MongoDB.
4. S3 automatically invokes the Lambda when a new raw object is created.
5. Lambda creates a 150x150 WebP thumbnail under `uploads/thumbnails/`.
6. The profile listing API signs thumbnail URLs for fast frontend display.

## Create The S3 Bucket

Create one private bucket for profile images. The bucket does not need public read access because the app returns time-limited signed URLs.

Using AWS CLI:

```bash
aws s3api create-bucket \
  --bucket your-profile-image-bucket \
  --region us-east-1
```

For regions other than `us-east-1`, include the location constraint:

```bash
aws s3api create-bucket \
  --bucket your-profile-image-bucket \
  --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1
```

Recommended bucket settings:

- Keep Block Public Access enabled.
- Enable default encryption with SSE-S3 or SSE-KMS.
- Enable versioning if you want recovery for overwritten/deleted images.
- Do not enable static website hosting.

Create these logical prefixes by uploading through the app or by creating empty marker folders in the console:

- `uploads/raw/`
- `uploads/thumbnails/`

## S3 CORS

Configure the bucket to allow browser `PUT` uploads from the Vercel domain and local development origin:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["http://localhost:3000", "https://your-app.vercel.app"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Using AWS CLI:

```bash
aws s3api put-bucket-cors \
  --bucket your-profile-image-bucket \
  --cors-configuration file://cors.json
```

Use the same JSON shown above in `cors.json`.

## Create IAM Permissions

The Next.js app needs permissions to create signed `PutObject` URLs for raw uploads and signed `GetObject` URLs for raw/thumbnail reads.

Attach a policy like this to the IAM user represented by `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ProfileImageObjectAccess",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": [
        "arn:aws:s3:::your-profile-image-bucket/uploads/raw/*",
        "arn:aws:s3:::your-profile-image-bucket/uploads/thumbnails/*"
      ]
    }
  ]
}
```

The Lambda execution role needs read access to raw uploads and write access to thumbnails:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadRawProfileImages",
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::your-profile-image-bucket/uploads/raw/*"
    },
    {
      "Sid": "WriteProfileThumbnails",
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::your-profile-image-bucket/uploads/thumbnails/*"
    },
    {
      "Sid": "WriteLogs",
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "*"
    }
  ]
}
```

## Create The Lambda Function

The thumbnail generator lives in:

```text
lambda/thumbnail-generator/index.mjs
```

Recommended Lambda settings:

- Runtime: Node.js 20.x
- Handler: `index.handler`
- Memory: 512 MB or higher
- Timeout: 30 seconds
- Architecture: `arm64` or `x86_64`

Because the Lambda uses `sharp`, install dependencies in the Lambda folder for the same operating system and architecture that Lambda will use.

For `arm64` Lambda:

```bash
cd lambda/thumbnail-generator
npm install --omit=dev --os=linux --cpu=arm64
zip -r thumbnail-generator.zip index.mjs package.json package-lock.json node_modules
```

For `x86_64` Lambda:

```bash
cd lambda/thumbnail-generator
npm install --omit=dev --os=linux --cpu=x64
zip -r thumbnail-generator.zip index.mjs package.json package-lock.json node_modules
```

Create a Lambda trust policy named `lambda-trust-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

Create the Lambda execution role:

```bash
aws iam create-role \
  --role-name profile-thumbnail-generator-role \
  --assume-role-policy-document file://lambda-trust-policy.json
```

Attach the Lambda permissions policy from the previous IAM section to that role.

Then create the function:

```bash
aws lambda create-function \
  --function-name profile-thumbnail-generator \
  --runtime nodejs20.x \
  --handler index.handler \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/profile-thumbnail-generator-role \
  --zip-file fileb://thumbnail-generator.zip \
  --timeout 30 \
  --memory-size 512 \
  --architectures arm64
```

If you update the Lambda code later:

```bash
aws lambda update-function-code \
  --function-name profile-thumbnail-generator \
  --zip-file fileb://thumbnail-generator.zip
```

## Add The S3 Trigger

Configure an S3 event notification that invokes Lambda when a raw image is uploaded.

Use this event notification setup:

- Event type: `s3:ObjectCreated:*`
- Prefix: `uploads/raw/`
- Destination: `profile-thumbnail-generator`

The Lambda writes optimized thumbnails to `uploads/thumbnails/{raw-filename}.webp`.

Before S3 can invoke Lambda, grant invoke permission:

```bash
aws lambda add-permission \
  --function-name profile-thumbnail-generator \
  --statement-id allow-s3-thumbnail-trigger \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::your-profile-image-bucket
```

Then create `notification.json`:

```json
{
  "LambdaFunctionConfigurations": [
    {
      "Id": "CreateProfileThumbnailFromRawUpload",
      "LambdaFunctionArn": "arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:function:profile-thumbnail-generator",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {
              "Name": "prefix",
              "Value": "uploads/raw/"
            }
          ]
        }
      }
    }
  ]
}
```

Apply it:

```bash
aws s3api put-bucket-notification-configuration \
  --bucket your-profile-image-bucket \
  --notification-configuration file://notification.json
```

Console path:

1. Open S3 -> your bucket -> Properties.
2. Find Event notifications.
3. Create event notification.
4. Set prefix to `uploads/raw/`.
5. Select all object create events or `s3:ObjectCreated:*`.
6. Choose Lambda function `profile-thumbnail-generator`.
7. Save changes.

## MongoDB Setup

Create a MongoDB database for the app, then put the connection string in `MONGODB_URI`.

The app writes profile documents into the `profiles` collection. You do not need to create the collection manually; the repository creates the collection/index on first use.

Stored profile documents contain:

- `fullName`
- `jobTitle`
- `company`
- `imageKey`, for example `uploads/raw/{uuid}-avatar.png`
- `createdAt`
- `updatedAt`

The app intentionally stores only S3 keys, not public image URLs.

## Run Locally

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Verify The Full Thumbnail Flow

1. Start the app locally.
2. Open `http://localhost:3000`.
3. Fill in Full Name, Job Title, and Company.
4. Upload a JPG, PNG, or WebP image under 5 MB.
5. Submit the form.
6. Confirm a new object appears in S3 under `uploads/raw/`.
7. Wait a few seconds for Lambda to run.
8. Confirm a new thumbnail appears under `uploads/thumbnails/` with the `.webp` extension.
9. Open `http://localhost:3000/profiles`.
10. Confirm the listing shows the optimized thumbnail image.

If thumbnails are not created:

- Check the Lambda CloudWatch logs.
- Confirm the S3 event notification prefix is exactly `uploads/raw/`.
- Confirm Lambda has `s3:GetObject` for `uploads/raw/*`.
- Confirm Lambda has `s3:PutObject` for `uploads/thumbnails/*`.
- Confirm the uploaded object is a valid image.
- Confirm the Lambda package includes `node_modules/sharp`.

## Deploy To Vercel

1. Push the repository to GitHub.
2. Import the project in Vercel.
3. Add all environment variables from `.env.example`.
4. Set `NEXT_PUBLIC_APP_URL` to the production Vercel URL.
5. Deploy.
6. Update S3 CORS `AllowedOrigins` to include the production Vercel URL.

## Useful Commands

Validate the app:

```bash
npm run typecheck
npm run lint
npm run build
```
