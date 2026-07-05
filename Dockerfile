# Single-container deploy (Railway / Fly.io / Render / any Docker host).
# Vercel doesn't use this file. See docs/09-deployment.md.
# Runtime needs DATABASE_URL set — the image has no embedded database.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
CMD ["npm", "start"]
