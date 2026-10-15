FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY web/package.json web/package.json
RUN npm ci
COPY shared shared
COPY web web
RUN npm --workspace web run build

FROM caddy:2.10.2
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/web/dist /srv
