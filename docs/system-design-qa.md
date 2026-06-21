<style>
  code, pre, kbd, samp {
    font-family: 'Fira Code', ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
  }
</style>

# ❓ System Design Q&A (FAQ)

This Q&A addresses fundamental and advanced system design questions, explaining the rationale behind S3 direct uploads, security, tag cleanups, and validation strategies.

---

### <span style="color:#d97706">Q1: Why not upload files directly to the server first?</span>

1. **Serverless Execution Limits:** Most serverless platforms (e.g. Vercel) have payload limits (e.g. Vercel has a hard limit of **4.5 MB** on API request bodies). Large uploads will crash the route.
2. **Server Thread Blocking & Memory Bloat:** Handling multipart form data consumes server CPU and RAM. Direct uploading offloads this completely.
3. **Bandwidth Costs:** Paying twice for ingress bandwidth (Client $\rightarrow$ Server $\rightarrow$ S3) is costly. Direct uploading uploads once (Client $\rightarrow$ S3).

---

### <span style="color:#d97706">Q2: How does S3 verify the signature without calling our server?</span>

When the server generates the presigned URL, it uses the **AWS Signature Version 4 (SigV4)** protocol. It creates a cryptographic signature containing:
- The HTTP verb (`PUT`)
- The target bucket and object key
- Expiration time of the URL
- Date of generation
- Headers that must be present (e.g., `Content-Type`, `Content-MD5`)

This data is signed using our private `AWS_SECRET_ACCESS_KEY`. When the client hits the URL, S3 recalculates the hash. If the hashes match and the timestamp has not expired, S3 grants write access.

---

### <span style="color:#d97706">Q3: Why use PUT instead of POST for presigned uploads?</span>

- **PUT:** Uploads a raw binary stream. The file is sent directly as the request body. It matches S3's standard `PutObject` API, requires very simple header configuration, and is easier to sign and manage.
- **POST:** Requires multipart form-data uploads (S3 Presigned Post). While it allows enforcing maximum file size limits directly in the policy, it requires building complex HTML forms with specific input fields matching the policy keys.

---

### <span style="color:#d97706">Q4: How do we prevent users from modifying files after uploading?</span>

- We generate a secure `UUID` on the server: `uploads/raw/<uuid>-<sanitized_filename>`.
- The client cannot inject arbitrary S3 keys because S3 rejects the upload if the path does not exactly match the key signed in the URL.

---

### <span style="color:#d97706">Q5: What is the "Auto-Delete / Tag Cleanup" pattern, and how does it handle tab closures and file overrides?</span>

**The Problem: Orphaned & Abandoned Uploads**
Because we upload files instantly on selection to optimize performance, there are two primary waste scenarios:
1. **Tab Closure / Abandonment:** The user selects an image (triggering S3 upload) but closes the tab or browser before submitting the form.
2. **File Overrides:** The user uploads a file, decides they don't like it, and selects a different file. The first file remains in S3 but is no longer linked to anything.

**The Solution: A 3-Tier Production Cleanup Strategy**

To prevent S3 bucket bloat and save costs, production architectures implement a tiered approach:

```mermaid
stateDiagram-v2
    [*] --> FileSelected : User selects image in UI
    FileSelected --> S3Uploaded : Instant PUT upload with 'cleanup=true' Tag
    
    state S3Uploaded {
        [*] --> WaitingForSubmit : Image key stored in state
        WaitingForSubmit --> FileOverridden : User selects a new file
        FileOverridden --> S3Uploaded : Upload new file, queue old key
        FileOverridden --> ImmediateDelete : Frontend triggers secure DELETE for old key
        ImmediateDelete --> [*] : Deleted from S3 immediately
    }
    
    WaitingForSubmit --> FormSubmitted : User clicks "Submit"
    FormSubmitted --> DBRegistered : Profile saved in DB
    DBRegistered --> TagRemoved : Backend calls removeCleanupTag()
    TagRemoved --> PermanentStorage : File preserved permanently
    
    WaitingForSubmit --> TabClosed : User closes tab or abandons form
    TabClosed --> LifecycleTriggered : 24 hours pass
    LifecycleTriggered --> S3AutoDelete : S3 Lifecycle Rule deletes tagged object
    S3AutoDelete --> [*]
```

