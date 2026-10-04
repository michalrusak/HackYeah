# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/api-contracts/package.json packages/api-contracts/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY apps/api/prisma7.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/ packages/
COPY apps/api/ apps/api/
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm --filter @repo/api-contracts build
RUN pnpm --filter api exec prisma generate --config prisma7.config.ts
RUN pnpm --filter api build

FROM base AS runner
RUN apk add --no-cache wget
ENV NODE_ENV=production
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/api-contracts/package.json packages/api-contracts/
COPY packages/typescript-config/package.json packages/typescript-config/

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/api-contracts/dist ./packages/api-contracts/dist
COPY --from=build /app/packages/api-contracts/node_modules ./packages/api-contracts/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/prisma7.config.ts ./apps/api/
COPY apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh

RUN sed -i 's/\r$//' /app/apps/api/docker-entrypoint.sh \
  && chmod +x /app/apps/api/docker-entrypoint.sh

WORKDIR /app/apps/api
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=30s \
  CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null || exit 1

ENTRYPOINT ["/bin/sh", "/app/apps/api/docker-entrypoint.sh"]
