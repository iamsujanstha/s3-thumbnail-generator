<style>
  code, pre, kbd, samp {
    font-family: 'Fira Code', ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
  }
</style>

# 🚀 System Design Guide: Secure Client-Side Uploads & Image Caching

Welcome to the System Design Guide. To improve readability and isolate architectural details, this documentation has been modularized into focused, easy-to-read guides.

Please select a section below to explore the detailed implementation blueprints:

---

## 🗺️ Documentation Directory

### 1. 🏗️ [Core Architecture Blueprint](file:///Users/mac/Developer/Thumbnail-app/docs/architecture.md)
* **What is covers:** Core system flow diagrams, start-to-finish sequence diagrams for client uploads, tag cleanups, serverless Lambda execution, and enterprise edge-routing architecture.

### 2. ❓ [System Design Q&A (FAQ)](file:///Users/mac/Developer/Thumbnail-app/docs/system-design-qa.md)
* **What is covers:** Essential Q&As explaining client-side upload costs, S3 Signature V4 mechanics, PUT vs. POST uploads, the 3-Tier tag cleanup pattern, client MD5/SHA checksums, and the security benefits of backend-generated UUIDs.

### 3. 💻 [Frontend Integration Guide](file:///Users/mac/Developer/Thumbnail-app/docs/frontend-implementation.md)
* **What is covers:** ReactJS (SPA) vs. Next.js (Hybrid) comparison matrix, Vite development proxy configurations, custom file upload hooks (`useReactProfileUpload`), and optimized client image tags with automatic fallback logic.

### 4. ⚙️ [NestJS Backend Validation & Setup](file:///Users/mac/Developer/Thumbnail-app/docs/backend-implementation.md)
* **What is covers:** Advanced S3 verification workflows (HeadObject checks, MIME-type filtering), Class-Validator/Class-Transformer DTO declarations, S3 wrapper services, controller routing schemas, and NestJS module setups.

### 5. ☁️ [AWS S3 & CloudFront CDN Infrastructure](file:///Users/mac/Developer/Thumbnail-app/docs/aws-infrastructure.md)
* **What is covers:** S3 Bucket CORS configuration files, IAM permissions policies, CloudFront Origin Access Control (OAC) setup instructions, secure bucket policies, and detailed line-by-line parameter explanations.

### 6. 💾 [Caching Strategies: Local Cache vs. Nginx vs. CDN](file:///Users/mac/Developer/Thumbnail-app/docs/caching-strategies.md)
* **What is covers:** Local disk read-through proxies, LRU pruner crons, Event-Driven S3 webhook invalidations, Nginx reverse proxy configs, and the comprehensive **Nginx Cache vs. CloudFront CDN cost-benefit showdown** (latency path charts, myths vs realities, and logical selection frameworks).
