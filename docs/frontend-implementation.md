<style>
  code, pre, kbd, samp {
    font-family: 'Fira Code', ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
  }
</style>

# 💻 Frontend Integration Guide

This guide compares Next.js and ReactJS client upload structures, and provides blueprints for Vite React SPA proxy config, upload React hooks, and optimized image rendering components.

---

## 1. Next.js vs. ReactJS Frontend Implementations (Side-by-Side)

While Next.js provides hybrid (server/client) runtime rendering out of the box, ReactJS runs strictly as a Single Page Application (SPA) inside the client browser. 

| Architecture Dimension | 🌐 ReactJS (SPA) | ⚡ Next.js (Hybrid Framework) |
| :--- | :--- | :--- |
| **API Domain & Routing** | External API (e.g. `api.domain.com`). Needs explicit backend **CORS** configuration. | Local API path proxy (`/api/...`). Avoids CORS complications. |
| **Image Rendering** | Standard raw `<img>` tag. Optimization must be handled by CloudFront CDN or custom tools. | Built-in `<Image />` component. Performs on-the-fly resizing & lazy loading. |
| **Environment Variables** | Build-time injected (`VITE_API_URL` / `REACT_APP_`). No server-side runtime variables. | Both build-time public variables (`NEXT_PUBLIC_`) and runtime server variables. |
| **Local Dev Server Proxy** | Configured in `vite.config.ts` or `webpack.config.js`. | Configured in `next.config.js`. |

---

## 2. ReactJS SPA Implementation Blueprint (Vite-based)

### 1. Dev Server Proxy Configuration (`vite.config.ts`)
To prevent CORS blockers during local development, configure a proxy that routes client `/api` requests directly to your NestJS server.

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Path to NestJS backend
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
```

### 2. React Direct S3 Upload Hook (`useReactProfileUpload.ts`)
This React hook initiates pre-signing against the external NestJS API, PUTs the raw binary directly to S3, and saves metadata.

```typescript
// useReactProfileUpload.ts
import { useState, useRef, FormEvent } from 'react';

// Read API base URL from build-time configuration
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function useReactProfileUpload() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({ fullName: '', jobTitle: '', company: '' });
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'presigning' | 'uploading' | 'saving' | 'complete'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return setError('Please select an image first.');
    setError(null);
    setStatus('presigning');

    try {
      // 1. Fetch pre-signed PUT URL from NestJS backend
      const presignRes = await fetch(`${API_BASE}/s3/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!presignRes.ok) throw new Error('Failed to get presigned URL.');
      const { uploadUrl, imageKey } = await presignRes.json();

      // 2. Upload file binary directly to AWS S3
      setStatus('uploading');
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file, // Send raw file binary body
      });
      if (!uploadRes.ok) throw new Error('S3 direct upload failed.');

      // 3. Persist profile document to MongoDB via NestJS
      setStatus('saving');
      const profileRes = await fetch(`${API_BASE}/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, imageKey }),
      });
      if (!profileRes.ok) throw new Error('Failed to save profile details.');

      setStatus('complete');
      setFile(null);
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
      setStatus('idle');
    }
  };

  return { form, setForm, file, handleFileChange, fileInputRef, status, error, handleSubmit };
}
```

### 3. Optimized React Image Component with Async Fallbacks (`OptimizedImage.tsx`)
Unlike Next.js which has a built-in `<Image />` component, React uses standard HTML `<img>` tags. Since thumbnails are generated asynchronously in S3 by Lambda, the client should query the CloudFront CDN paths with fallback triggers.

```tsx
// OptimizedImage.tsx
import React, { useState } from 'react';

interface OptimizedImageProps {
  imageKey: string;
  alt: string;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({ imageKey, alt }) => {
  const CLOUDFRONT_URL = import.meta.env.VITE_CDN_URL || 'https://cdn.mycompany.com';
  
  // Point raw tag to CloudFront thumbnail path (processed asynchronously by Lambda)
  const thumbnailUrl = `${CLOUDFRONT_URL}/uploads/thumbnails/${imageKey.replace('uploads/raw/', '')}.webp`;
  const originalUrl = `${CLOUDFRONT_URL}/${imageKey}`;

  const [src, setSrc] = useState(thumbnailUrl);

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => {
        // If the optimized thumbnail doesn't exist yet (still processing in Lambda),
        // fallback to the original raw image URL temporarily
        if (src !== originalUrl) {
          setSrc(originalUrl);
        }
      }}
      style={{
        width: '150px',
        height: '150px',
        objectFit: 'cover',
        borderRadius: '50%',
        backgroundColor: '#e2e8f0',
      }}
    />
  );
};
```
