# SyncKit Server - Production Dockerfile
# Multi-stage build for optimized image size

# Stage 1: Build
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build application
RUN bun build src/index.ts --outdir dist --target bun

# Stage 2: Production
FROM oven/bun:1-slim AS production

WORKDIR /app

# Install production dependencies only
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/wasm ./wasm

# Create non-root user
RUN addgroup --system --gid 1001 synckit && \
    adduser --system --uid 1001 --ingroup synckit synckit

# Change ownership
RUN chown -R synckit:synckit /app

# Switch to non-root user
USER synckit

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD bun run -e 'fetch("http://localhost:8080/health").then(r => r.ok ? process.exit(0) : process.exit(1))' || exit 1

# Start server
CMD ["bun", "run", "start"]
