FROM node:22-alpine AS base
WORKDIR /app

# --- install dependencies ---
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci

# --- build shared + api ---
FROM base AS build
ENV NODE_OPTIONS=--max-old-space-size=768
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN npm run build -w @vuekumi/shared
RUN npm run db:generate -w @vuekumi/api
RUN npm run build -w @vuekumi/api

# --- production image ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV STORAGE_DIR=/app/storage

RUN apk add --no-cache openssl libc6-compat
RUN mkdir -p /app/storage

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/src ./src
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/apps/api/package.json ./package.json
COPY --from=build /app/apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

RUN addgroup -S vuekumi && adduser -S vuekumi -G vuekumi \
  && chown -R vuekumi:vuekumi /app
USER vuekumi

ENTRYPOINT ["./docker-entrypoint.sh"]
