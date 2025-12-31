FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

FROM node:20-alpine AS admin-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm install
COPY frontend ./frontend
RUN cd frontend && npm run build:admin

FROM node:20-alpine
RUN apk add --no-cache nginx
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY src ./src
COPY frontend/nginx.admin.conf /etc/nginx/conf.d/default.conf
COPY --from=admin-build /app/frontend/dist /usr/share/nginx/html
ENV NODE_ENV=production
EXPOSE 8080 80
CMD ["sh", "-c", "node src/index.js & nginx -g 'daemon off;'"]
