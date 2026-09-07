FROM node:24.19-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24.19-alpine AS build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run prisma:generate && npm run build

FROM node:24.19-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional
COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/main.js"]
