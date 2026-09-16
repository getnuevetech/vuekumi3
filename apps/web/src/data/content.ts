/* ------------------------------------------------------------------ */
/*  Vuekumi mock data layer.                                         */
/*  Replace these exports with API calls when wiring up a backend.     */
/* ------------------------------------------------------------------ */

export type License = 'free' | 'premium'

export interface Photographer {
  name: string
  handle: string
  location: string
  avatar: string
  photos: number
  downloads: number
  earnings: number
}

export interface Photo {
  id: string
  src: string
  title: string
  category: string
  country: string
  photographer: string // handle
  license: License
  price: number // premium price in USD, 0 for free
  downloads: number
  views: number
  likes: number
  tags: string[]
}

export const categories = [
  'All',
  'People',
  'Wildlife',
  'Landscape',
  'Urban',
  'Culture',
  'Food & Craft',
  'Coast',
  'Fashion',
  'Architecture',
] as const

export const photographers: Photographer[] = [
  { name: 'Amara Okafor', handle: 'amara-okafor', location: 'Lagos, Nigeria', avatar: '/images/avatars/basket-vendor.jpg', photos: 148, downloads: 92400, earnings: 4820 },
  { name: 'Thandiwe Nkosi', handle: 'thandiwe-nkosi', location: 'Cape Town, South Africa', avatar: '/images/avatars/portrait-botswana.jpg', photos: 203, downloads: 131800, earnings: 7115 },
  { name: 'Kofi Mensah', handle: 'kofi-mensah', location: 'Accra, Ghana', avatar: '/images/avatars/photographer-bw.jpg', photos: 97, downloads: 64100, earnings: 3340 },
  { name: 'Selam Tesfaye', handle: 'selam-tesfaye', location: 'Addis Ababa, Ethiopia', avatar: '/images/avatars/coffee-ceremony.jpg', photos: 121, downloads: 78900, earnings: 4280 },
  { name: 'Lekan Adeyemi', handle: 'lekan-adeyemi', location: 'Nairobi, Kenya', avatar: '/images/avatars/maasai-warriors.jpg', photos: 174, downloads: 110500, earnings: 5940 },
]

const P = '/images/photos'

