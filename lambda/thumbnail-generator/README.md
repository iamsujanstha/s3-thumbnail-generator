# Thumbnail Generator Lambda

Configure this Lambda with an S3 event notification:

- Event type: `s3:ObjectCreated:*`
- Prefix: `uploads/raw/`
- Suffix: empty, or restrict to image extensions if preferred

The handler downloads the original object, creates a 150x150 WebP thumbnail with `sharp`, and writes it to `uploads/thumbnails/{raw-filename}.webp`.

Deployment notes:

- Runtime: Node.js 20.x
- Architecture: `x86_64` or `arm64`, matching the packaged `sharp` binary
- IAM permissions: `s3:GetObject` on `uploads/raw/*` and `s3:PutObject` on `uploads/thumbnails/*`
