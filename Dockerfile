# ===== Build Stage =====
# Use a pinned Bun version for consistent builds
FROM oven/bun:1.1.38 AS build
WORKDIR /app

# Install dependencies first (for better layer caching)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source and build frontend
COPY . .
RUN bun run build


# ===== Production Stage =====
FROM oven/bun:1.1.38-slim
WORKDIR /app

# Use the built-in 'bun' non-root user for security
USER bun

# Copy only production dependencies manifest
COPY --chown=bun:bun package.json bun.lock* ./
RUN bun install --production --frozen-lockfile

# Copy pre-built frontend and server source
COPY --chown=bun:bun --from=build /app/dist ./dist
COPY --chown=bun:bun --from=build /app/server.ts ./

# Copy Knowledge Base data
COPY --chown=bun:bun data ./data

# Render assigns PORT dynamically. We expose a default for local testing.
EXPOSE 10000
ENV NODE_ENV=production

# Health check for Render
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl --fail http://localhost:${PORT:-10000}/ || exit 1

CMD ["bun", "run", "server.ts"]
