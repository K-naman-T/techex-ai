# ===== Build Stage =====
FROM oven/bun:1.1.38 AS build
WORKDIR /app

# Only frontend env vars needed at build time (Supabase client in React)
# Backend secrets (Gemini, Sarvam, ElevenLabs) are injected at RUNTIME only.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

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

# Copy Knowledge Base data
COPY data ./data

ENV NODE_ENV=production
# Cloud Run uses 8080 by default; Render uses PORT env var
EXPOSE 8080

CMD ["bun", "run", "server.ts"]
