# syntax=docker/dockerfile:1

########################################
# Stage 1: build the Vite app
########################################
FROM node:22-alpine AS build

WORKDIR /app

# Build-time configuration (baked into the static bundle by Vite).
ARG VITE_API_BASE_URL=http://localhost:8080/api
ARG VITE_WS_URL=http://localhost:8080/ws
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_WS_URL=${VITE_WS_URL}

# Install deps first for better layer caching. No lockfile is committed,
# so we use `npm install` rather than `npm ci`.
COPY package.json ./
RUN npm install

# Copy the rest of the source and build.
COPY . .
RUN npm run build

########################################
# Stage 2: serve with nginx
########################################
FROM nginx:1.27-alpine AS serve

# SPA-aware nginx config.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static assets from the build stage.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
