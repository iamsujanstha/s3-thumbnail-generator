<style>
  code, pre, kbd, samp {
    font-family: 'Fira Code', ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
  }
</style>

# ☁️ AWS S3 & CloudFront CDN Infrastructure Configuration

This document provides step-by-step setup guides and permission policies for S3 Bucket CORS, IAM policies, and CloudFront Origin Access Control (OAC).

---

## 1. S3 Bucket CORS Configuration

Browsers reject direct `PUT` uploads to S3 due to Cross-Origin Resource Sharing (CORS). Add this configuration under S3 Bucket ➔ **Permissions** ➔ **CORS configuration**:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

---

## 2. IAM Policy (Principle of Least Privilege)

Ensure the API credentials used by the backend do not have full admin access. Use an IAM policy with only the minimum required S3 permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3PresignedUploadPermissions",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:HeadObject",
        "s3:DeleteObjectTagging"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/uploads/*"
    }
  ]
}
```

---

## 3. CloudFront CDN + Origin Access Control (OAC) Configuration

This setup completely isolates your AWS S3 bucket from the public internet while delivering images at lightning-fast speeds globally.

### ⚙️ Step-by-Step Setup Guide

#### Step 1: Create the Origin Access Control (OAC)
1. Go to the AWS CloudFront Console ➔ **Security** ➔ **Origin access**.
2. Click **Create control setting (OAC)**.
3. Name it (e.g., `s3-thumbnail-oac`), select **Sign requests (recommended)**, and choose **S3** as the origin type.

#### Step 2: Configure the CloudFront Distribution
1. Navigate to the **AWS CloudFront Console** and click **Create distribution**.
2. **Origin domain:** Select your S3 bucket (`sujankshrestha-bucket.s3.ap-south-1.amazonaws.com`).
3. **Origin access:** Select **Origin access control settings (recommended)**.
4. Select the newly created OAC.
5. **Web Application Firewall (WAF):** Choose to enable security protections or opt-out for testing.
6. Click **Create distribution**.

#### Step 3: Configure the S3 Bucket Policy
Once the distribution is created, copy the generated S3 bucket policy from the AWS Console and apply it to your S3 bucket under **Permissions ➔ Bucket Policy**.

Here is the exact policy configured for this project (written in `JSON` format):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontOACRead",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::sujankshrestha-bucket/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::870325637511:distribution/E23UX6SY1LFFD6"
        }
      }
    }
  ]
}
```

---

## 4. 🔍 Explanation of Bucket Policy Lines

Let's break down what each statement in the S3 bucket policy does:

* **`"Principal": { "Service": "cloudfront.amazonaws.com" }`**
  This defines the entity receiving permissions. Instead of opening the bucket to public users (`*`), it restricts access exclusively to the AWS CloudFront service.
* **`"Action": "s3:GetObject"`**
  This specifies the permitted action. It allows CloudFront to read objects but blocks it from performing directory listings (`s3:ListBucket`), writing files (`s3:PutObject`), or deleting them (`s3:DeleteObject`).
* **`"Resource": "arn:aws:s3:::sujankshrestha-bucket/*"`**
  This targets all files inside the S3 bucket.
* **`"Condition": { "StringEquals": { "AWS:SourceArn": "arn:aws:cloudfront::870325637511:distribution/E23UX6SY1LFFD6" } }`**
  This is a critical security condition. Without it, *any* CloudFront distribution in *any* AWS account could request objects from your bucket. This checks that the incoming request is originating strictly from your specific distribution ARN (`E23UX6SY1LFFD6`), preventing cross-account configuration hijack attacks.
