FROM node:22-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

ARG DATABASE_URL="postgresql://clipflow:clipflow@localhost:5432/clipflow?schema=public"

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl gosu \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN DATABASE_URL="$DATABASE_URL" npx prisma generate && DATABASE_URL="$DATABASE_URL" npm run build

RUN mkdir -p /data/media \
  && chown -R node:node /app /data/media

COPY scripts/docker-entrypoint.sh /usr/local/bin/clipflow-entrypoint
RUN chmod 755 /usr/local/bin/clipflow-entrypoint

USER root
ENTRYPOINT ["/usr/local/bin/clipflow-entrypoint"]
EXPOSE 3000

CMD ["npm", "run", "start", "--", "-H", "0.0.0.0"]
