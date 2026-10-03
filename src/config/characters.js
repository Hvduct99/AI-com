// ============================================================
// Danh sách tướng (Tam Quốc). Mỗi tướng = 1 hệ ngũ hành + 4 chiêu + Đỡ + Nhảy.
// Muốn thêm tướng mới: thêm 1 object vào CHARACTERS.
//   style  : 'ranged' (bắn xa) | 'melee' (cận chiến: chém tầm ngắn, sát thương cao)
//   model  : file public/models/heroes/<model>.glb
//   weapon : spear | glaive | fan | jian | serpent | halberd | lance | dao | null (giữ vũ khí gốc)
//   tint   : nhân màu lên texture để thấy rõ hệ
//   banner : chữ Hán trên cờ lưng (null = không đeo cờ)
// ============================================================
import { ELEMENTS } from './elements.js';

// Năng lượng (nộ)
export const ENERGY = {
  start: 30,
  regen: 7,          // hồi mỗi giây
  ultCost: 50,       // tuyệt chiêu chỉ cần nửa thanh nộ
  hitTaken: 8,       // bị đánh trúng cũng hồi chút để lật kèo
};

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

// Nhảy: né được đạn thường (đạn bay ngang tầm ngực), không né được tuyệt chiêu to
export const JUMP = {
  velocity: 14,
  gravity: 32,
};

const STYLE = {
  ranged: {
    damage: [6, 10, 15, 30],
    cooldown: [1.1, 2.6, 4.5, 9.0],
    speed: [11, 10, 8.5, 7],
    size: [0.28, 0.38, 0.52, 0.85],
    energyGain: [9, 11, 13, 0],
    range: [0, 0, 0, 0],      // 0 = bay đến hết sàn
    dash: [0, 0, 0, 0],
  },
  melee: {
    damage: [9, 14, 20, 36],
    cooldown: [0.7, 1.8, 3.6, 9.0],
    speed: [24, 22, 22, 24],
    size: [0.5, 0.6, 0.75, 1.0],
    energyGain: [11, 13, 15, 0],
    range: [2.2, 2.6, 3.0, 4.2], // chém tầm ngắn
    dash: [0, 0, 7, 13],         // chiêu 3 + tuyệt chiêu lao tới
  },
};

function makeSkills(elementId, style, names, icons) {
  const S = STYLE[style];
  return [0, 1, 2, 3].map((i) => ({
    index: i,
    name: names[i],
    icon: icons[i],
    element: elementId,
    melee: style === 'melee',
    damage: S.damage[i],
    cooldown: S.cooldown[i],
    speed: S.speed[i],
    size: S.size[i],
    energyGain: S.energyGain[i],
    range: S.range[i],
    dash: S.dash[i],
    isUltimate: i === 3,
    energyCost: i === 3 ? ENERGY.ultCost : 0,
  }));
}

