FROM node:20-alpine

WORKDIR /app

# Instalar dependencias nativas para PostgreSQL
RUN apk add --no-cache python3 make g++ postgresql-client

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/app.js"]