#### Tier 1: S3 Object Tagging + Lifecycle Rules (The Fail-Safe Net)
- **Why:** Covers tab closures, network disconnections, app crashes, and abandoned forms.
- **How:** During presigned URL generation, S3 objects are automatically tagged with `cleanup=true`. An S3 Lifecycle Policy is set to automatically delete any object in `uploads/raw/` with `cleanup=true` after **24 hours**. When the form is submitted, the backend calls `DeleteObjectTaggingCommand` to remove the tag, saving it from deletion.

#### Tier 2: Client-Initiated Immediate Deletion (The Immediate Cleanup)
- **Why:** Covers the file override scenario (selecting a new image or clearing the selection).
- **How:** If `uploadedKey` is not null and the user uploads a new file or clears the input, the frontend makes an immediate HTTP request to a secure backend endpoint `/api/s3/delete` with the old key. The backend validates the user and key, then calls `DeleteObjectCommand` on S3 to remove the abandoned file immediately, avoiding waiting 24 hours.

#### Tier 3: Incomplete Multipart Upload Expiration
- **Why:** Covers aborted or failed large uploads where chunk uploads stopped halfway.
- **How:** S3 buckets are configured with a Lifecycle Rule to "Abort incomplete multipart uploads" after **7 days**, which automatically garbage-collects temporary chunk uploads that were never completed.

---

### <span style="color:#d97706">Q6: What are the alternatives to calculating MD5 client-side?</span>

Ensuring payload integrity prevents half-uploaded or corrupted files from being saved. Standard `Content-MD5` header checks require calculating the MD5 hash in the client.

**Alternatives:**
1. **SHA-256 Checksums (Web Crypto API):**
   - The browser calculates a SHA-256 checksum natively using the Web Crypto API: `await crypto.subtle.digest("SHA-256", fileBuffer)`.
   - Web Crypto is natively supported by modern browsers, avoiding custom, bug-prone JS hashing functions.
   - S3 supports signing the `x-amz-checksum-sha256` header instead of `Content-MD5`.
2. **Using a Pre-Compiled Client-Side Library:**
   - Instead of writing custom bit-shifting algorithms for MD5, use battle-tested libraries like `spark-md5` or `js-md5`. 
   - `spark-md5` supports **incremental hashing** which allows hashing large files block-by-block without loading the entire file into memory.
3. **TLS/TCP Layer Checks (No custom checksum header):**
   - You can completely skip signing a checksum header. S3 will still perform integrity checks at the transport layer (SSL/TLS). However, this does not protect against client-side browser corruption before packet transmission.

---

### <span style="color:#d97706">Q7: Why must the UUID be generated on the backend instead of the frontend?</span>

Generating the unique identifier (`UUID`) strictly on the backend during the pre-signing phase—rather than letting the client generate it—is a fundamental security best practice. It provides several key benefits:

1. **Prevents S3 Key Hijacking & Directory Traversal Attacks:**
   If the client generated the UUID, a malicious user could modify the frontend code to request a presigned URL for an arbitrary file path, such as `uploads/raw/../../config/production.json` or `uploads/raw/admin-avatar.png`. By forcing the backend to generate the UUID, the server maintains absolute control over the bucket folder structure, isolating user uploads under a safe namespace.
2. **Prevents File Overwrite Collisions (Intentional or Accidental):**
   If the client could choose the S3 key, a bad actor could intentionally target another user's profile image by generating a presigned URL with the exact same UUID and filename, overwriting their avatar. Backend-generated UUIDs ensure cryptographically secure randomness (using Node's CSPRNG `crypto.randomUUID()`) that cannot be predicted or manipulated by the browser.
3. **Ensures Backend Validation Integrity:**
   When the user submits the form, the backend verifies that the submitted `imageKey` matches the expected pattern:
   `^uploads\/raw\/[a-f0-9-]{36}-.+\.(jpg|jpeg|png|webp)$`
   Because the backend is the sole authority generating these keys, it can confidently validate that the client is linking to a legitimately authorized, newly created upload, rather than pointing to a spoofed path.
4. **Audit and Session Association:**
   Generating the UUID on the backend allows the server to log and trace the upload request, linking the generated UUID to the authenticated user's session *before* the upload even starts, providing a reliable audit trail for compliance and debugging.
