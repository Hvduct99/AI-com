// ============================================================
// Danh sách tướng (Tam Quốc). Mỗi tướng = 1 hệ ngũ hành + 4 chiêu + Đỡ.
// Muốn thêm tướng mới: thêm 1 object vào CHARACTERS.
//   model  : file public/models/heroes/<model>.glb
//   weapon : spear | glaive | fan | jian | serpent (vũ khí dựng sẵn)
//   tint   : nhân màu lên texture để thấy rõ hệ
//   banner : chữ Hán trên cờ lưng (null = không đeo cờ)
// ============================================================
import { ELEMENTS } from './elements.js';

// Sát thương gốc từ yếu -> mạnh (skill 4 = tuyệt chiêu)
const BASE_DAMAGE = [6, 10, 15, 30];
const BASE_COOLDOWN = [1.1, 2.6, 4.5, 9.0];
const BASE_SPEED = [11, 10, 8.5, 7];
const BASE_SIZE = [0.28, 0.38, 0.52, 0.85];
const BASE_ENERGY_GAIN = [8, 10, 12, 0]; // đánh trúng được hồi năng lượng

// Đỡ: tốn năng lượng, hồi chiêu rất nhanh (dùng được nhiều lần),
// đỡ trúng chỉ mất một phần nhỏ máu. Đỡ sát lúc trúng = HOÀN HẢO (0 sát thương).
export const BLOCK = {
  energyCost: 12,
  cooldown: 0.45,
  duration: 0.55,
  perfectWindow: 0.18,
  chip: 0.2,        // đạn thường xuyên qua khiên: còn 20% sát thương
  ultChip: 0.45,    // tuyệt chiêu: còn 45%
  perfectRefund: 10,
};

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
    energyCost: i === 3 ? 100 : 0,
  }));
}

export const CHARACTERS = [
  {
    id: 'trieu-van',
    name: 'Triệu Vân',
    title: 'Thường Sơn Triệu Tử Long',
    element: 'kim',
    icon: '🐉',
    model: 'warrior',
    weapon: 'spear',
    tint: 0xeef2ff,
    banner: '趙',
    maxHp: 300,
    moveSpeed: 5.2,
    desc: 'Ngân thương thần tốc, nhanh nhẹn nhất. Khắc Mộc.',
    skills: makeSkills('kim',
      ['Ngân Thương Đâm', 'Bách Điểu Triều Phụng', 'Thất Tiến Thất Xuất', 'Long Đảm Phá Trận'],
      ['🗡️', '🕊️', '⚔️', '🐉']),
  },
  {
    id: 'quan-vu',
    name: 'Quan Vũ',
    title: 'Võ Thánh — Mỹ Nhiêm Công',
    element: 'moc',
    icon: '🌙',
    model: 'monk',
    weapon: 'glaive',
    tint: 0xd2f2d0,
    banner: '關',
    maxHp: 340,
    moveSpeed: 4.2,
    desc: 'Thanh Long Yển Nguyệt Đao, trâu bò. Khắc Thổ.',
    skills: makeSkills('moc',
      ['Thanh Long Trảm', 'Yển Nguyệt Phong', 'Quá Ngũ Quan', 'Thanh Long Yển Nguyệt'],
      ['🌙', '🍃', '🏯', '🐲']),
  },
  {
    id: 'gia-cat-luong',
    name: 'Gia Cát Lượng',
    title: 'Ngọa Long tiên sinh',
    element: 'thuy',
    icon: '🪶',
    model: 'wizard',
    weapon: 'fan',
    tint: 0xd6e8ff,
    banner: null,
    maxHp: 310,
    moveSpeed: 4.8,
    desc: 'Quạt lông vũ, mưu lược, đạn bay nhanh. Khắc Hỏa.',
    skills: makeSkills('thuy',
      ['Thủy Tiễn', 'Bát Quái Trận', 'Mượn Gió Đông', 'Thủy Long Ngâm'],
      ['💧', '☯️', '🌀', '🌊']),
  },
  {
    id: 'chu-du',
    name: 'Chu Du',
    title: 'Đại Đô Đốc Đông Ngô',
    element: 'hoa',
    icon: '🔥',
    model: 'rogue',
    weapon: 'jian',
    tint: 0xffd6c8,
    banner: '周',
    maxHp: 320,
    moveSpeed: 4.6,
    desc: 'Hỏa công Xích Bích, sát thương bùng nổ. Khắc Kim.',
    skills: makeSkills('hoa',
      ['Hỏa Tiễn', 'Liên Hoàn Kế', 'Hỏa Thuyền', 'Xích Bích Hỏa Công'],
      ['🔥', '⛓️', '⛵', '☄️']),
  },
  {
    id: 'truong-phi',
    name: 'Trương Phi',
    title: 'Mãnh tướng Yên Nhân',
    element: 'tho',
    icon: '⛰️',
    model: 'cleric',
    weapon: 'serpent',
    tint: 0xd8c098,
    banner: '張',
    maxHp: 380,
    moveSpeed: 3.8,
    desc: 'Trượng Bát Xà Mâu, cứng nhất, đi chậm. Khắc Thủy.',
    skills: makeSkills('tho',
      ['Xà Mâu Đâm', 'Địa Chấn Quyền', 'Gầm Trường Bản', 'Đại Náo Trường Bản Kiều'],
      ['🐍', '👊', '🗣️', '⛰️']),
  },
];

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id);
}

export { ELEMENTS };
