# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/api-contracts/package.json packages/api-contracts/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY apps/api/prisma7.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/ packages/
COPY apps/web/ apps/web/
RUN pnpm --filter @repo/api-contracts build
RUN pnpm --filter web build

FROM nginx:1.27-alpine AS runner
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/docker-entrypoint.d/99-api-config.sh /docker-entrypoint.d/99-api-config.sh
COPY --from=build /app/apps/web/dist/web/browser /usr/share/nginx/html
RUN sed -i 's/\r$//' /docker-entrypoint.d/99-api-config.sh \
  && chmod +x /docker-entrypoint.d/99-api-config.sh

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=10s \
  CMD wget -qO- http://127.0.0.1/ > /dev/null || exit 1
