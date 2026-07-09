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

# The LAN IP this cert should cover (browsers only grant mic access over https
# or localhost, so serving the IP over https is required for voice calls there).
ARG PUBLIC_HOST=127.0.0.1

# Self-signed TLS cert so the app can be served over https on the LAN IP. It's
# self-signed, so browsers show a one-time "proceed anyway" warning; once past
# it the origin is a secure context and the microphone (and thus calls) work.
RUN apk add --no-cache openssl \
 && mkdir -p /etc/nginx/certs \
 && openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
      -keyout /etc/nginx/certs/self.key -out /etc/nginx/certs/self.crt \
      -subj "/CN=chatsphere" \
      -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:${PUBLIC_HOST}"

# SPA-aware nginx config.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static assets from the build stage.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
