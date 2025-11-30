#!/bin/bash

# Dừng script ngay lập tức nếu có lỗi
set -e

echo "🚀 Bắt đầu khởi tạo template Nx (Angular + NestJS)..."
echo "---------------------------------------------------------"

# Bước 1: Lấy tên workspace từ người dùng
read -p "Tên workspace của bạn là gì? (ví dụ: my-monorepo): " WORKSPACE_NAME

# Kiểm tra nếu tên workspace bị trống
if [ -z "$WORKSPACE_NAME" ]; then
  echo "❌ Tên workspace không được để trống! Đã hủy."
  exit 1
fi

echo "---------------------------------------------------------"
echo "🔧 Đang tạo workspace: $WORKSPACE_NAME"
echo "(Sử dụng preset=ts và --workspaces=false để tương thích với Angular)"

# Bước 2: Tạo Nx Workspace
npx create-nx-workspace@latest "$WORKSPACE_NAME" --preset=ts --workspaces=false --skip-nx-cloud --no-interactive

# Di chuyển vào thư mục workspace vừa tạo
cd "$WORKSPACE_NAME"

echo "✅ Workspace $WORKSPACE_NAME đã được tạo."
echo "---------------------------------------------------------"

# Bước 3: Thêm NestJS
echo "📦 Đang cài đặt và cấu hình NestJS..."
npm install --save-dev @nx/nest
nx g @nx/nest:app --name=api --directory=apps/api --tags="scope:server,type:app" --no-interactive

echo "---------------------------------------------------------"

# Bước 4: Thêm Angular
echo "📦 Đang cài đặt và cấu hình Angular..."
npm install --save-dev @nx/angular
nx g @nx/angular:app --name=ng-app --directory=apps/ng-app --tags="scope:client,type:app" --e2eTestRunner=none --style=scss --no-interactive

echo "---------------------------------------------------------"

# Bước 5: Tạo Thư viện Chung (JS/TS)
echo "📚 Đang tạo thư viện chung 'data-types'..."
npm install --save-dev @nx/js
nx g @nx/js:library --name=data-types --directory=packages/shared/data-types --tags="scope:shared,type:lib" --no-interactive

echo "---------------------------------------------------------"

# Bước 6: Tạo Thư viện Data Access (Angular)
echo "📚 Đang tạo thư viện 'data-access' cho Angular..."
nx g @nx/angular:library --name=data-access --directory=packages/client/data-access --tags="scope:client,type:lib" --style=scss  --no-interactive

echo "---------------------------------------------------------"

# Bước 7: TỰ ĐỘNG TẠO FILE PROXY.CONF.JSON (ĐÃ SỬA)
echo "🔗 Đang tạo file 'apps/ng-app/proxy.conf.json'..."

cat <<EOF > apps/ng-app/proxy.conf.json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false,
    "logLevel": "debug"
  }
}
EOF

echo "✅ File 'proxy.conf.json' đã được tạo."
echo "---------------------------------------------------------"
echo "🎉 HOÀN TẤT (với 2 bước thủ công)!"
echo "---------------------------------------------------------"
echo ""
echo "‼️ YÊU CẦU HÀNH ĐỘNG THỦ CÔNG (2 BƯỚC) ‼️"
echo "Script đã tạo file 'proxy.conf.json', nhưng bạn cần kết nối nó với 'ng-app'."
echo ""
echo "👉 Mở file: ./$WORKSPACE_NAME/apps/ng-app/project.json"
echo ""
echo "1. Thêm 'proxyConfig' vào target 'serve' (trong 'options'):"
echo '
  "serve": {
    "executor": "@nx/angular:dev-server",
    "options": {
      "proxyConfig": "apps/ng-app/proxy.conf.json" <-- THÊM DÒNG NÀY
    },
'
echo ""
echo "2. Thêm 'dependsOn' vào target 'serve' (để tự động chạy API):"
echo '
  "serve": {
    ...
    "defaultConfiguration": "development",
    "dependsOn": [  <-- THÊM KHỐI NÀY
      {
        "target": "serve",
        "projects": "api"
      }
    ]
  },
'
echo ""
echo "Sau khi hoàn tất 2 bước trên, bạn có thể chạy:"
echo "nx serve ng-app"

# ulimit -n 10240 &&  ./init-nx-monorepo.sh