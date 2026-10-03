# Deploy lên Hostinger

## Cách nhanh nhất: upload 1 file zip

1. Build ở máy (nếu chưa có `upload-hostinger.zip` mới):
   ```bash
   npm run build
   ```
   rồi nén **nội dung bên trong** `dist/` thành zip (file `upload-hostinger.zip` ở thư mục gốc dự án
   là bản đã nén sẵn).
2. Hostinger → Websites → Manage → **File Manager** → vào `public_html/`.
3. **XÓA HẾT file cũ** trong `public_html/`: `index.html`, `assets/`, `models/`, `textures/`,
   và cả `package.json`, `vite.config.js` nếu lỡ upload (đó là file nguồn, không dùng trên host).
4. Upload `upload-hostinger.zip` vào `public_html/` → chuột phải → **Extract** → giải nén
   ngay trong `public_html/` → xóa file zip.
5. Kết quả phải đúng như sau:
   ```
   public_html/
   ├── index.html      (~5.5 KB — KHÔNG phải bản 2.4 KB cũ)
   ├── assets/         (2 file .js + 1 file .css)
   ├── models/heroes/  (6 file .glb)
   └── textures/       (2 file .jpg)
   ```
6. Mở tên miền → **Ctrl+F5**.

> `vite.config.js` để `base: './'` nên chạy được cả domain gốc lẫn thư mục con
> (vd `ten-mien.com/game/`) mà không cần sửa gì.

## Lỗi thường gặp

- **Trang trắng / chữ thường không có giao diện, console báo 404 `assets/index-xxxx.css`:**
  `index.html` trên host là bản CŨ, đang trỏ tới file css/js đã bị xóa.
  Mỗi lần build, tên file trong `assets/` đổi → phải upload **cả `index.html` mới** đè lên.
- Nhân vật hiện thành hình nhân đơn giản: thiếu thư mục `models/`.
- Sàn trơn màu: thiếu `textures/`.
- Vẫn thấy bản cũ: Ctrl+F5 hoặc mở tab ẩn danh.

## Test trước khi up

```bash
npm run dev      # dev: http://localhost:5173
npm run preview  # chạy thử đúng bản build trong dist/
```
