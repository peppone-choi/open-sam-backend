# ==========================================
# Multi-stage build for OpenSAM Backend
# ==========================================

# Stage 1: Builder
FROM node:20-alpine AS builder

# Install build tools
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for TypeScript)
RUN npm ci --include=dev && \
    npm cache clean --force

# Copy source code
COPY . .

# Build TypeScript (use npx to ensure tsc is found)
RUN npx tsc

# ==========================================
# Stage 2: Runtime
# ==========================================

FROM node:20-alpine AS runtime

# Install curl for healthcheck
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start server
CMD ["npm", "run", "start"]
