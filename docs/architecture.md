<style>
  code, pre, kbd, samp {
    font-family: 'Fira Code', ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
  }
</style>

# 🏗️ Core Architecture Blueprint

This document details the system design, flow diagrams, and architectural blueprints for client-side direct uploads and image processing.

---

## 1. System Architecture Flow

In a traditional upload flow, the client sends files directly to the web server, which then processes them and forwards them to storage. While simple, this creates bottlenecks in CPU, memory, and bandwidth. 

Our architecture implements **Client-Side Direct Uploads via S3 Presigned URLs**, decoupled from database creation and processed asynchronously via **AWS Lambda**.

### System Architecture Flow Diagram

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Frontend)"]
        Browser["React / Next.js Client<br/>(Image Dropzone)"]
    end

    subgraph Server ["Server Layer (NestJS Backend)"]
        API["Presign Endpoint<br/>(Generate URLs)"]
        Controller["Profiles Controller<br/>(Request Routing)"]
        Service["Profiles Service<br/>(Business Logic)"]
        Storage["Storage Service<br/>(S3 Client SDK)"]
        DB["MongoDB / PostgreSql<br/>(Database)"]
    end

    subgraph AWS ["Storage & Processing Layer (AWS)"]
        S3Raw["S3 Bucket: /uploads/raw/<br/>(Private Originals)"]
        Lambda["AWS Lambda Function<br/>(Sharp Image Processor)"]
        S3Thumb["S3 Bucket: /uploads/thumbnails/<br/>(Public Optimizations)"]
    end

    %% Flow connections
    Browser -->|"1. POST Request (file details)"| API
    API --> Controller
    Controller --> Service
    Service -->|"2. PutObjectCommand"| Storage
    Storage -->|"3. Generate URL"| S3Raw
    Storage -->|"4. Return Upload URL + Key"| Browser

    Browser -->|"5. PUT Binary Stream"| S3Raw
    S3Raw -->|"6. S3 Event ObjectCreated"| Lambda
    Lambda -->|"7. Sharp Resize & Convert WebP"| S3Thumb

    Browser -->|"8. POST Profile Form + Key"| DB
```

---

## 2. Complete Sequence Diagram (Start-to-Finish Lifecycle)

The following sequence details how the React client, NestJS backend, AWS S3, and Sharp Lambda interact to perform secure uploads and processing:

```mermaid
sequenceDiagram
    autonumber
    actor Client as React / Next.js Client
    participant Server as NestJS Backend API
    participant S3 as AWS S3 Bucket
    participant DB as MongoDB Database
    participant Lambda as AWS Lambda (Sharp)

    Note over Client, Server: Phase 1: Requesting Authorization
    Client->>Server: POST /api/s3/presign (filename, contentType, contentMd5)
    Note over Server: Zod/Class-Validator Validation & UUID key generation
    Server->>S3: Call getSignedUrl(PutObjectCommand with tag cleanup=true)
    S3-->>Server: Return cryptographic signature URL
    Server-->>Client: Send { uploadUrl, imageKey }

    Note over Client, S3: Phase 2: Direct Uploading
    Client->>S3: PUT binary stream to uploadUrl (Header: Content-Type, Content-MD5)
    S3-->>Client: HTTP 200 OK (Upload Success)

    Note over Client, DB: Phase 3: Metadata Persisting & Tag Cleanup
    Client->>Server: POST /api/profiles (fullName, jobTitle, company, imageKey)
    Server->>DB: Save Profile Document
    DB-->>Server: Saved Document
    Server->>S3: removeCleanupTag(imageKey) (Peels off 'cleanup=true')
    Server-->>Client: Return Profile (Success)

    Note over S3, Lambda: Phase 4: Asynchronous Processing (S3 Event)
    S3->>Lambda: Trigger: s3:ObjectCreated:* for uploads/raw/
    activate Lambda
    Lambda->>S3: GET original image (uploads/raw/{key})
    Lambda->>Lambda: Resize (150x150), Auto-Rotate, Convert to WebP (Sharp)
    Lambda->>S3: PUT optimized thumbnail (uploads/thumbnails/{key}.webp)
    deactivate Lambda
```

---

## 3. Scale & Architecture Blueprint (Enterprise Corporate Scale)

How do high-traffic tech platforms (e.g. Netflix, Airbnb, Amazon) scale direct-to-S3 uploads and millions of optimized image deliveries globally?

1. **Edge Upload Ingress:** Client uploads bypass the app servers and connect directly to the nearest S3 edge location using **S3 Transfer Acceleration** (Anycast routing over AWS backbone).
2. **On-Demand Dynamic Resizing (CDN pull-based):**
   Instead of preprocessing thumbnails for dozens of screen sizes using S3 Lambda triggers, enterprise systems use **CloudFront + Lambda@Edge/CloudFront Functions + Sharp** to dynamically resize images *on the fly*.
   * Saves petabytes of S3 storage costs.
   * Images are only generated at the exact requested width/height on-demand and cached directly at the CDN edges.

```mermaid
flowchart TD
    Client([React Client]) -->|1. Request /w=300,h=300/photo.jpg| CF["CloudFront CDN Edge Cache"]
    CF -->|2. Cache Miss| LambdaEdge["Lambda@Edge Resizer (Sharp)"]
    LambdaEdge -->|3. Fetch Original| S3Raw[("S3 Bucket (Originals)")]
    S3Raw -->|4. Original Image Buffer| LambdaEdge
    LambdaEdge -->|5. Resize On-The-Fly| CF
    CF -->|6. Cache WebP at Edge & Return| Client
```
