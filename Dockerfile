FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production=false

COPY tsconfig.json ./
COPY src/ src/

RUN npx tsc
RUN npm prune --production

EXPOSE 8080

CMD ["node", "dist/src/index.js"]
