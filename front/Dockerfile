# Этап сборки:
# 1. Используйте образ Node.js для сборки статических файлов
FROM node:22.12.0 AS builder

# Установите рабочий каталог для сборки проекта
WORKDIR /app

# Копируйте файлы package.json и package-lock.json (или yarn.lock)
COPY package.json ./

COPY /docker/.ssh/id_ed25519 /root/.ssh/id_ed25519

RUN chmod 600 /root/.ssh/id_ed25519

COPY nginx.conf .
# Установите зависимости
RUN npm install

COPY . .
# Соберите приложение
RUN npm run build

# 2. Используйте образ Nginx для раздачи собранных файлов
FROM nginx:1.21

# Копируйте собранные файлы из этапа сборки в папку Nginx для статики
COPY --from=builder /app/dist /usr/share/nginx/html

# Предоставьте Nginx конфигурацию, если это необходимо
COPY --from=builder /app/nginx.conf /etc/nginx/nginx.conf