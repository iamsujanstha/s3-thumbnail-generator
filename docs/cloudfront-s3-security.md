<style>
  code, pre, kbd, samp {
    font-family: 'Fira Code', ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
  }
</style>

# 🔒 CloudFront & S3 Advanced Security Blueprint (Public vs. Private Image Delivery)

This guide details the security best practices for hosting and delivering images using AWS CloudFront, Origin Access Control (OAC), and S3. It contrasts the delivery models of **public images** and **strictly private assets**, illustrates their lifecycles using Mermaid diagrams, and concludes with a **Senior-Level Systems Architect Interview Guide** covering advanced production-grade edge cases.

---

## 1. 🏗️ Architectural Flow Diagrams

### Flow A: Secure Public Image Delivery (Avatars, Product Images)
For public assets, we prioritize **high availability, DDoS protection, and unguessable object paths (UUIDs)** while keeping the files publicly accessible via the CDN.

```mermaid
sequenceDiagram
    autonumber
    actor Attacker as Attacker / Client Browser
    participant WAF as AWS WAF (Web App Firewall)
    participant CF as CloudFront CDN (Edge PoP)
    participant Lambda as Lambda Resizer (Sharp)
    participant S3 as AWS S3 Bucket (Private)

    Note over Attacker: Attempts DDoS or guesses URL paths
    Attacker->>WAF: GET /uploads/raw/3a8d9b23-7c81-4f9e.jpg?w=137
    
    alt Rate Limit Triggered (>100 req / 5 min from same IP)
        WAF-->>Attacker: HTTP 429 Too Many Requests (Blocked at Edge)
    else Request Allowed
        WAF->>CF: Forward request
        Note over CF: Check Cache Key: Path + Query (?w=137)
        
        alt Cache Hit
            CF-->>Attacker: Return Cached Optimized WebP (Zero Backend load)
        else Cache Miss
            CF->>Lambda: Trigger Origin Request
            Note over Lambda: Validate: Is w=137 in allowlist [100, 200, 400]?
            
            alt Invalid Size Parameter
                Lambda-->>CF: HTTP 400 Bad Request (Stops execution)
                CF-->>Attacker: HTTP 400 Bad Request
            else Valid Size
                Lambda->>S3: Fetch original (Authorized via OAC)
                S3-->>Lambda: Return Original Image Binary
                Note over Lambda: Execute Sharp (Resize & Compress)
                Lambda-->>CF: Return Optimized WebP
                Note over CF: Cache output locally
                CF-->>Attacker: Return Optimized WebP
            end
        end
    end
```

---

### Flow B: Secure Private Image Delivery (Invoices, Private Documents)
For private assets, we enforce cryptographic validation at the CDN edge using **CloudFront Signed URLs or Signed Cookies**, ensuring S3 is never exposed and unauthorized requests are rejected instantly.

```mermaid
sequenceDiagram
    autonumber
    actor Client as Authenticated User
    actor Attacker as Attacker / Leaked Link
    participant App as NestJS Backend Server
    participant CF as CloudFront CDN (Edge PoP)
    participant S3 as AWS S3 Bucket (Private)

    Note over Client: Logged in & authorized
    Client->>App: Request private invoice image page
    Note over App: Validate User Session in DB
    Note over App: Generate cryptographically signed CloudFront URL<br/>(Expires in 15m, locked to client IP)
    App-->>Client: Return Signed URL: cdn.com/docs/inv-99.pdf?Policy=...&Signature=...
    
    Client->>CF: GET cdn.com/docs/inv-99.pdf?Policy=...&Signature=...
    Note over CF: Validate signature with Trusted Key Group (Public Key)
    CF->>S3: Fetch file (via OAC IAM permission)
    S3-->>CF: Return binary
    CF-->>Client: Serve PDF / Image (Secure)

    Note over Attacker: Tries to access without signature or after 15m expiry
    Attacker->>CF: GET cdn.com/docs/inv-99.pdf
    Note over CF: Signature missing or expired
    CF-->>Attacker: HTTP 403 Forbidden (Blocked instantly at CDN Edge)
```

---

## 2. 🛡️ CloudFront CDN Security Best Practices

Implementing these controls safeguards your architecture from data exposure, crawler bots, and billing attacks (DDoS).

