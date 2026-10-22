export const stats = [
  { id: 'events', label: 'Campus events', value: '12', hint: 'This semester' },
  { id: 'waste', label: 'Waste logged', value: '186 kg', hint: 'Across all events' },
  { id: 'diverted', label: 'Diverted from landfill', value: '71%', hint: 'Recycled + composted' },
  { id: 'volunteers', label: 'Green volunteers', value: '48', hint: 'NSS and Eco Club' },
]

export const monthlyWaste = [
  { month: 'Jun', recyclable: 18, compost: 12, landfill: 14 },
  { month: 'Jul', recyclable: 24, compost: 16, landfill: 11 },
  { month: 'Aug', recyclable: 32, compost: 21, landfill: 9 },
  { month: 'Sep', recyclable: 28, compost: 19, landfill: 10 },
  { month: 'Oct', recyclable: 41, compost: 26, landfill: 8 },
]

export const wasteShare = [
  { name: 'Recyclable', value: 92, color: '#0f766e' },
  { name: 'Compost', value: 58, color: '#65a30d' },
  { name: 'Landfill', value: 36, color: '#a8a29e' },
]

export const diversionTrend = [
  { month: 'Jun', rate: 54 },
  { month: 'Jul', rate: 61 },
  { month: 'Aug', rate: 68 },
  { month: 'Sep', rate: 70 },
  { month: 'Oct', rate: 74 },
]

export const events = [
  {
    id: 1,
    name: 'SRIT Tech Fest',
    date: '15 Oct 2026',
    venue: 'Main Auditorium',
    attendees: 850,
    status: 'Upcoming',
    wasteKg: 42.5,
    category: 'Technical',
  },
  {
    id: 2,
    name: 'Green Campus Drive',
    date: '22 Oct 2026',
    venue: 'Central Lawn',
    attendees: 220,
    status: 'Upcoming',
    wasteKg: 8.2,
    category: 'Awareness',
  },
  {
    id: 3,
    name: 'Cultural Night',
    date: '5 Nov 2026',
    venue: 'Open Air Theatre',
    attendees: 1100,
    status: 'Planning',
    wasteKg: 61.0,
    category: 'Cultural',
  },
  {
    id: 4,
    name: 'NSS Orientation',
    date: '12 Sep 2026',
    venue: 'Seminar Hall A',
    attendees: 180,
    status: 'Completed',
    wasteKg: 6.4,
    category: 'Student Club',
  },
  {
    id: 5,
    name: 'Department Symposium',
    date: '28 Aug 2026',
    venue: 'CSE Block',
    attendees: 340,
    status: 'Completed',
    wasteKg: 19.8,
    category: 'Technical',
  },
  {
    id: 6,
    name: 'Food Fest',
    date: '4 Aug 2026',
    venue: 'Canteen Lawn',
    attendees: 640,
    status: 'Completed',
    wasteKg: 48.1,
    category: 'Cultural',
  },
]

export const alternatives = [
  {
    id: 1,
    insteadOf: 'Single-use plastic bottles',
    use: 'Refill stations and steel bottles',
    impact: 'Cuts plastic waste at large events',
    tip: 'Place water stations near the auditorium and canteen.',
  },
  {
    id: 2,
    insteadOf: 'Disposable plates and cups',
    use: 'Areka / steel / reusable crockery',
    impact: 'Reduces landfill after food stalls',
    tip: 'Ask stalls to serve in returnable plates with a small deposit.',
  },
  {
    id: 3,
    insteadOf: 'Flex banners',
    use: 'Cloth banners or digital screens',
    impact: 'Avoids PVC waste that is hard to recycle',
    tip: 'Reuse department cloth banners with changeable lettering.',
  },
  {
    id: 4,
    insteadOf: 'Plastic decorations',
    use: 'Paper, plants, and LED lighting',
    impact: 'Keeps cultural stages compostable or reusable',
    tip: 'NSS can collect potted plants after the event.',
  },
  {
    id: 5,
    insteadOf: 'Printed brochures',
    use: 'QR codes and campus WhatsApp groups',
    impact: 'Saves paper for registrations and schedules',
    tip: 'One printed emergency contact sheet is enough at the gate.',
  },
  {
    id: 6,
    insteadOf: 'Mixed waste bins',
    use: 'Colour-coded 3-bin sets',
    impact: 'Improves recycling and compost quality',
    tip: 'Put volunteer guides next to bins during peak hours.',
  },
]

export const reports = [
  { event: 'Food Fest', recyclable: 18.2, compost: 21.4, landfill: 8.5 },
  { event: 'Department Symposium', recyclable: 11.0, compost: 4.6, landfill: 4.2 },
  { event: 'NSS Orientation', recyclable: 3.1, compost: 2.0, landfill: 1.3 },
  { event: 'Independence Day', recyclable: 9.4, compost: 3.8, landfill: 5.1 },
  { event: 'Sports Meet', recyclable: 16.8, compost: 7.2, landfill: 9.0 },
]

