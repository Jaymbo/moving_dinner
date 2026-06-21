FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npx tsc prisma/seed.ts --outDir dist/prisma --esModuleInterop --module ESNext --moduleResolution node --target ES2022 --skipLibCheck --ignoreConfig --ignoreDeprecations:6.0

FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
RUN npx prisma generate --no-engine && npm cache clean --force
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/prisma/seed.js && node dist/index.js"]