/* Shared data: brick types, abilities, and the nine town buildings. */

export const BRICK_TYPES = {
  '2x1':    { label: '2×1 Brick',    dims: [1.35, 0.58, 0.50], aspect: 2.32 },
  '1x1':    { label: '1×1 Brick',    dims: [0.62, 0.58, 0.50], aspect: 1.06 },
  '4x2':    { label: '4×2 Brick',    dims: [2.70, 1.16, 0.50], aspect: 2.32 },
  'roof':   { label: 'Roof Brick',   dims: [1.55, 0.36, 1.05], aspect: 1.48 },
  'window': { label: 'Window Brick', dims: [1.16, 1.08, 0.30], aspect: 1.06 },
};

// Build pieces (a brick shape + a named color) are referenced from a building's palette.
export const PALETTES = {
  cottage: {
    wall:     { type: '2x1', color: '#e05a4d', name: 'Terracotta' },
    wallDeep: { type: '2x1', color: '#c9473e', name: 'Brick Red' },
    trim:     { type: '2x1', color: '#f6e8d2', name: 'Cream' },
    roof:     { type: 'roof', color: '#5b485c', name: 'Plum' },
    glass:    { type: 'window', color: '#bfe9ef', name: 'Sky Glass' },
    accent:   { type: '1x1', color: '#f0b94e', name: 'Marigold' },
    base:     { type: '2x1', color: '#8b6d90', name: 'Mauve Stone' },
  },
  bakery: {
    wall:     { type: '2x1', color: '#f0b94e', name: 'Butter Yellow' },
    wallDeep: { type: '2x1', color: '#e3a73a', name: 'Honey' },
    trim:     { type: '2x1', color: '#fdf3df', name: 'Cream' },
    roof:     { type: 'roof', color: '#594057', name: 'Plum' },
    glass:    { type: 'window', color: '#c6edf1', name: 'Sky Glass' },
    accent:   { type: '1x1', color: '#e8866a', name: 'Peach' },
    base:     { type: '2x1', color: '#9a6fa2', name: 'Lilac Stone' },
  },
  cafe: {
    wall:     { type: '2x1', color: '#e58b63', name: 'Apricot' },
    wallDeep: { type: '2x1', color: '#d67a57', name: 'Toffee' },
    trim:     { type: '2x1', color: '#fbefdc', name: 'Cream' },
    roof:     { type: 'roof', color: '#5f4a5d', name: 'Plum' },
    glass:    { type: 'window', color: '#c8f0ea', name: 'Sky Glass' },
    accent:   { type: '1x1', color: '#75ad9d', name: 'Sage' },
    base:     { type: '2x1', color: '#9f7f96', name: 'Mauve Stone' },
  },
  library: {
    wall:     { type: '2x1', color: '#8793c9', name: 'Periwinkle' },
    wallDeep: { type: '2x1', color: '#7581b6', name: 'Dusk Blue' },
    trim:     { type: '2x1', color: '#f5e9d5', name: 'Parchment' },
    roof:     { type: 'roof', color: '#544560', name: 'Plum' },
    glass:    { type: 'window', color: '#c9edf3', name: 'Sky Glass' },
    accent:   { type: '1x1', color: '#e0a85c', name: 'Amber' },
    base:     { type: '2x1', color: '#88789e', name: 'Mauve Stone' },
  },
  market: {
    wall:     { type: '2x1', color: '#d96b7d', name: 'Rose' },
    wallDeep: { type: '2x1', color: '#c4586c', name: 'Berry' },
    trim:     { type: '2x1', color: '#f9ebd6', name: 'Cream' },
    roof:     { type: 'roof', color: '#cf5e52', name: 'Coral Roof' },
    roofAlt:  { type: 'roof', color: '#f4e1c4', name: 'Cream Roof' },
    glass:    { type: 'window', color: '#c5eeea', name: 'Sky Glass' },
    accent:   { type: '1x1', color: '#6b9f86', name: 'Sage' },
    base:     { type: '2x1', color: '#947a95', name: 'Mauve Stone' },
  },
  greenhouse: {
    wall:     { type: '2x1', color: '#8cb96b', name: 'Fern Green' },
    wallDeep: { type: '2x1', color: '#79a85c', name: 'Moss' },
    trim:     { type: '2x1', color: '#f1e6cf', name: 'Cream' },
    roof:     { type: 'roof', color: '#a9d7d0', name: 'Glass Roof' },
    glass:    { type: 'window', color: '#c7f1ec', name: 'Glass' },
    accent:   { type: '1x1', color: '#e8b15b', name: 'Marigold' },
    base:     { type: '2x1', color: '#9a879b', name: 'Stone' },
  },
  workshop: {
    wall:     { type: '2x1', color: '#4f9f9d', name: 'Teal' },
    wallDeep: { type: '2x1', color: '#408a89', name: 'Deep Teal' },
    trim:     { type: '2x1', color: '#f5e3c7', name: 'Cream' },
    roof:     { type: 'roof', color: '#664c5c', name: 'Plum' },
    glass:    { type: 'window', color: '#c3ecef', name: 'Sky Glass' },
    accent:   { type: '1x1', color: '#ea8e56', name: 'Orange' },
    base:     { type: '2x1', color: '#907e9a', name: 'Stone' },
  },
  chapel: {
    wall:     { type: '2x1', color: '#d9d0bc', name: 'Sandstone' },
    wallDeep: { type: '2x1', color: '#c7bda8', name: 'Warm Stone' },
    trim:     { type: '2x1', color: '#f3e8d3', name: 'Cream' },
    roof:     { type: 'roof', color: '#725c74', name: 'Heather' },
    glass:    { type: 'window', color: '#c9e9ef', name: 'Sky Glass' },
    accent:   { type: '1x1', color: '#caa65c', name: 'Brass' },
    base:     { type: '2x1', color: '#8d7b91', name: 'Stone' },
  },
  clocktower: {
    wall:     { type: '2x1', color: '#c7a17a', name: 'Sandstone' },
    wallDeep: { type: '2x1', color: '#b58d67', name: 'Clay' },
    trim:     { type: '2x1', color: '#f0e0c2', name: 'Cream' },
    roof:     { type: 'roof', color: '#5d4a62', name: 'Plum' },
    glass:    { type: 'window', color: '#c9edf2', name: 'Sky Glass' },
    accent:   { type: '1x1', color: '#8fb5a5', name: 'Patina' },
    base:     { type: '2x1', color: '#8b7793', name: 'Stone' },
  },
};

