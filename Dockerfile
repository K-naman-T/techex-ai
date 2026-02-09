# ===== Build Stage =====
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

# Install production dependencies
COPY package.json bun.lock* ./
RUN bun install --production --frozen-lockfile

# Copy pre-built frontend and server source
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.ts ./

# Copy Knowledge Base data
COPY data ./data

# Render assigns PORT dynamically
EXPOSE 10000
ENV NODE_ENV=production

CMD ["bun", "run", "server.ts"]
