# <span style="color:#e0234e;">🦁 NestJS Modular Architecture Reference</span>

This folder contains a complete, production-grade **NestJS API reference implementation** matching the exact features of your Next.js project. You can copy the `src/` directory directly into your NestJS project.

---

## 📂 Folder Structure

```text
src/
├── app.module.ts                    # Root module registering NestJS imports
└── modules/
    ├── storage/
    │   ├── dto/
    │   │   └── storage.dto.ts       # Type validation for S3 operations
    │   ├── storage.controller.ts    # Presigning, Multipart, and Image Proxy routes
    │   ├── storage.service.ts       # AWS S3 SDK wrapper (streaming-enabled)
    │   └── storage.module.ts        # Exports StorageService for other modules
    └── profiles/
        ├── dto/
        │   └── profiles.dto.ts      # Profile CRUD payload validation
        ├── schemas/
        │   └── profile.schema.ts    # Mongoose (MongoDB) database schema
        ├── profiles.controller.ts   # Profile HTTP endpoint routes
        ├── profiles.service.ts      # Profile business logic & tag cleanup coordination
        ├── profiles.repository.ts   # Database CRUD operations layer (Mongoose wrapper)
        └── profiles.module.ts       # Wires up profiles, repository, and imports Storage
```

---

## 🚀 How to Import into Your NestJS App

### 1. Install Dependencies
Run the following in your target NestJS project:
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @nestjs/mongoose mongoose class-validator class-transformer
```

### 2. Copy the Files
1. Copy the `modules/storage` and `modules/profiles` folders into your NestJS `src/modules/` directory.
2. Update your `app.module.ts` imports to match the provided `src/app.module.ts`.

### 3. Add Environment Variables
Make sure your `.env` contains:
```env
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
S3_BUCKET_NAME=your-s3-bucket-name
MONGODB_URI=mongodb://localhost:27017/profiles-db
```
