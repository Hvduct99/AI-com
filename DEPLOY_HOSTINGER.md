# Deploy lên Hostinger (test + chơi thử)

## Cách 1: Kéo-thả qua File Manager (nhanh nhất, khuyên dùng)

1. Build ở máy bạn:
   ```bash
   npm install
   npm run build
   ```
2. Mở Hostinger → Websites → Manage → File Manager → vào `public_html/`
   (muốn để ở sub-folder ví dụ `ten-mien.com/game/` thì tạo folder `game/`).
3. Upload TOÀN BỘ nội dung trong `dist/` (gồm `index.html` + các folder `assets/`, `models/`, `textures/`)
   lên `public_html/` (giữ nguyên cấu trúc).
4. Mở tên miền → chọn tướng 2 bên → BẮT ĐẦU → chơi luôn.
   - P1: A/D + Q/W/E/R
   - P2: ←/→ + U/I/O/P

> `vite.config.js` đã để `base: './'` nên chạy được cả domain gốc
> lẫn sub-folder mà không cần sửa gì.

## Cách 2: Qua FTP

- Host: ftp.ten-mien-cua-ban.com (lấy ở Hosting → FTP Accounts)
- Upload nội dung `dist/` vào `public_html/`, chế độ Binary/Auto.

## Cách 3: Hostinger hỗ trợ Node (VPS/Business có SSH)

```bash
cd ~/public_html   # hoặc folder project
npm install
npm run build
cp -r dist/* public_html/
```

## Test trước khi up

```bash
npm run dev      # dev: http://localhost:5173
npm run preview  # preview bản build: vite preview dist
```

## Lỗi thường gặp

- Trắng trang / 404 assets: do upload thiếu folder `assets/` hoặc sai cấu trúc.
  Phải để `index.html` ngang hàng với `assets/`.
- Muốn deploy vào `/game/` mà dùng link tuyệt đối: giữ `base: './'`
  (đã config sẵn) là được.
- Cache cũ: Ctrl+F5 hoặc xóa cache / đổi tên file sau mỗi lần up.