export const BUILDINGS = [
  {
    id: 'cottage', name: 'Red Cottage', sign: 'COTTAGE', angle: 110, order: 0,
    w: 6.6, d: 5.6, rows: 4, roof: 'gable', roofRise: 2.0, roofRows: 3,
    palette: 'cottage', style: 'cottage',
    desc: 'A little red house with a crooked chimney and room for a family of four.',
  },
  {
    id: 'cafe', name: 'Corner Café', sign: 'CAFÉ', angle: 70, order: 1,
    w: 6.8, d: 5.8, rows: 4, roof: 'gable', roofRise: 1.9, roofRows: 3,
    palette: 'cafe', style: 'cafe',
    desc: 'Warm apricot walls, a striped awning, and the best cinnamon buns in the valley.',
  },
  {
    id: 'library', name: 'Little Library', sign: 'LIBRARY', angle: 150, order: 2,
    w: 8.4, d: 6.6, rows: 5, roof: 'gable', roofRise: 2.2, roofRows: 3,
    palette: 'library', style: 'library',
    desc: 'Tall blue windows, a reading bench, and shelves that reach the rafters.',
  },
  {
    id: 'market', name: 'Market Hall', sign: 'MARKET', angle: 30, order: 3,
    w: 9.0, d: 6.8, rows: 4, roof: 'awning', roofRise: 1.5, roofRows: 2,
    palette: 'market', style: 'market',
    desc: 'A wide open hall full of flower stalls, fruit crates, and cheerful noise.',
  },
  {
    id: 'greenhouse', name: 'Greenhouse', sign: 'GREENHOUSE', angle: 190, order: 4,
    w: 6.8, d: 6.8, rows: 4, roof: 'glass', roofRise: 2.0, roofRows: 3,
    palette: 'greenhouse', style: 'greenhouse',
    desc: 'A pocket of summer in glass and green, with seedlings on every sill.',
  },
  {
    id: 'workshop', name: 'Workshop', sign: 'WORKSHOP', angle: -10, order: 5,
    w: 8.2, d: 7.0, rows: 4, roof: 'flat', roofRise: 1.2, roofRows: 2,
    palette: 'workshop', style: 'workshop',
    desc: 'Sawdust, teal paint, and a workbench that has seen a hundred little repairs.',
  },
  {
    id: 'bakery', name: 'Bakery', sign: 'BAKERY', angle: 230, order: 6,
    w: 7.8, d: 6.2, rows: 5, roof: 'gable', roofRise: 2.1, roofRows: 3,
    palette: 'bakery', style: 'bakery',
    desc: 'Butter-yellow bricks, purple stonework, and a chimney that never stops puffing.',
  },
  {
    id: 'chapel', name: 'Hillside Chapel', sign: 'CHAPEL', angle: -50, order: 7,
    w: 6.8, d: 8.2, rows: 6, roof: 'steep', roofRise: 3.1, roofRows: 4,
    palette: 'chapel', style: 'chapel',
    desc: 'A tall, quiet chapel with a steep roof and a bell that rings on the hour.',
  },
  {
    id: 'clocktower', name: 'Clock Tower Hall', sign: 'TOWN HALL', angle: -90, order: 8,
    w: 8.8, d: 7.4, rows: 7, roof: 'steep', roofRise: 2.8, roofRows: 4,
    palette: 'clocktower', style: 'clocktower',
    desc: 'The heart of Maple Hollow. Its clock stopped the day the storm came through.',
  },
];

