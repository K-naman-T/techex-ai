# Build stage for React frontend
FROM oven/bun:latest AS build
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY . .
RUN bun run build

# Production stage
FROM oven/bun:latest
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/server.ts ./

# Knowledge Base data
COPY data ./data

RUN bun install --production

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

CMD ["bun", "run", "server.ts"]
