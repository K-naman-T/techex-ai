# Build stage for React frontend
FROM oven/bun:latest AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install
COPY . .
# Vite build (will pick up environment variables if passed to Railway)
RUN bun run build

# Production stage
FROM oven/bun:latest
WORKDIR /app

# Copy lockfiles and package.json first for better caching
COPY package.json bun.lock* ./
RUN bun install --production

# Copy build artifacts and server source
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.ts ./

# Knowledge Base data
COPY data ./data

EXPOSE 3005
ENV PORT=3005
ENV NODE_ENV=production

CMD ["bun", "run", "server.ts"]