export const CHARACTERS = [
  // ---------------- Tầm xa ----------------
  {
    id: 'trieu-van', name: 'Triệu Vân', title: 'Thường Sơn Triệu Tử Long',
    element: 'kim', style: 'ranged', icon: '🐉',
    model: 'warrior', weapon: 'spear', tint: 0xeef2ff, banner: '趙',
    maxHp: 300, moveSpeed: 5.2,
    desc: 'Ngân thương thần tốc, nhanh nhẹn. Khắc Mộc.',
    skills: makeSkills('kim', 'ranged',
      ['Ngân Thương Đâm', 'Bách Điểu Triều Phụng', 'Thất Tiến Thất Xuất', 'Long Đảm Phá Trận'],
      ['🗡️', '🕊️', '⚔️', '🐉']),
  },
  {
    id: 'quan-vu', name: 'Quan Vũ', title: 'Võ Thánh — Mỹ Nhiêm Công',
    element: 'moc', style: 'ranged', icon: '🌙',
    model: 'monk', weapon: 'glaive', tint: 0xd2f2d0, banner: '關',
    maxHp: 340, moveSpeed: 4.2,
    desc: 'Thanh Long Yển Nguyệt Đao, trâu bò. Khắc Thổ.',
    skills: makeSkills('moc', 'ranged',
      ['Thanh Long Trảm', 'Yển Nguyệt Phong', 'Quá Ngũ Quan', 'Thanh Long Yển Nguyệt'],
      ['🌙', '🍃', '🏯', '🐲']),
  },
  {
    id: 'gia-cat-luong', name: 'Gia Cát Lượng', title: 'Ngọa Long tiên sinh',
    element: 'thuy', style: 'ranged', icon: '🪶',
    model: 'wizard', weapon: 'fan', tint: 0xd6e8ff, banner: null,
    maxHp: 310, moveSpeed: 4.8,
    desc: 'Quạt lông vũ, mưu lược, đạn bay nhanh. Khắc Hỏa.',
    skills: makeSkills('thuy', 'ranged',
      ['Thủy Tiễn', 'Bát Quái Trận', 'Mượn Gió Đông', 'Thủy Long Ngâm'],
      ['💧', '☯️', '🌀', '🌊']),
  },
  {
    id: 'chu-du', name: 'Chu Du', title: 'Đại Đô Đốc Đông Ngô',
    element: 'hoa', style: 'ranged', icon: '🔥',
    model: 'rogue', weapon: 'jian', tint: 0xffd6c8, banner: '周',
    maxHp: 320, moveSpeed: 4.6,
    desc: 'Hỏa công Xích Bích, sát thương bùng nổ. Khắc Kim.',
    skills: makeSkills('hoa', 'ranged',
      ['Hỏa Tiễn', 'Liên Hoàn Kế', 'Hỏa Thuyền', 'Xích Bích Hỏa Công'],
      ['🔥', '⛓️', '⛵', '☄️']),
  },
  {
    id: 'truong-phi', name: 'Trương Phi', title: 'Mãnh tướng Yên Nhân',
    element: 'tho', style: 'ranged', icon: '⛰️',
    model: 'cleric', weapon: 'serpent', tint: 0xd8c098, banner: '張',
    maxHp: 380, moveSpeed: 3.8,
    desc: 'Trượng Bát Xà Mâu, cứng nhất, đi chậm. Khắc Thủy.',
    skills: makeSkills('tho', 'ranged',
      ['Xà Mâu Đâm', 'Địa Chấn Quyền', 'Gầm Trường Bản', 'Đại Náo Trường Bản Kiều'],
      ['🐍', '👊', '🗣️', '⛰️']),
  },
  {
    id: 'ton-thuong-huong', name: 'Tôn Thượng Hương', title: 'Cung Yêu Cơ Đông Ngô',
    element: 'thuy', style: 'ranged', icon: '🏹',
    model: 'ranger', weapon: null, tint: 0xd8f0ff, banner: '孫',
    maxHp: 290, moveSpeed: 5.4,
    desc: 'Cung thủ, chạy nhanh nhất, máu mỏng. Khắc Hỏa.',
    skills: makeSkills('thuy', 'ranged',
      ['Liên Tiễn', 'Hàn Băng Tiễn', 'Vạn Tiễn Tề Phát', 'Giang Đông Thần Tiễn'],
      ['🏹', '❄️', '🎯', '🌊']),
  },
  // ---------------- Cận chiến ----------------
  {
    id: 'lu-bo', name: 'Lữ Bố', title: 'Nhân trung Lữ Bố',
    element: 'hoa', style: 'melee', icon: '🔱',
    model: 'warrior', weapon: 'halberd', tint: 0xffb8a8, banner: '呂',
    maxHp: 340, moveSpeed: 5.0,
    desc: 'CẬN CHIẾN. Phương Thiên Họa Kích, mạnh nhất thiên hạ. Khắc Kim.',
    skills: makeSkills('hoa', 'melee',
      ['Họa Kích Trảm', 'Xích Thố Xung', 'Hổ Lao Quan', 'Thiên Hạ Vô Song'],
      ['🔱', '🐎', '🏰', '💥']),
  },
  {
    id: 'dien-vi', name: 'Điển Vi', title: 'Cổ Chi Ác Lai',
    element: 'tho', style: 'melee', icon: '🪓',
    model: 'monk', weapon: 'axes', tint: 0xc8a888, banner: '典',
    maxHp: 400, moveSpeed: 4.4,
    desc: 'CẬN CHIẾN. Song kích, máu trâu nhất. Khắc Thủy.',
    skills: makeSkills('tho', 'melee',
      ['Song Kích Bổ', 'Thiết Quyền', 'Uyển Thành Tử Chiến', 'Ác Lai Nộ'],
      ['🪓', '👊', '🛡️', '⛰️']),
  },
  {
    id: 'ma-sieu', name: 'Mã Siêu', title: 'Cẩm Mã Siêu',
    element: 'kim', style: 'melee', icon: '🐎',
    model: 'cleric', weapon: 'lance', tint: 0xe8eeff, banner: '馬',
    maxHp: 320, moveSpeed: 5.6,
    desc: 'CẬN CHIẾN. Ngân thương kỵ binh, lướt nhanh nhất. Khắc Mộc.',
    skills: makeSkills('kim', 'melee',
      ['Hổ Đầu Thương', 'Thiết Kỵ Xung', 'Tây Lương Phong', 'Thần Uy Thiên Tướng'],
      ['🐎', '⚡', '🌪️', '🐅']),
  },
  {
    id: 'hua-chu', name: 'Hứa Chử', title: 'Hổ Si',
    element: 'moc', style: 'melee', icon: '🐯',
    model: 'rogue', weapon: 'dao', tint: 0xc8e8b8, banner: '許',
    maxHp: 370, moveSpeed: 4.6,
    desc: 'CẬN CHIẾN. Đại đao, lì đòn. Khắc Thổ.',
    skills: makeSkills('moc', 'melee',
      ['Đại Đao Phách', 'Hổ Si Cuồng', 'Lõa Y Đấu Mã Siêu', 'Hổ Vệ Thiên Quân'],
      ['🔪', '🐯', '💪', '🌳']),
  },
];

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id);
}

export { ELEMENTS };
