FROM node:18-alpine

# Cài đặt múi giờ (tuỳ chọn - nếu server cần múi giờ cụ thể thay vì UTC)
# RUN apk add --no-cache tzdata
# ENV TZ=Asia/Ho_Chi_Minh

WORKDIR /app

# Copy package.json và package-lock.json trước để tận dụng cache của Docker
COPY package*.json ./

# Cài đặt các thư viện (chỉ cài dependencies dùng cho production)
RUN npm ci --omit=dev

# Copy toàn bộ mã nguồn vào image
COPY . .

# Expose port (Backend đang dùng port 4000 theo file index.js)
EXPOSE 4000

# Chạy ứng dụng
CMD ["npm", "start"]