export const photos: Photo[] = [
  { id: 'afr-001', src: `${P}/portrait-botswana.jpg`, title: 'Golden Hour, Orapa', category: 'People', country: 'Botswana', photographer: 'thandiwe-nkosi', license: 'premium', price: 12, downloads: 4821, views: 31200, likes: 982, tags: ['portrait', 'woman', 'natural light', 'editorial'] },
  { id: 'afr-002', src: `${P}/elephant-kilimanjaro.jpg`, title: 'Bull Elephant, Amboseli', category: 'Wildlife', country: 'Kenya', photographer: 'lekan-adeyemi', license: 'premium', price: 15, downloads: 6210, views: 44800, likes: 1430, tags: ['elephant', 'kilimanjaro', 'safari', 'savanna'] },
  { id: 'afr-003', src: `${P}/bo-kaap-street.jpg`, title: 'Bo-Kaap in Bloom', category: 'Urban', country: 'South Africa', photographer: 'thandiwe-nkosi', license: 'free', price: 0, downloads: 9840, views: 52100, likes: 1755, tags: ['cape town', 'colorful', 'street', 'houses'] },
  { id: 'afr-004', src: `${P}/lagos-market.jpg`, title: 'Umbrella Economy, Lagos Island', category: 'Urban', country: 'Nigeria', photographer: 'amara-okafor', license: 'free', price: 0, downloads: 7630, views: 41200, likes: 1280, tags: ['lagos', 'market', 'city', 'crowd'] },
  { id: 'afr-005', src: `${P}/camel-caravan.jpg`, title: 'Sahara Caravan at Dusk', category: 'Landscape', country: 'Morocco', photographer: 'selam-tesfaye', license: 'free', price: 0, downloads: 11250, views: 60400, likes: 2310, tags: ['desert', 'sahara', 'camels', 'dunes'] },
  { id: 'afr-006', src: `${P}/coffee-ceremony.jpg`, title: 'The Third Pour', category: 'Food & Craft', country: 'Ethiopia', photographer: 'selam-tesfaye', license: 'free', price: 0, downloads: 5420, views: 28700, likes: 890, tags: ['coffee', 'ceremony', 'tradition', 'jebena'] },
  { id: 'afr-007', src: `${P}/maasai-warriors.jpg`, title: 'Morans Under Kilimanjaro', category: 'Culture', country: 'Kenya', photographer: 'lekan-adeyemi', license: 'premium', price: 14, downloads: 3980, views: 24900, likes: 1104, tags: ['maasai', 'portrait', 'culture', 'savanna'] },
  { id: 'afr-008', src: `${P}/baobab-avenue.jpg`, title: 'Avenue of the Baobabs', category: 'Landscape', country: 'Madagascar', photographer: 'thandiwe-nkosi', license: 'free', price: 0, downloads: 13900, views: 78600, likes: 3420, tags: ['baobab', 'sunset', 'trees', 'landscape'] },
  { id: 'afr-009', src: `${P}/dancers-senegal.jpg`, title: 'Sabar in Motion', category: 'Culture', country: 'Senegal', photographer: 'amara-okafor', license: 'premium', price: 12, downloads: 2840, views: 17300, likes: 764, tags: ['dance', 'festival', 'performance', 'celebration'] },
  { id: 'afr-010', src: `${P}/dhow-zanzibar.jpg`, title: 'Dhow on the Turquoise', category: 'Coast', country: 'Tanzania', photographer: 'lekan-adeyemi', license: 'free', price: 0, downloads: 8710, views: 46800, likes: 1960, tags: ['zanzibar', 'ocean', 'boat', 'dhow'] },
  { id: 'afr-011', src: `${P}/fashion-portrait.jpg`, title: 'Knit Study, No. 4', category: 'Fashion', country: 'Nigeria', photographer: 'amara-okafor', license: 'premium', price: 18, downloads: 3210, views: 19800, likes: 1210, tags: ['fashion', 'editorial', 'model', 'studio'] },
  { id: 'afr-012', src: `${P}/sossusvlei.jpg`, title: 'Dead Vlei Sentinels', category: 'Landscape', country: 'Namibia', photographer: 'thandiwe-nkosi', license: 'free', price: 0, downloads: 10150, views: 55900, likes: 2780, tags: ['desert', 'dunes', 'namibia', 'minimal'] },
  { id: 'afr-013', src: `${P}/nairobi-dusk.jpg`, title: 'Nairobi at First Light Out', category: 'Urban', country: 'Kenya', photographer: 'lekan-adeyemi', license: 'free', price: 0, downloads: 6640, views: 33100, likes: 1050, tags: ['nairobi', 'skyline', 'dusk', 'city'] },
  { id: 'afr-014', src: `${P}/victoria-falls.jpg`, title: 'Mosi-oa-Tunya Rainbow', category: 'Landscape', country: 'Zimbabwe', photographer: 'thandiwe-nkosi', license: 'premium', price: 10, downloads: 4470, views: 27600, likes: 1340, tags: ['waterfall', 'rainbow', 'victoria falls', 'nature'] },
  { id: 'afr-015', src: `${P}/spice-vendor.jpg`, title: 'Pigments of Khan el-Khalili', category: 'Food & Craft', country: 'Egypt', photographer: 'selam-tesfaye', license: 'free', price: 0, downloads: 5980, views: 30400, likes: 1420, tags: ['spices', 'market', 'color', 'vendor'] },
  { id: 'afr-016', src: `${P}/lalibela.jpg`, title: 'Bet Giyorgis, Carved Down', category: 'Architecture', country: 'Ethiopia', photographer: 'selam-tesfaye', license: 'free', price: 0, downloads: 7230, views: 38200, likes: 1680, tags: ['church', 'rock-hewn', 'heritage', 'unesco'] },
  { id: 'afr-017', src: `${P}/basket-vendor.jpg`, title: 'The Basket Wall', category: 'Food & Craft', country: 'Ghana', photographer: 'kofi-mensah', license: 'free', price: 0, downloads: 4360, views: 22100, likes: 980, tags: ['craft', 'baskets', 'market', 'artisan'] },
  { id: 'afr-018', src: `${P}/elephants-serengeti.jpg`, title: 'Herd Under a Burning Sky', category: 'Wildlife', country: 'Tanzania', photographer: 'lekan-adeyemi', license: 'premium', price: 14, downloads: 5890, views: 36400, likes: 1750, tags: ['elephants', 'serengeti', 'sunset', 'herd'] },
  { id: 'afr-019', src: `${P}/textile-shop.jpg`, title: 'Wax Print Vault', category: 'Food & Craft', country: 'Ghana', photographer: 'kofi-mensah', license: 'free', price: 0, downloads: 5120, views: 26800, likes: 1310, tags: ['textiles', 'fabric', 'ankara', 'patterns'] },
  { id: 'afr-020', src: `${P}/baobab-reflection.jpg`, title: 'Mirrored Giants', category: 'Landscape', country: 'Madagascar', photographer: 'thandiwe-nkosi', license: 'premium', price: 16, downloads: 3840, views: 21500, likes: 1290, tags: ['baobab', 'reflection', 'sunset', 'water'] },
  { id: 'afr-021', src: `${P}/gelada-monkey.jpg`, title: 'Gelada at the Escarpment', category: 'Wildlife', country: 'Ethiopia', photographer: 'selam-tesfaye', license: 'free', price: 0, downloads: 4780, views: 25900, likes: 1180, tags: ['monkey', 'gelada', 'highlands', 'wildlife'] },
  { id: 'afr-022', src: `${P}/cable-car.jpg`, title: 'Ascending Table Mountain', category: 'Urban', country: 'South Africa', photographer: 'thandiwe-nkosi', license: 'free', price: 0, downloads: 6930, views: 35400, likes: 1520, tags: ['cape town', 'cable car', 'mountain', 'travel'] },
  { id: 'afr-023', src: `${P}/lagos-aerial.jpg`, title: 'Market Day from Above', category: 'Urban', country: 'Nigeria', photographer: 'amara-okafor', license: 'premium', price: 12, downloads: 3620, views: 19400, likes: 940, tags: ['lagos', 'aerial', 'market', 'street'] },
  { id: 'afr-024', src: `${P}/atlas-village.jpg`, title: 'High Atlas Terraces', category: 'Landscape', country: 'Morocco', photographer: 'selam-tesfaye', license: 'free', price: 0, downloads: 5610, views: 29300, likes: 1260, tags: ['atlas', 'mountains', 'village', 'morocco'] },
  { id: 'afr-025', src: `${P}/quiver-tree.jpg`, title: 'Quiver Tree Sunset', category: 'Landscape', country: 'Namibia', photographer: 'thandiwe-nkosi', license: 'free', price: 0, downloads: 4280, views: 23700, likes: 1090, tags: ['quiver tree', 'sunset', 'desert', 'silhouette'] },
  { id: 'afr-026', src: `${P}/nairobi-night.jpg`, title: 'Nairobi Electric', category: 'Urban', country: 'Kenya', photographer: 'lekan-adeyemi', license: 'premium', price: 11, downloads: 3940, views: 21800, likes: 1030, tags: ['nairobi', 'night', 'skyline', 'lights'] },
  { id: 'afr-027', src: `${P}/photographer-bw.jpg`, title: 'The Observer', category: 'People', country: 'Ghana', photographer: 'kofi-mensah', license: 'premium', price: 12, downloads: 6120, views: 31900, likes: 1480, tags: ['portrait', 'black and white', 'photographer', 'man'] },
  { id: 'afr-028', src: `${P}/elephants-herd.jpg`, title: 'The Long Walk, Amboseli', category: 'Wildlife', country: 'Kenya', photographer: 'lekan-adeyemi', license: 'free', price: 0, downloads: 8150, views: 44600, likes: 2140, tags: ['elephants', 'herd', 'amboseli', 'kilimanjaro'] },
  { id: 'afr-029', src: `${P}/cape-town-aerial.jpg`, title: "Lion's Head from the Cableway", category: 'Urban', country: 'South Africa', photographer: 'thandiwe-nkosi', license: 'free', price: 0, downloads: 5870, views: 30200, likes: 1370, tags: ['cape town', 'aerial', 'coast', 'mountain'] },
]