### 1. Enforce Origin Access Control (OAC)
* **What it does:** Completely blocks direct public access to your S3 bucket. All requests must go through CloudFront.
* **Why it's secure:** OAC supports AWS Signature Version 4 (SigV4), meaning CloudFront signs requests before sending them to S3. This allows you to keep your S3 bucket fully private and block public ACLs (`block-public-access = true`).
* **S3 Bucket Policy Restriction:**
  ```json
  "Condition": {
    "StringEquals": {
      "AWS:SourceArn": "arn:aws:cloudfront::YOUR_ACCOUNT_ID:distribution/YOUR_CF_DIST_ID"
    }
  }
  ```

### 2. Implement AWS WAF (Web Application Firewall)
To prevent botnets or malicious actors from script-flooding your CDN:
* **Rate Limiting:** Set up a WAF rate limit rule of **100–300 requests per 5 minutes per IP address**.
* **IP Reputation Lists:** Enable AWS Managed Rules for Amazon IP Reputation Lists to auto-block known botnets, anonymous proxies, and tor exit nodes.
* **Geo-Blocking:** If your application only serves specific regions (e.g., USA, Germany), configure CloudFront or WAF to block access from countries outside your business scope.

### 3. Restrict Resizing Dimensions & Protect Compute
If you use an on-the-fly Lambda image resizer:
* **Allowlist Dimensions:** Hardcode approved image dimensions (e.g., `100x100`, `200x200`, `800x600`) in your Lambda code. If an attacker requests a random parameter like `?w=9999` or `?w=133`, immediately abort and return a `400 Bad Request` before running the expensive `sharp` compiler.
* **Filter Query Strings in CloudFront Cache Policy:** Configure CloudFront to only forward specific query parameters (`w`, `h`, `q`) to the origin. Strip out all other random parameters to avoid **Cache Poisoning** and cache-key saturation.

---

## 3. 🔑 Secure Presigned Uploads vs. CloudFront Delivery

A secure architecture separates the concerns of **uploads** and **downloads** using different mechanisms.

| Feature / Goal | 📤 S3 Presigned URLs (Upload Only) | 📥 CloudFront Signed URLs/Cookies (Download Only) |
| :--- | :--- | :--- |
| **Primary Use Case** | Secure, direct client-to-bucket file uploads. | Secure, authenticated file retrieval/streaming. |
| **Target Origin** | Directly targets the AWS S3 Bucket. | Targets the CloudFront CDN Edge Location. |
| **Security Mechanism** | IAM User/Role Credentials sign the HTTP `PUT` action. | A CloudFront Key Group (RSA Public/Private key) signs the request. |
| **Egress Optimization**| Bypasses the CDN (not needed for uploads). | Leverages Edge Caching to prevent backend compute hits. |
| **Typical Expiry** | 5 to 15 minutes (Single use). | Variable (5 mins for downloads, days for streaming). |

### S3 Presigned URLs: Security Checklist for Uploads
If you generate presigned URLs for client-side uploads, enforce these rules:
1. **Explicit HTTP Method:** Restrict the presigned URL to `PUT`. Never use wildcard or `GET` privileges.
2. **Restrict Key Paths (UUIDs):** The backend must dictate the exact file key prefix (e.g., `uploads/raw/UUID.jpg`). Never let the client choose their upload filename, which could lead to path traversal attacks (e.g., uploading to `../../../index.html` to overwrite static files).
3. **Content-Length & Type Limits:** Enforce strict file size limits (`content-length-range`) and file type locks (e.g., `image/jpeg`, `image/png`) inside the S3 client configuration to block malicious payload injections.
4. **Three-Tier Object Verification:** Once uploaded, verify the file on the backend using `HeadObject` (checking size, actual content headers, and active tagging) before allowing it to be mapped to a user profile.

---

## 4. 🎓 Senior Systems Architect Interview Q&A

These questions target real-world infrastructure failure modes, architectural trade-offs, and mitigation strategies.

### Q1: An attacker is flooding our CloudFront CDN with randomized query parameters (e.g., `avatar.jpg?w=1`, `avatar.jpg?w=2`, ..., `avatar.jpg?w=99999`). Explain the failure mode this causes and how you would design a mitigation.
* **Failure Mode (Cache Key Saturation & Cost Surge):** 
  By default, if CloudFront caches based on query strings, every unique query parameter represents a unique cache key. This bypasses the CDN cache (registering a Cache Miss), forcing CloudFront to forward the request to the Lambda resizer. 
  1. The Lambda executes the heavy `sharp` engine, incurring massive AWS Lambda execution fees.
  2. The CDN cache becomes filled with millions of duplicate images of slightly different widths, pushing out legitimate assets and dropping the cache hit ratio to near zero.
  3. S3 read egress costs skyrocket.
