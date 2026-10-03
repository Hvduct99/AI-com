// ============================================================
// Ngũ hành: config màu sắc, khắc chế, hệ số sát thương
// Muốn đổi cân bằng game chỉ cần sửa file này.
// ============================================================

export const ELEMENTS = {
  kim:  { id: 'kim',  name: 'Kim',  icon: '⚙️', color: 0xd7dde8, css: '#d7dde8', desc: 'Kim loại sắc bén' },
  moc:  { id: 'moc',  name: 'Mộc',  icon: '🌿', color: 0x2ecc71, css: '#2ecc71', desc: 'Cây cối sinh sôi' },
  thuy: { id: 'thuy', name: 'Thủy', icon: '💧', color: 0x3498db, css: '#3498db', desc: 'Nước chảy linh hoạt' },
  hoa:  { id: 'hoa',  name: 'Hỏa',  icon: '🔥', color: 0xe74c3c, css: '#e74c3c', desc: 'Lửa bùng nổ' },
  tho:  { id: 'tho',  name: 'Thổ',  icon: '🪨', color: 0xd9a441, css: '#d9a441', desc: 'Đất vững chắc' },
};

// Vòng tương khắc: attacker -> defender mà attacker khắc được
// Kim khắc Mộc, Mộc khắc Thổ, Thổ khắc Thủy, Thủy khắc Hỏa, Hỏa khắc Kim
export const COUNTER_MAP = {
  kim: 'moc',
  moc: 'tho',
  tho: 'thuy',
  thuy: 'hoa',
  hoa: 'kim',
};

export const COUNTER_BONUS = 1.35;   // đánh vào hệ bị khắc: +35% (nerf từ 50% cho đỡ sốc chết)
export const COUNTER_RESIST = 0.85;  // đánh vào hệ khắc mình: -15%

/**
 * Hệ số sát thương theo ngũ hành.
 * @param {string} atkElement - hệ của người đánh
 * @param {string} defElement - hệ của người bị đánh
 * @returns {{mult:number, counter:boolean, resisted:boolean}}
 */
export function getElementMultiplier(atkElement, defElement) {
  if (!atkElement || !defElement || atkElement === defElement) {
    return { mult: 1, counter: false, resisted: false };
  }
  if (COUNTER_MAP[atkElement] === defElement) {
    return { mult: COUNTER_BONUS, counter: true, resisted: false };
  }
  if (COUNTER_MAP[defElement] === atkElement) {
    return { mult: COUNTER_RESIST, counter: false, resisted: true };
  }
  return { mult: 1, counter: false, resisted: false };
}

export function counterHint(elementId) {
  const target = COUNTER_MAP[elementId];
  return `${ELEMENTS[elementId].name} khắc ${ELEMENTS[target].name}`;
}
