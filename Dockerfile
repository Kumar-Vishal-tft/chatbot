# ─── Stage 1: Build the Source Code ─────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

# Copy package descriptors and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the source code
COPY . .

# Disable telemetry during the build
ENV NEXT_TELEMETRY_DISABLED=1

# Declare build arguments so that NEXT_PUBLIC_ variables are inlined at build time
ARG NEXT_PUBLIC_GEMINI_API_KEY
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_APP_ENV

# Set environment variables during build execution
ENV NEXT_PUBLIC_GEMINI_API_KEY=$NEXT_PUBLIC_GEMINI_API_KEY
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV

# Build Next.js (output standalone) offline using host's node_modules
RUN npm run build

# ─── Stage 2: Runner Stage ──────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create standard non-root group and user on Debian
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 -g nodejs nextjs

# Set correct permissions for static and cache files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# server.js is created by next build when using the output: 'standalone' option
CMD ["node", "server.js"]