// Ellipse the town is arranged on.
export const TOWN = {
  rx: 33,
  rz: 30.5,
  plazaR: 11,
  ringR: 24.2,
  ringWidth: 4.4,
  spawn: [0, 48.5],
};

export const ABILITIES = [
  {
    id: 'sprint', name: 'Sprint', key: 'Shift', need: 0,
    desc: 'Move faster with a spring in your step.',
    icon: 'sprint',
  },
  {
    id: 'doubleJump', name: 'Double Jump', key: 'Space', need: 1,
    desc: 'Jump once more in midair to reach taller walls.',
    icon: 'jump',
  },
  {
    id: 'magnet', name: 'Brick Magnet', key: 'X', need: 2,
    desc: 'Pull loose bricks from nearby piles straight into your arms.',
    icon: 'magnet',
  },
  {
    id: 'wheelbarrow', name: 'Wheelbarrow', key: '—', need: 3,
    desc: 'Carry 16 bricks at once instead of 10.',
    icon: 'barrow',
  },
  {
    id: 'continuous', name: 'Continuous Build', key: 'E', need: 4,
    desc: 'Hold E to keep placing bricks without tapping between each one.',
    icon: 'build',
  },
  {
    id: 'master', name: 'Master Builder', key: '—', need: 9,
    desc: 'A golden trowel, a 22-brick satchel, and the whole town cheering for you.',
    icon: 'star',
  },
];

export const ICONS = {
  sprint: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM10 8.5l3.4-1.1 1.8 4.3 3.3 1.1-.7 2-4.1-1.4-1.3-2.2-1.2 4.2 3 3.4-1.5 1.4-3.9-4.2 2.1-6.1-2.2 1.5-1.1 3.2-2-.6 1.3-4.2L10 8.5Z" fill="currentColor"/><path d="M4 19.5h5M2.5 22h7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" opacity=".65"/></svg>`,
  jump: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 6 9h3.5v5h5V9H18ZM4 20.5h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 12.5 12 9l3.5 3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  magnet: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4z" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/><path d="M4.5 4h5M14.5 4h5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M9 20.5h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".55"/></svg>`,
  barrow: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h3l2.2 9.5h8.6L19 8H7.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="19" r="2.2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M13 17h6M6 17l2.5-2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  build: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.7 3.6 5.7 5.7-2.4 2.4-1.7-1.7-5.5 5.5 1.3 1.3-2.3 2.3-3.3-3.3 2.3-2.3 1.3 1.3 5.5-5.5-1.7-1.7 2.4-2.4Z" fill="currentColor"/><path d="M3 21h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16.8 2.5 21.5 7.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  star: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.6 2.8 6 6.4.8-4.7 4.4 1.2 6.4-5.7-3.1-5.7 3.1 1.2-6.4L2.8 9.4l6.4-.8z" fill="currentColor"/></svg>`,
};

export const COLOR_NAMES = {};

export function formatNumber(n) {
  return n.toLocaleString('en-US');
}

export function brickKey(piece) {
  return `${piece.type}|${piece.color}|${piece.name}`;
}

export function keyInfo(key) {
  const [type, color, name] = key.split('|');
  return { type, color, name, def: BRICK_TYPES[type] || BRICK_TYPES['2x1'] };
}

export function shade(hex, amt) {
  const n = parseInt(hex.replace('#', ''), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) {
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
  } else {
    const f = 1 + amt;
    r = Math.round(r * f); g = Math.round(g * f); b = Math.round(b * f);
  }
  return `rgb(${r},${g},${b})`;
}

export function shadeHex(hex, amt) {
  const s = shade(hex, amt);
  const m = s.match(/\d+/g);
  return '#' + m.map(v => Number(v).toString(16).padStart(2, '0')).join('');
}
