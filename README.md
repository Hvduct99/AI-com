# NGŨ HÀNH CHIẾN — Game đối kháng 3D (Three.js + Vite)

Game đối kháng 2 người chơi trên 1 máy, đúng theo bản vẽ tay:
- HUD trên: tên + thanh máu (đỏ) + thanh năng lượng (xanh) mỗi bên
- HUD dưới: 4 skill slot, skill 4 (ultimate) TO NHẤT, viền vàng
- P1: `A/D` di chuyển + `Q/W/E/R` skill 1-4
- P2: `←/→` di chuyển + `U/I/O/P` skill 1-4
- 2 biên 2 bên: chạm biên mất máu + bị đẩy ra
- Ngũ hành khắc chế: Kim→Mộc→Thổ→Thủy→Hỏa→Kim (x1.5 dmg)
- Skill va chạm nhau trên không (triệt tiêu / ultimate phá đạn thường)
- Chọn nhân vật trước khi đánh
- Chế độ **Đấu Máy** (Dễ/Thường/Khó) — chơi 1 người, điện thoại có nút cảm ứng
- Đếm ngược 3-2-1, đồng hồ 99 giây (hết giờ: bên nhiều % máu hơn thắng), K.O. slow-motion
- `Esc`: tạm dừng (đánh lại / chọn tướng). Nút 🔊 bật/tắt âm thanh

## Asset (đều CC0 — dùng thương mại thoải mái)

- `public/models/RobotExpressive.glb` — Tomás Laulhé (Quaternius), chỉnh sửa bởi Don McCurdy (mẫu three.js). Nhuộm màu theo hệ, animation Idle/Walking/Punch/Death/Dance
- `public/textures/floor_*.jpg` — Poly Haven "Stone Tiles"
- Âm thanh: tổng hợp trực tiếp bằng WebAudio (`src/systems/AudioSystem.js`), không cần file
- Nếu model/texture tải lỗi, game tự dùng nhân vật procedural — vẫn chơi được

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

Lấy toàn bộ file trong `dist/` upload lên `public_html/` (File Manager hoặc FTP).
Xem chi tiết ở `DEPLOY_HOSTINGER.md`.

## Thay asset 3D sau này (đã thiết kế sẵn)

Mọi mesh đều đi qua `src/utils/AssetLoader.js`:

```js
import { registerAssets } from './src/utils/AssetLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
registerAssets({
  CharacterBuilder: (def) => {
    // return Group chứa model của bạn cho def.id / def.element
    // Ví dụ load 'assets/kim-linh.glb'
  },
  ProjectileBuilder: (skill, element) => { /* ... */ },
  ArenaBuilder: (width) => { /* { floor, grid, wallL, wallR } */ },
});
```

- Thêm nhân vật mới: thêm object vào `CHARACTERS` trong `src/config/characters.js`
- Cân bằng damage/khắc chế: sửa `src/config/elements.js`
- Luật biên (DPS, lực đẩy): sửa hằng số ở `src/entities/Arena.js`

## Cấu trúc

```
src/
  main.js               entry
  Game.js               vòng lặp trận đấu
  config/elements.js    ngũ hành + khắc chế
  config/characters.js  5 nhân vật + 4 skill mỗi người
  entities/Character.js võ sĩ (logic, không dính mesh cụ thể)
  entities/Skill.js     đạn projectile
  entities/Arena.js     sàn + 2 biên
  systems/InputSystem.js   phím QWER / UIOP
  systems/CombatSystem.js  va chạm, damage, knockback
  systems/EffectSystem.js  particle, chữ damage
  systems/AIController.js  AI đấu máy
  systems/AudioSystem.js   âm thanh WebAudio
  ui/HUD.js             máu/năng lượng/skill slot
  ui/CharacterSelect.js màn chọn tướng
  utils/AssetLoader.js  ĐIỂM THAY ASSET DUY NHẤT
```
