FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm install
COPY . .
RUN npx prisma generate

# URL para o build das páginas estáticas
ENV DATABASE_URL="postgresql://postgres:f1project@db:5432/f1-project-db"
RUN npm run build

# --- Estágio de Produção ---
FROM node:20-alpine AS runner
WORKDIR /app

# Copia as configurações necessárias (ajustado para .js)
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/prisma.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["node", "server.js"]