export const photoById = (id: string) => photos.find((p) => p.id === id)
export const photographerOf = (handle: string) => photographers.find((p) => p.handle === handle)!

/* ---------------- contributor portal mock data ---------------- */

export const contributorStats = {
  totalEarnings: 4820.4,
  thisMonth: 612.8,
  downloads: 92400,
  views: 412800,
  followers: 3210,
  approvalRate: 94,
}

export const earningsSeries = [
  { month: 'Mar', earnings: 388, downloads: 6200 },
  { month: 'Apr', earnings: 432, downloads: 7100 },
  { month: 'May', earnings: 401, downloads: 6800 },
  { month: 'Jun', earnings: 505, downloads: 8200 },
  { month: 'Jul', earnings: 561, downloads: 9100 },
  { month: 'Aug', earnings: 613, downloads: 9800 },
]

export const payoutHistory = [
  { id: 'PO-2408', date: '2026-08-01', method: 'Mobile Money (MTN)', amount: 561.2, status: 'paid' },
  { id: 'PO-2407', date: '2026-07-01', method: 'Mobile Money (MTN)', amount: 505.4, status: 'paid' },
  { id: 'PO-2406', date: '2026-06-01', method: 'Bank transfer (GTBank)', amount: 401.1, status: 'paid' },
  { id: 'PO-2405', date: '2026-05-01', method: 'Bank transfer (GTBank)', amount: 432.0, status: 'paid' },
  { id: 'PO-2409', date: '2026-09-01', method: 'Mobile Money (MTN)', amount: 612.8, status: 'processing' },
] as const

