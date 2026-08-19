FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY public ./public

RUN npx tsc -p tsconfig.json && npm prune --omit=dev

USER node
EXPOSE 8000

CMD ["node", "dist/server.js"]
