# ===== Build Stage =====
FROM oven/bun:1.1.38 AS build
WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source and build frontend
COPY . .
RUN bun run build

# Install dependencies first (layer caching)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source and build frontend
COPY . .
RUN bun run build


# ===== Production Stage =====
FROM oven/bun:1.1.38-slim
WORKDIR /app

# Install production dependencies only
COPY package.json bun.lock* ./
RUN bun install --production --frozen-lockfile

# Copy pre-built frontend and server source
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.ts ./
COPY --from=build /app/src/lib ./src/lib
COPY --from=build /app/src/services ./src/services

# Copy Knowledge Base data
COPY data ./data

ENV NODE_ENV=production
EXPOSE 8080

CMD ["bun", "run", "server.ts"]
