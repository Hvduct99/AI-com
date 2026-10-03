// ============================================================
// Chinh Phạt — 10 ải đấu máy, khó dần (theo các trận đánh Tam Quốc).
//   ai     : độ khó AI 0 (dễ nhất) .. 1 (khó nhất)
//   hpMul  : nhân máu tướng địch
//   dmgMul : nhân sát thương tướng địch
//   alt    : tướng thay thế nếu người chơi chọn trùng tướng địch
// ============================================================

export const CAMPAIGN = [
  { name: 'Khăn Vàng Khởi Nghĩa', foe: 'truong-phi', alt: 'chu-du', ai: 0.0, hpMul: 0.8, dmgMul: 0.8 },
  { name: 'Hổ Lao Quan', foe: 'hua-chu', alt: 'dien-vi', ai: 0.12, hpMul: 0.85, dmgMul: 0.85 },
  { name: 'Đại Chiến Từ Châu', foe: 'ton-thuong-huong', alt: 'gia-cat-luong', ai: 0.24, hpMul: 0.9, dmgMul: 0.9 },
  { name: 'Quan Độ', foe: 'dien-vi', alt: 'hua-chu', ai: 0.36, hpMul: 0.95, dmgMul: 0.95 },
  { name: 'Trường Bản Pha', foe: 'trieu-van', alt: 'ma-sieu', ai: 0.48, hpMul: 1.0, dmgMul: 1.0 },
  { name: 'Xích Bích', foe: 'chu-du', alt: 'gia-cat-luong', ai: 0.6, hpMul: 1.05, dmgMul: 1.0 },
  { name: 'Đồng Quan', foe: 'ma-sieu', alt: 'trieu-van', ai: 0.7, hpMul: 1.1, dmgMul: 1.05 },
  { name: 'Phàn Thành', foe: 'quan-vu', alt: 'truong-phi', ai: 0.8, hpMul: 1.15, dmgMul: 1.1 },
  { name: 'Ngũ Trượng Nguyên', foe: 'gia-cat-luong', alt: 'ton-thuong-huong', ai: 0.9, hpMul: 1.2, dmgMul: 1.15 },
  { name: 'Thiên Hạ Vô Song', foe: 'lu-bo', alt: 'ma-sieu', ai: 1.0, hpMul: 1.5, dmgMul: 1.2, boss: true },
];

const STORAGE_KEY = 'ngu-hanh-campaign-v1';

/** Tiến độ: { unlocked: số ải đã mở (1..10), cleared: [index ải đã thắng] } */
export function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (raw && Number.isInteger(raw.unlocked) && Array.isArray(raw.cleared)) {
      return {
        unlocked: Math.min(CAMPAIGN.length, Math.max(1, raw.unlocked)),
        cleared: raw.cleared.filter((i) => Number.isInteger(i) && i >= 0 && i < CAMPAIGN.length),
      };
    }
  } catch { /* storage bị chặn / dữ liệu hỏng */ }
  return { unlocked: 1, cleared: [] };
}

export function saveProgress(progress) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch { /* bỏ qua */ }
}

/** Ghi nhận thắng ải `index` (0-based), mở ải kế. Trả về progress mới */
export function markCleared(progress, index) {
  const cleared = progress.cleared.includes(index) ? progress.cleared : [...progress.cleared, index];
  const unlocked = Math.min(CAMPAIGN.length, Math.max(progress.unlocked, index + 2));
  const next = { unlocked, cleared };
  saveProgress(next);
  return next;
}

/** Tướng địch của ải (tránh trùng tướng người chơi) */
export function foeFor(level, playerId) {
  return level.foe === playerId ? level.alt : level.foe;
}
