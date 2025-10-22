# syntax=docker/dockerfile:1.6
FROM node:20-bookworm-slim AS base

ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    dumb-init \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages packages
COPY data data
COPY samples samples
COPY apps/api apps/api

RUN pnpm install --filter @wxresume/api... --frozen-lockfile --prod=false \
  && pnpm --filter @wxresume/api... exec prisma generate

WORKDIR /app/apps/api

RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production

VOLUME ["/app/apps/api/prisma"]

EXPOSE 8080

ENTRYPOINT ["dumb-init", "--", "./docker-entrypoint.sh"]
