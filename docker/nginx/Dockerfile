FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_OPTIONS=--max-old-space-size=768

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
# typescript + vite are devDependencies — do not set NODE_ENV=production before this
RUN npm ci --include=dev

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN npm run build -w @vuekumi/shared
# Vite only — skip tsc typecheck in the image (it OOMs 1–2 GB Lightsail boxes)
ENV NODE_ENV=production
RUN npm exec -w @vuekumi/web -- vite build

FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY docker/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY docker/nginx/nginx.prod.conf /etc/nginx/conf.d/default.conf
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1
