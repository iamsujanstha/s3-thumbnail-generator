# 🚀 AWS Lambda + CloudFront On-The-Fly Resizer Setup

This directory contains the code and configuration for deploying a **production-grade pull-based dynamic image resizing service** using AWS Lambda and AWS CloudFront.

---

## 📂 File Structure

* `index.mjs` - ESM Lambda handler that fetches original images from S3 and resizes them on-the-fly using `sharp`.
* `package.json` - Node dependencies (`sharp` and `@aws-sdk/client-s3`).

---

## 🛠️ Step 1: Package and Deploy the Lambda Function

Because the `sharp` library contains native C++ binaries, you must compile it for the correct AWS Lambda execution environment (Amazon Linux).

### Option A: Local Build (Linux/Mac)
If you are on Linux or macOS, run this inside the `lambda/dynamic-resizer` folder:
```bash
npm install
zip -r lambda-package.zip index.mjs package.json node_modules
```

### Option B: Cross-Platform Build (Docker)
If you are on Windows or a different OS architecture, compile `sharp` inside a Docker container to match Lambda's OS:
```bash
docker run --rm -v "$PWD":/var/task public.ecr.aws/sam/build-nodejs20.x:latest sh -c "npm install --arch=x64 --platform=linux sharp; zip -r lambda-package.zip index.mjs package.json node_modules"
```

### Create the AWS Lambda Function:
1. Open the **AWS Lambda Console** and click **Create function**.
2. Select **Author from scratch**.
3. Set runtime to **Node.js 20.x** (Architecture: `x86_64` if compiled with Docker `x64`).
4. Under **Execution role**, select/create a role that has permissions to read S3 objects (`s3:GetObject`).
5. Click **Create function**.
6. Upload the generated `lambda-package.zip` in the **Code** tab.
7. Under **Configuration ➔ Environment variables**, add:
   * `S3_BUCKET_NAME` = `your-s3-bucket-name`

---

## 🛡️ Step 2: Configure IAM Permissions

Your Lambda function's execution role needs permissions to read files from your private S3 bucket. Add the following inline policy to the Lambda execution role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

---

## 🌐 Step 3: Set Up CloudFront Distribution

To expose this Lambda function securely and route image requests:

### 1. Enable Lambda Function URL (Recommended for simplicity)
* Go to Lambda Console ➔ **Configuration** ➔ **Function URL**.
* Click **Create Function URL**.
* Auth type: **NONE** (We will secure it with CloudFront).
* Copy the Function URL (e.g., `https://xxxx.lambda-url.us-east-1.on.aws/`).

### 2. Configure CloudFront Origin
* In **AWS CloudFront Console**, create a new Distribution (or edit your existing one).
* Set **Origin Domain** to your **Lambda Function URL** (remove the `https://` and trailing slash).
* Select **HTTPS only** as the protocol.

### 3. Configure Cache Behavior (CRITICAL)
CloudFront must cache different versions of an image depending on the requested parameters (`w` and `h`).

* Go to **Behaviors** ➔ **Edit**.
* Under **Cache key and origin requests**:
  * Select **Cache policy and origin request policy**.
  * Under **Cache policy**, click **Create policy**.
    * Name: `ImageResizerCachePolicy`
    * **Query Strings**: Select **Include specified query strings** and add `w` and `h`.
    * Set TTLs: Minimum `0`, Default `86400` (1 day), Maximum `31536000` (1 year).
    * Click **Create**.
  * Back in the behavior config, select your new `ImageResizerCachePolicy`.
* Click **Save changes**.

---

## 🔄 Step 4: Deleting the Old S3 Event Trigger

Since thumbnails are generated on-the-fly when requested, you must remove the old upload trigger:
1. Go to the **AWS S3 Console** and open your bucket.
2. Go to the **Properties** tab.
3. Scroll down to **Event notifications**.
4. Find the trigger connected to the old `thumbnail-generator` Lambda and click **Delete**.