* **Architectural Mitigation:**
  1. **Strict Query String Caching:** Configure the CloudFront Cache Policy to only include specific query keys (e.g. `w` and `q`) and forward them only if they match an allowlist.
  2. **Lambda Parameter Interception:** In the Lambda function, intercept the request and validate the parameter:
     ```javascript
     const allowedWidths = [100, 200, 400, 800];
     const targetWidth = parseInt(queryString.w, 10);
     if (!allowedWidths.includes(targetWidth)) {
         return {
             status: '400',
             statusDescription: 'Bad Request: Unsupported Image Dimension'
         };
     }
     ```
  3. **WAF Custom Regex Rule:** Set up an AWS WAF rule that blocks requests where query strings have non-integer characters or exceed a length of 10 characters.

---

### Q2: Why is CloudFront Origin Access Control (OAC) preferred over the legacy Origin Access Identity (OAI)? Explain from a security and protocol perspective.
* **Security & SSE-KMS Support:**
  Legacy OAI **does not support** AWS KMS customer-managed keys (SSE-KMS) for encrypting S3 buckets. If S3 objects are encrypted at rest with custom KMS keys, OAI cannot decrypt them during retrieval. OAC resolves this by propagating the caller credentials and supports SigV4 request signing, enabling KMS-secured buckets to be read seamlessly by CloudFront.
* **Regional Protocol Coverage:**
  OAI does not support AWS Signature Version 4. This means in newer AWS regions established after 2014 (which require SigV4), OAI configurations could experience intermittent authentication failures. OAC natively supports SigV4 and all global AWS regions.
* **HTTP Methods:**
  OAC allows signing of multiple HTTP methods (including `PUT` and `DELETE`), whereas OAI only supports read-only operations.

---

### Q3: When should a Senior Architect choose CloudFront Signed Cookies instead of CloudFront Signed URLs? What are the implementation trade-offs?
* **Signed Cookies are preferred when:**
  1. **Multi-File Access:** The client needs access to multiple private files (e.g., an entire gallery of private images, a directory of private course videos, or a nested folder of static assets). Generating individual Signed URLs for every single image on a dashboard is highly inefficient.
  2. **URL Integrity:** You want to maintain clean, SEO-friendly, RESTful URLs (e.g., `cdn.com/gallery/img1.jpg`) without appending messy query parameters to every resource string.
  3. **Application Integration:** The frontend is a Single Page Application (SPA) where the credentials can be injected once in an HTTP-only cookie and automatically attached to all downstream image requests.
* **Signed URLs are preferred when:**
  1. The client is a mobile application or IoT device that doesn't have native or easy support for handling browser-style HTTP cookies.
  2. You want to restrict access to a **single file** at a time to prevent users from sharing links or harvesting access.
  3. You want to lock down access to a specific client IP address using the `IpAddress` parameter in the custom policy (easier to enforce dynamically on single links).

---

### Q4: If our application database leaks image paths, how does a UUID-based key prefix protect user privacy compared to structured paths? What is the mathematical probability of a hash collision?
* **Privacy via Obscurity & Non-Enumeration:**
  In a structured database scheme (e.g., `uploads/profiles/user_id/avatar.jpg`), if an attacker accesses user IDs, they can programmatically build the URLs of every user's private images. By using random UUIDv4 paths (`uploads/raw/3a8d9b23-7c81-4f9e-bcde-18471e98dcf1.jpg`), knowing the user's database record or sequential ID gives the attacker **zero information** about the actual URL path on CloudFront/S3.
* **UUIDv4 Key Space & Hash Collision Probability:**
  UUIDv4 has 122 bits of randomness. The total number of possible UUIDs is $2^{122} \approx 5.3 \times 10^{36}$. 
  To have a **1 in a billion (1 in $10^9$)** chance of a single collision, you would need to generate **103 trillion UUIDs**. Even at massive scale (e.g., 100k uploads per second), it would take hundreds of years to hit a single collision, ensuring that every user's key path remains mathematically unique and unguessable.
