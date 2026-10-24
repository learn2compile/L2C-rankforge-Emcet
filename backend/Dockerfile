FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
COPY migrations ./migrations
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "src/server.mjs"]
