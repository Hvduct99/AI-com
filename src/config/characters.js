// ============================================================
// Danh sách nhân vật. Mỗi nhân vật = 1 hệ ngũ hành + 4 skill.
// Muốn thêm nhân vật mới: thêm 1 object vào CHARACTERS.
// Muốn thay asset 3D: xem utils/AssetLoader.js
// ============================================================
import { ELEMENTS } from './elements.js';

// Sát thương gốc từ yếu -> mạnh (skill 4 = ultimate)
// Đã cân bằng lại: TTK ~25-30s thay vì ~8s chết
const BASE_DAMAGE = [6, 10, 15, 30];
const BASE_COOLDOWN = [1.1, 2.6, 4.5, 9.0];
const BASE_SPEED = [11, 10, 8.5, 7];
const BASE_SIZE = [0.28, 0.38, 0.52, 0.85];
const BASE_ENERGY_GAIN = [8, 10, 12, 0]; // đánh trúng được hồi năng lượng

function makeSkills(elementId, names, icons) {
  return [0, 1, 2, 3].map((i) => ({
    index: i,
    name: names[i],
    icon: icons[i],
    element: elementId,
    damage: BASE_DAMAGE[i],
    cooldown: BASE_COOLDOWN[i],
    speed: BASE_SPEED[i],
    size: BASE_SIZE[i],
    energyGain: BASE_ENERGY_GAIN[i],
    isUltimate: i === 3,
    // ultimate yêu cầu đầy năng lượng, các skill thường không tốn
    energyCost: i === 3 ? 100 : 0,
  }));
}

export const CHARACTERS = [
  {
    id: 'kim-linh',
    name: 'Kim Linh',
    title: 'Kiếm Khí Sắc Bén',
    element: 'kim',
    icon: '⚙️',
    maxHp: 300,
    moveSpeed: 5.2,
    desc: 'Nhanh nhẹn, sát thương chuẩn. Khắc Mộc.',
    skills: makeSkills('kim',
      ['Phi Kiếm', 'Kiếm Vũ', 'Vạn Kiếm', 'Trảm Thiên Kiếm'],
      ['🗡️', '⚔️', '🌪️', '💥']),
  },
  {
    id: 'moc-tinh',
    name: 'Mộc Tinh',
    title: 'Rừng Già Sinh Sôi',
    element: 'moc',
    icon: '🌿',
    maxHp: 340,
    moveSpeed: 4.2,
    desc: 'Trâu bò, hồi năng lượng nhanh. Khắc Thổ.',
    skills: makeSkills('moc',
      ['Dây Leo', 'Gai Nhọn', 'Rừng Gai', 'Thần Thụ Giáng Lâm'],
      ['🌱', '🌵', '🌳', '💥']),
  },
  {
    id: 'thuy-co',
    name: 'Thủy Cơ',
    title: 'Sóng Nước Linh Hoạt',
    element: 'thuy',
    icon: '💧',
    maxHp: 320,
    moveSpeed: 4.8,
    desc: 'Cân bằng, đạn bay nhanh. Khắc Hỏa.',
    skills: makeSkills('thuy',
      ['Bọt Nước', 'Sóng Đẩy', 'Xoáy Nước', 'Hải Thần Nộ'],
      ['💦', '🌊', '🌀', '💥']),
  },
  {
    id: 'hoa-viem',
    name: 'Hỏa Viêm',
    title: 'Ngọn Lửa Bùng Nổ',
    element: 'hoa',
    icon: '🔥',
    maxHp: 320,
    moveSpeed: 4.6,
    desc: 'Sát thương cao nhất. Khắc Kim.',
    skills: makeSkills('hoa',
      ['Lửa Nhỏ', 'Cầu Lửa', 'Bão Lửa', 'Phượng Hoàng Lửa'],
      ['🔥', '☄️', '🌋', '💥']),
  },
  {
    id: 'tho-quai',
    name: 'Thổ Quái',
    title: 'Núi Đá Vững Chắc',
    element: 'tho',
    icon: '🪨',
    maxHp: 380,
    moveSpeed: 3.8,
    desc: 'Tank cứng nhất, đi chậm. Khắc Thủy.',
    skills: makeSkills('tho',
      ['Ném Đá', 'Cột Đất', 'Địa Chấn', 'Thái Sơn Áp Đỉnh'],
      ['🪨', '⛰️', '🌍', '💥']),
  },
];

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id);
}

export { ELEMENTS };
