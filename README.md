# NGŨ HÀNH CHIẾN — Game đối kháng 3D Tam Quốc (Three.js + Vite)

10 tướng Tam Quốc (6 tầm xa, 4 cận chiến), mỗi người một hệ ngũ hành, đánh nhau trên lôi đài trước cổng tam quan.

| Tướng | Hệ | Kiểu | Vũ khí | Tuyệt chiêu |
|---|---|---|---|---|
| Triệu Vân | Kim | Tầm xa | Long Đảm Ngân Thương | Long Đảm Phá Trận |
| Quan Vũ | Mộc | Tầm xa | Thanh Long Yển Nguyệt Đao | Thanh Long Yển Nguyệt |
| Gia Cát Lượng | Thủy | Tầm xa | Quạt lông vũ | Thủy Long Ngâm |
| Chu Du | Hỏa | Tầm xa | Trường kiếm | Xích Bích Hỏa Công |
| Trương Phi | Thổ | Tầm xa | Trượng Bát Xà Mâu | Đại Náo Trường Bản Kiều |
| Tôn Thượng Hương | Thủy | Tầm xa | Cung | Giang Đông Thần Tiễn |
| Lữ Bố | Hỏa | Cận chiến | Phương Thiên Họa Kích | Thiên Hạ Vô Song |
| Điển Vi | Thổ | Cận chiến | Đại phủ | Ác Lai Nộ |
| Mã Siêu | Kim | Cận chiến | Thương kỵ binh | Thần Uy Thiên Tướng |
| Hứa Chử | Mộc | Cận chiến | Đại đao | Hổ Vệ Thiên Quân |

Tướng cận chiến: chém tầm ngắn (~2-4 đơn vị), sát thương cao, hồi chiêu nhanh; chiêu 3 và
tuyệt chiêu lao tới. Nhát chém triệt tiêu được đạn thường của đối thủ.

## Điều khiển

| | Di chuyển | Nhảy | Đỡ | Chiêu 1-3 | Tuyệt chiêu |
|---|---|---|---|---|---|
| Player 1 | `A` `D` | `X` | `S` | `Q` `W` `E` | `R` |
| Player 2 | `←` `→` | `↑` | `↓` | `H` `J` `K` | `L` |

- Đấu Máy: dùng được cả hai bộ phím. Điện thoại có nút cảm ứng.
- `Esc`: tạm dừng. Nút 🔊: bật/tắt âm thanh.

## Luật

- Ngũ hành khắc chế: Kim→Mộc→Thổ→Thủy→Hỏa→Kim (+35% sát thương, bị khắc −15%)
- **Đỡ**: tốn 12 năng lượng, hồi chiêu 0.45s (dùng liên tục được nếu đủ năng lượng).
  Đỡ trúng chỉ mất 20% sát thương (tuyệt chiêu: 45%). Giơ khiên sát lúc trúng (≤0.18s) =
  **ĐỠ HOÀN HẢO**: không mất máu, hoàn 10 năng lượng. Đang đỡ thì đi chậm.
- **Năng lượng (nộ)**: hồi 7/giây, đánh trúng hoặc bị trúng cũng được cộng thêm.
- **Tuyệt chiêu** dùng được khi đạt **nửa thanh nộ** (50, có vạch vàng trên thanh), tốn 50;
  phá được đạn thường, xuyên qua người.
- **Nhảy**: né được đạn thường khi lên cao; nhảy qua đầu đối thủ được. Tuyệt chiêu to
  và nhát chém cận chiến thì khó né. Bắn lúc đang nhảy thì đạn chúc dần xuống.
- Đạn hai bên va nhau thì triệt tiêu. Đứng sát biên đỏ: mất máu + bị đẩy ra.
- 99 giây, hết giờ bên còn nhiều % máu hơn thắng.

## Asset (đều CC0 — dùng thương mại thoải mái)

- `public/models/heroes/*.glb` — bộ "RPG Characters" của Quaternius (quaternius.com,
  bản trên OpenGameArt), chuyển FBX → GLB và nhúng texture.
- `public/textures/floor_*.jpg` — Poly Haven "Stone Tiles"
- Vũ khí, cờ lưng (chữ 趙 關 周 張), cổng 三國五行, cờ 魏 蜀 吳 漢, đèn lồng,
  hiệu ứng chiêu: dựng bằng code trong `src/utils/AssetLoader.js`
- Âm thanh: tổng hợp bằng WebAudio (`src/systems/AudioSystem.js`), không cần file
- Nếu model/texture tải lỗi, game tự dùng nhân vật dựng sẵn — vẫn chơi được

## Chạy dev

```bash
npm install
npm run dev
```

Mở http://localhost:5173

## Build để up Hostinger

```bash
npm run build
```

Upload **toàn bộ nội dung** `dist/` lên `public_html/`, ghi đè `index.html` cũ.
Xem chi tiết ở `DEPLOY_HOSTINGER.md`.

## Tùy biến

- Thêm/sửa tướng: `CHARACTERS` trong `src/config/characters.js`
  (`model` = file trong `public/models/heroes/`, `weapon`, `tint`, `banner`)
- Thông số Đỡ / Nhảy / Năng lượng / chỉ số tầm xa & cận chiến: `BLOCK`, `JUMP`, `ENERGY`,
  `STYLE` trong `src/config/characters.js`
- Cân bằng khắc chế: `src/config/elements.js`
- Luật biên: hằng số trong `src/entities/Arena.js`

## Cấu trúc

```
src/
  main.js                  entry
  Game.js                  vòng lặp trận đấu, camera, đếm ngược, kết thúc
  config/elements.js       ngũ hành + khắc chế
  config/characters.js     5 tướng + 4 chiêu + thông số Đỡ
  entities/Character.js    tướng: animation, khiên, máu/năng lượng
  entities/Skill.js        đạn chiêu
  entities/Arena.js        lôi đài + 2 biên
  systems/InputSystem.js   bàn phím + nút cảm ứng
  systems/CombatSystem.js  va chạm, sát thương, Đỡ
  systems/EffectSystem.js  hạt, vòng sóng, cột sáng, chữ bay
  systems/AIController.js  AI đấu máy
  systems/AudioSystem.js   âm thanh WebAudio
  ui/HUD.js                máu/năng lượng/ô chiêu
  ui/CharacterSelect.js    màn chọn tướng
  utils/AssetLoader.js     model, vũ khí, hiệu ứng, phông nền
```