/* ---------------- admin portal mock data ---------------- */

export const adminStats = {
  users: 48210,
  contributors: 5940,
  photos: 212400,
  pendingReview: 342,
  revenueMonth: 86420,
  downloadsMonth: 1280000,
}

export const revenueSeries = [
  { month: 'Mar', revenue: 58200, payouts: 29100 },
  { month: 'Apr', revenue: 63100, payouts: 31550 },
  { month: 'May', revenue: 60800, payouts: 30400 },
  { month: 'Jun', revenue: 71400, payouts: 35700 },
  { month: 'Jul', revenue: 79900, payouts: 39950 },
  { month: 'Aug', revenue: 86400, payouts: 43200 },
]

export interface ModerationItem {
  id: string
  photoId: string
  flag: 'new submission' | 'quality review' | 'copyright check' | 'reported'
  submittedBy: string
  age: string
}

export const moderationQueue: ModerationItem[] = [
  { id: 'MOD-1042', photoId: 'afr-005', flag: 'new submission', submittedBy: 'selam-tesfaye', age: '12 min' },
  { id: 'MOD-1041', photoId: 'afr-019', flag: 'copyright check', submittedBy: 'kofi-mensah', age: '40 min' },
  { id: 'MOD-1039', photoId: 'afr-015', flag: 'quality review', submittedBy: 'selam-tesfaye', age: '2 h' },
  { id: 'MOD-1036', photoId: 'afr-023', flag: 'new submission', submittedBy: 'amara-okafor', age: '3 h' },
  { id: 'MOD-1031', photoId: 'afr-026', flag: 'reported', submittedBy: 'lekan-adeyemi', age: '6 h' },
]

export interface PlatformUser {
  id: string
  name: string
  email: string
  role: 'member' | 'contributor' | 'admin'
  country: string
  joined: string
  status: 'active' | 'suspended'
  downloads: number
}

export const platformUsers: PlatformUser[] = [
  { id: 'U-88214', name: 'Amara Okafor', email: 'amara@studioamara.ng', role: 'contributor', country: 'Nigeria', joined: '2023-02-11', status: 'active', downloads: 92400 },
  { id: 'U-77102', name: 'Thandiwe Nkosi', email: 'thandi@nkosi.photo', role: 'contributor', country: 'South Africa', joined: '2022-08-03', status: 'active', downloads: 131800 },
  { id: 'U-91045', name: 'Kofi Mensah', email: 'kofi.m@accramail.com', role: 'contributor', country: 'Ghana', joined: '2024-01-19', status: 'active', downloads: 64100 },
  { id: 'U-63390', name: 'Selam Tesfaye', email: 'selam.t@addispost.et', role: 'contributor', country: 'Ethiopia', joined: '2023-05-27', status: 'active', downloads: 78900 },
  { id: 'U-55871', name: 'Lekan Adeyemi', email: 'lekan@nairobframes.ke', role: 'contributor', country: 'Kenya', joined: '2022-11-08', status: 'active', downloads: 110500 },
  { id: 'U-99412', name: 'Zuri Hassan', email: 'zuri.h@daremail.tz', role: 'member', country: 'Tanzania', joined: '2025-04-14', status: 'active', downloads: 213 },
  { id: 'U-10083', name: 'Moussa Diallo', email: 'm.diallo@dakarhub.sn', role: 'member', country: 'Senegal', joined: '2024-09-30', status: 'suspended', downloads: 87 },
  { id: 'U-41208', name: 'Nia Kimaro', email: 'nia@arushapr.co.tz', role: 'member', country: 'Tanzania', joined: '2025-12-01', status: 'active', downloads: 1042 },
]

export const pendingPayouts = [
  { id: 'PO-2409', contributor: 'amara-okafor', method: 'Mobile Money (MTN)', amount: 612.8, requested: '2026-09-01' },
  { id: 'PO-2410', contributor: 'thandiwe-nkosi', method: 'Bank transfer (FNB)', amount: 902.4, requested: '2026-09-02' },
  { id: 'PO-2411', contributor: 'kofi-mensah', method: 'Mobile Money (Vodafone Cash)', amount: 388.6, requested: '2026-09-03' },
  { id: 'PO-2412', contributor: 'lekan-adeyemi', method: 'M-Pesa', amount: 734.1, requested: '2026-09-05' },
]

export { fmt, money } from '../lib/format'