export const predictionFactors = [
  { type: 'Technical', perPerson: 0.05 },
  { type: 'Cultural', perPerson: 0.08 },
  { type: 'Food', perPerson: 0.12 },
  { type: 'Awareness', perPerson: 0.03 },
  { type: 'Sports', perPerson: 0.07 },
  { type: 'Student Club', perPerson: 0.04 },
  { type: 'Campus', perPerson: 0.05 },
]

export const wasteCategories = [
  { id: 'organic', name: 'Organic', color: '#16a34a', bg: '#dcfce7', icon: '🌱', desc: 'Food waste, scraps, catering, floral' },
  { id: 'plastic', name: 'Plastic', color: '#0284c7', bg: '#e0f2fe', icon: '🥤', desc: 'Water bottles, cups, wraps, cutlery' },
  { id: 'paper', name: 'Paper', color: '#d97706', bg: '#fef3c7', icon: '📄', desc: 'Badges, brochures, flyers, cartons' },
  { id: 'electronic', name: 'Electronic', color: '#9333ea', bg: '#f3e8ff', icon: '🔌', desc: 'Cables, batteries, circuit demo scraps' },
  { id: 'other', name: 'Other / Landfill', color: '#64748b', bg: '#f1f5f9', icon: '🗑️', desc: 'Composite wraps, adhesive tape, mixed' },
]

export const baselineRates = {
  Technical: { organic: 0.015, plastic: 0.016, paper: 0.012, electronic: 0.006, other: 0.006 },
  Cultural: { organic: 0.028, plastic: 0.022, paper: 0.014, electronic: 0.002, other: 0.014 },
  Food: { organic: 0.065, plastic: 0.025, paper: 0.018, electronic: 0.001, other: 0.011 },
  Awareness: { organic: 0.008, plastic: 0.009, paper: 0.013, electronic: 0.001, other: 0.004 },
  Sports: { organic: 0.016, plastic: 0.032, paper: 0.005, electronic: 0.001, other: 0.011 },
  'Student Club': { organic: 0.012, plastic: 0.012, paper: 0.012, electronic: 0.003, other: 0.006 },
  Campus: { organic: 0.016, plastic: 0.015, paper: 0.010, electronic: 0.002, other: 0.007 },
}

export const defaultMeasures = [
  {
    id: 'reusable_cutlery',
    name: 'Reusable Dining Ware & Cutlery',
    summary: 'Switch from single-use plates to washable steel or areca leaf plates',
    description: 'Washable stainless steel or compostable areca plates; eliminates single-use plastic cutlery and thermocol.',
    target_stream: 'Plastic & Other',
    reductions: { plastic: 0.55, other: 0.35 },
  },
  {
    id: 'water_refill_stations',
    name: 'Water Refill Stations & BYOB',
    summary: 'Eliminate 200ml/500ml PET water bottles with chilled refill points',
    description: 'Deploy 20L water dispensers and encourage attendees to Bring Your Own Bottle (BYOB).',
    target_stream: 'Plastic',
    reductions: { plastic: 0.5 },
  },
  {
    id: 'digital_ticketing_materials',
    name: '100% Digital Passes & Collateral',
    summary: 'Digital QR badges, e-schedules, and softcopy handouts',
    description: 'Zero printed schedules or brochures; use dynamic web agendas and QR ticketing.',
    target_stream: 'Paper',
    reductions: { paper: 0.75 },
  },
  {
    id: 'food_waste_management',
    name: 'Food Composting & Surplus Rescue',
    summary: 'Campus composting pit for scraps + donation of untouched meals',
    description: 'Segregate food scraps for on-campus compost and donate surplus untouched meals to local shelters.',
    target_stream: 'Organic',
    reductions: { organic: 0.65 },
  },
  {
    id: 'zero_single_use_plastic_policy',
    name: 'Strict Zero Single-Use Plastic Policy',
    summary: 'Ban flex banners, plastic decor, glitter, and plastic wraps',
    description: 'Replace flex banners with cloth/digital LED screens; ban plastic decor and cling wrap.',
    target_stream: 'Plastic & Decor',
    reductions: { plastic: 0.4, other: 0.25 },
  },
  {
    id: 'e_waste_drop_point',
    name: 'E-Waste Bin & Hardware Lending',
    summary: 'Loaner cables, rechargeable battery packs, and salvage bin',
    description: 'Shared USB/HDMI cables, rechargeable batteries, and dedicated safe e-waste bins.',
    target_stream: 'Electronic',
    reductions: { electronic: 0.7 },
  },
]
