FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_BACKEND_URL=
ARG VITE_WS_URL=
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_WS_URL=$VITE_WS_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Copiar configuração para fallback de SPA (React Router)
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.d/19-validate-domain.sh /docker-entrypoint.d/19-validate-domain.sh
RUN chmod +x /docker-entrypoint.d/19-validate-domain.sh
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
