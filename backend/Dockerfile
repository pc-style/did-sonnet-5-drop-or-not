FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --include=dev
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
RUN npm install --omit=dev
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.js"]
