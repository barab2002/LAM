FROM node:22-slim AS build
WORKDIR /srv
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim
WORKDIR /srv
ENV NODE_ENV=production
# openssl is required by Prisma's query engine
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=build /srv/dist ./dist

EXPOSE 4000
# Apply migrations, then serve
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
