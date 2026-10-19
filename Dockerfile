# Build container
FROM node:lts-alpine AS builder

# Use Workdir because things like tailwind will scan the entire current dir and can cause issues if it scans root
WORKDIR /app

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

ENV PNPM_HOME="~/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm i -g pnpm

RUN pnpm i --frozen-lockfile

COPY . ./
RUN pnpm prisma generate
RUN pnpm run build
ARG PREWARM_ROUTES=/
RUN rm -rf .cache/ipx \
  && PREWARM_ROUTES="$PREWARM_ROUTES" node scripts/prewarm-static-ipx.mjs


# Deployment container
FROM node:lts-alpine AS deployment
WORKDIR /app
COPY --from=builder /app/.output ./
COPY --from=builder /app/.cache/ipx ./.cache/ipx
EXPOSE 3000
CMD ["node", "./server/index.mjs"]
