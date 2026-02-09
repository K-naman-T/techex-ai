# ===== Build Stage =====
FROM oven/bun:1.1.38 AS build
WORKDIR /app

# Declare build arguments for Vite (Required for Render to pass them into the build stage)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_GEMINI_API_KEY
ARG VITE_SARVAM_API_KEY
ARG VITE_ELEVENLABS_API_KEY

# Set them as environment variables for the build process
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY
ENV VITE_SARVAM_API_KEY=$VITE_SARVAM_API_KEY
ENV VITE_ELEVENLABS_API_KEY=$VITE_ELEVENLABS_API_KEY

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
