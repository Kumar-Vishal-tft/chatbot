# ─── Stage 1: Install Dependencies ──────────────────────────────────────────
FROM node:20-alpine AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine for why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# ─── Stage 2: Rebuild the Source Code ────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

# Declare build arguments so that NEXT_PUBLIC_ variables are inlined at build time
ARG NEXT_PUBLIC_GEMINI_API_KEY
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_APP_ENV

# Set them as environment variables during build execution
ENV NEXT_PUBLIC_GEMINI_API_KEY=$NEXT_PUBLIC_GEMINI_API_KEY
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV

RUN npm run build

# ─── Stage 3: Runner Stage ──────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

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
