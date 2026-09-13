export interface CountrySeed {
  code: string
  name: string
  currency: string
  currencyName: string
  region: 'africa' | 'americas' | 'europe' | 'asia' | 'oceania' | 'middle_east'
  contributorEligible: boolean
  sortOrder?: number
}

/** All 54 African Union member states — contributors must be from one of these. */
export const AFRICAN_COUNTRIES: CountrySeed[] = [
  { code: 'DZ', name: 'Algeria', currency: 'DZD', currencyName: 'Algerian Dinar', region: 'africa', contributorEligible: true },
  { code: 'AO', name: 'Angola', currency: 'AOA', currencyName: 'Angolan Kwanza', region: 'africa', contributorEligible: true },
  { code: 'BJ', name: 'Benin', currency: 'XOF', currencyName: 'West African CFA Franc', region: 'africa', contributorEligible: true },
  { code: 'BW', name: 'Botswana', currency: 'BWP', currencyName: 'Botswana Pula', region: 'africa', contributorEligible: true },
  { code: 'BF', name: 'Burkina Faso', currency: 'XOF', currencyName: 'West African CFA Franc', region: 'africa', contributorEligible: true },
  { code: 'BI', name: 'Burundi', currency: 'BIF', currencyName: 'Burundian Franc', region: 'africa', contributorEligible: true },
  { code: 'CV', name: 'Cabo Verde', currency: 'CVE', currencyName: 'Cape Verdean Escudo', region: 'africa', contributorEligible: true },
  { code: 'CM', name: 'Cameroon', currency: 'XAF', currencyName: 'Central African CFA Franc', region: 'africa', contributorEligible: true },
  { code: 'CF', name: 'Central African Republic', currency: 'XAF', currencyName: 'Central African CFA Franc', region: 'africa', contributorEligible: true },
  { code: 'TD', name: 'Chad', currency: 'XAF', currencyName: 'Central African CFA Franc', region: 'africa', contributorEligible: true },
  { code: 'KM', name: 'Comoros', currency: 'KMF', currencyName: 'Comorian Franc', region: 'africa', contributorEligible: true },
  { code: 'CG', name: 'Congo', currency: 'XAF', currencyName: 'Central African CFA Franc', region: 'africa', contributorEligible: true },
  { code: 'CD', name: 'DR Congo', currency: 'CDF', currencyName: 'Congolese Franc', region: 'africa', contributorEligible: true },
  { code: 'CI', name: "Côte d'Ivoire", currency: 'XOF', currencyName: 'West African CFA Franc', region: 'africa', contributorEligible: true },
  { code: 'DJ', name: 'Djibouti', currency: 'DJF', currencyName: 'Djiboutian Franc', region: 'africa', contributorEligible: true },
  { code: 'EG', name: 'Egypt', currency: 'EGP', currencyName: 'Egyptian Pound', region: 'africa', contributorEligible: true },
  { code: 'GQ', name: 'Equatorial Guinea', currency: 'XAF', currencyName: 'Central African CFA Franc', region: 'africa', contributorEligible: true },
  { code: 'ER', name: 'Eritrea', currency: 'ERN', currencyName: 'Eritrean Nakfa', region: 'africa', contributorEligible: true },
  { code: 'SZ', name: 'Eswatini', currency: 'SZL', currencyName: 'Swazi Lilangeni', region: 'africa', contributorEligible: true },
  { code: 'ET', name: 'Ethiopia', currency: 'ETB', currencyName: 'Ethiopian Birr', region: 'africa', contributorEligible: true },
  { code: 'GA', name: 'Gabon', currency: 'XAF', currencyName: 'Central African CFA Franc', region: 'africa', contributorEligible: true },
  { code: 'GM', name: 'Gambia', currency: 'GMD', currencyName: 'Gambian Dalasi', region: 'africa', contributorEligible: true },
  { code: 'GH', name: 'Ghana', currency: 'GHS', currencyName: 'Ghanaian Cedi', region: 'africa', contributorEligible: true },
  { code: 'GN', name: 'Guinea', currency: 'GNF', currencyName: 'Guinean Franc', region: 'africa', contributorEligible: true },
  { code: 'GW', name: 'Guinea-Bissau', currency: 'XOF', currencyName: 'West African CFA Franc', region: 'africa', contributorEligible: true },
  { code: 'KE', name: 'Kenya', currency: 'KES', currencyName: 'Kenyan Shilling', region: 'africa', contributorEligible: true },
  { code: 'LS', name: 'Lesotho', currency: 'LSL', currencyName: 'Lesotho Loti', region: 'africa', contributorEligible: true },
  { code: 'LR', name: 'Liberia', currency: 'LRD', currencyName: 'Liberian Dollar', region: 'africa', contributorEligible: true },
  { code: 'LY', name: 'Libya', currency: 'LYD', currencyName: 'Libyan Dinar', region: 'africa', contributorEligible: true },
  { code: 'MG', name: 'Madagascar', currency: 'MGA', currencyName: 'Malagasy Ariary', region: 'africa', contributorEligible: true },
  { code: 'MW', name: 'Malawi', currency: 'MWK', currencyName: 'Malawian Kwacha', region: 'africa', contributorEligible: true },
  { code: 'ML', name: 'Mali', currency: 'XOF', currencyName: 'West African CFA Franc', region: 'africa', contributorEligible: true },
  { code: 'MR', name: 'Mauritania', currency: 'MRU', currencyName: 'Mauritanian Ouguiya', region: 'africa', contributorEligible: true },
  { code: 'MU', name: 'Mauritius', currency: 'MUR', currencyName: 'Mauritian Rupee', region: 'africa', contributorEligible: true },
  { code: 'MA', name: 'Morocco', currency: 'MAD', currencyName: 'Moroccan Dirham', region: 'africa', contributorEligible: true },
  { code: 'MZ', name: 'Mozambique', currency: 'MZN', currencyName: 'Mozambican Metical', region: 'africa', contributorEligible: true },
  { code: 'NA', name: 'Namibia', currency: 'NAD', currencyName: 'Namibian Dollar', region: 'africa', contributorEligible: true },
  { code: 'NE', name: 'Niger', currency: 'XOF', currencyName: 'West African CFA Franc', region: 'africa', contributorEligible: true },
  { code: 'NG', name: 'Nigeria', currency: 'NGN', currencyName: 'Nigerian Naira', region: 'africa', contributorEligible: true },
  { code: 'RW', name: 'Rwanda', currency: 'RWF', currencyName: 'Rwandan Franc', region: 'africa', contributorEligible: true },
  { code: 'ST', name: 'São Tomé and Príncipe', currency: 'STN', currencyName: 'Dobra', region: 'africa', contributorEligible: true },
  { code: 'SN', name: 'Senegal', currency: 'XOF', currencyName: 'West African CFA Franc', region: 'africa', contributorEligible: true },
  { code: 'SC', name: 'Seychelles', currency: 'SCR', currencyName: 'Seychellois Rupee', region: 'africa', contributorEligible: true },
  { code: 'SL', name: 'Sierra Leone', currency: 'SLE', currencyName: 'Sierra Leonean Leone', region: 'africa', contributorEligible: true },
  { code: 'SO', name: 'Somalia', currency: 'SOS', currencyName: 'Somali Shilling', region: 'africa', contributorEligible: true },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', currencyName: 'South African Rand', region: 'africa', contributorEligible: true },
  { code: 'SS', name: 'South Sudan', currency: 'SSP', currencyName: 'South Sudanese Pound', region: 'africa', contributorEligible: true },
  { code: 'SD', name: 'Sudan', currency: 'SDG', currencyName: 'Sudanese Pound', region: 'africa', contributorEligible: true },
  { code: 'TZ', name: 'Tanzania', currency: 'TZS', currencyName: 'Tanzanian Shilling', region: 'africa', contributorEligible: true },
  { code: 'TG', name: 'Togo', currency: 'XOF', currencyName: 'West African CFA Franc', region: 'africa', contributorEligible: true },
  { code: 'TN', name: 'Tunisia', currency: 'TND', currencyName: 'Tunisian Dinar', region: 'africa', contributorEligible: true },
  { code: 'UG', name: 'Uganda', currency: 'UGX', currencyName: 'Ugandan Shilling', region: 'africa', contributorEligible: true },
  { code: 'ZM', name: 'Zambia', currency: 'ZMW', currencyName: 'Zambian Kwacha', region: 'africa', contributorEligible: true },
  { code: 'ZW', name: 'Zimbabwe', currency: 'ZWG', currencyName: 'Zimbabwe Gold', region: 'africa', contributorEligible: true },
]

/** Major buyer markets — pricing in local currency, contributors cannot register here. */
export const BUYER_COUNTRIES: CountrySeed[] = [
  { code: 'US', name: 'United States', currency: 'USD', currencyName: 'US Dollar', region: 'americas', contributorEligible: false, sortOrder: 1 },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', currencyName: 'British Pound', region: 'europe', contributorEligible: false },
  { code: 'CA', name: 'Canada', currency: 'CAD', currencyName: 'Canadian Dollar', region: 'americas', contributorEligible: false },
  { code: 'AU', name: 'Australia', currency: 'AUD', currencyName: 'Australian Dollar', region: 'oceania', contributorEligible: false },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD', currencyName: 'New Zealand Dollar', region: 'oceania', contributorEligible: false },
  { code: 'IE', name: 'Ireland', currency: 'EUR', currencyName: 'Euro', region: 'europe', contributorEligible: false },
  { code: 'FR', name: 'France', currency: 'EUR', currencyName: 'Euro', region: 'europe', contributorEligible: false },
  { code: 'DE', name: 'Germany', currency: 'EUR', currencyName: 'Euro', region: 'europe', contributorEligible: false },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', currencyName: 'Euro', region: 'europe', contributorEligible: false },
  { code: 'ES', name: 'Spain', currency: 'EUR', currencyName: 'Euro', region: 'europe', contributorEligible: false },
  { code: 'IT', name: 'Italy', currency: 'EUR', currencyName: 'Euro', region: 'europe', contributorEligible: false },
  { code: 'PT', name: 'Portugal', currency: 'EUR', currencyName: 'Euro', region: 'europe', contributorEligible: false },
  { code: 'BE', name: 'Belgium', currency: 'EUR', currencyName: 'Euro', region: 'europe', contributorEligible: false },
  { code: 'AT', name: 'Austria', currency: 'EUR', currencyName: 'Euro', region: 'europe', contributorEligible: false },
  { code: 'CH', name: 'Switzerland', currency: 'CHF', currencyName: 'Swiss Franc', region: 'europe', contributorEligible: false },
  { code: 'SE', name: 'Sweden', currency: 'SEK', currencyName: 'Swedish Krona', region: 'europe', contributorEligible: false },
  { code: 'NO', name: 'Norway', currency: 'NOK', currencyName: 'Norwegian Krone', region: 'europe', contributorEligible: false },
  { code: 'DK', name: 'Denmark', currency: 'DKK', currencyName: 'Danish Krone', region: 'europe', contributorEligible: false },
  { code: 'PL', name: 'Poland', currency: 'PLN', currencyName: 'Polish Zloty', region: 'europe', contributorEligible: false },
  { code: 'JP', name: 'Japan', currency: 'JPY', currencyName: 'Japanese Yen', region: 'asia', contributorEligible: false },
  { code: 'CN', name: 'China', currency: 'CNY', currencyName: 'Chinese Yuan', region: 'asia', contributorEligible: false },
  { code: 'IN', name: 'India', currency: 'INR', currencyName: 'Indian Rupee', region: 'asia', contributorEligible: false },
  { code: 'KR', name: 'South Korea', currency: 'KRW', currencyName: 'South Korean Won', region: 'asia', contributorEligible: false },
  { code: 'SG', name: 'Singapore', currency: 'SGD', currencyName: 'Singapore Dollar', region: 'asia', contributorEligible: false },
  { code: 'HK', name: 'Hong Kong', currency: 'HKD', currencyName: 'Hong Kong Dollar', region: 'asia', contributorEligible: false },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', currencyName: 'UAE Dirham', region: 'middle_east', contributorEligible: false },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', currencyName: 'Saudi Riyal', region: 'middle_east', contributorEligible: false },
  { code: 'QA', name: 'Qatar', currency: 'QAR', currencyName: 'Qatari Riyal', region: 'middle_east', contributorEligible: false },
  { code: 'IL', name: 'Israel', currency: 'ILS', currencyName: 'Israeli Shekel', region: 'middle_east', contributorEligible: false },
  { code: 'TR', name: 'Türkiye', currency: 'TRY', currencyName: 'Turkish Lira', region: 'europe', contributorEligible: false },
  { code: 'BR', name: 'Brazil', currency: 'BRL', currencyName: 'Brazilian Real', region: 'americas', contributorEligible: false },
  { code: 'MX', name: 'Mexico', currency: 'MXN', currencyName: 'Mexican Peso', region: 'americas', contributorEligible: false },
  { code: 'AR', name: 'Argentina', currency: 'ARS', currencyName: 'Argentine Peso', region: 'americas', contributorEligible: false },
  { code: 'CL', name: 'Chile', currency: 'CLP', currencyName: 'Chilean Peso', region: 'americas', contributorEligible: false },
  { code: 'CO', name: 'Colombia', currency: 'COP', currencyName: 'Colombian Peso', region: 'americas', contributorEligible: false },
]

export const ALL_COUNTRIES: CountrySeed[] = [...AFRICAN_COUNTRIES, ...BUYER_COUNTRIES]

export const DEFAULT_GATEWAYS = [
  { name: 'Flutterwave', slug: 'flutterwave', kind: 'both', countries: ['NG', 'GH', 'KE', 'ZA', 'UG', 'TZ', 'RW', 'ZM'], currencies: ['NGN', 'GHS', 'KES', 'ZAR', 'UGX', 'TZS', 'RWF', 'USD'], notes: 'Cards + mobile money across much of Africa' },
  { name: 'Paystack', slug: 'paystack', kind: 'both', countries: ['NG', 'GH', 'ZA', 'KE'], currencies: ['NGN', 'GHS', 'ZAR', 'KES', 'USD'], notes: 'Cards and transfers in West/Southern Africa' },
  { name: 'M-Pesa', slug: 'mpesa', kind: 'payout', countries: ['KE', 'TZ', 'GH'], currencies: ['KES', 'TZS', 'GHS'], notes: 'Safaricom / Vodacom mobile money payouts' },
  { name: 'MTN MoMo', slug: 'mtn-momo', kind: 'payout', countries: ['GH', 'UG', 'RW', 'ZM', 'CI', 'CM'], currencies: ['GHS', 'UGX', 'RWF', 'ZMW', 'XOF', 'XAF'], notes: 'MTN Mobile Money payouts' },
  { name: 'Airtel Money', slug: 'airtel-money', kind: 'payout', countries: ['KE', 'UG', 'TZ', 'RW', 'ZM', 'NG'], currencies: ['KES', 'UGX', 'TZS', 'RWF', 'ZMW', 'NGN'], notes: 'Airtel mobile money payouts' },
  { name: 'Orange Money', slug: 'orange-money', kind: 'payout', countries: ['SN', 'CI', 'ML', 'BF', 'CM', 'MG'], currencies: ['XOF', 'XAF', 'MGA'], notes: 'Orange Money payouts' },
  { name: 'Bank transfer', slug: 'bank-transfer', kind: 'payout', countries: [], currencies: [], notes: 'Manual / local bank rails — configure per country' },
  { name: 'Stripe', slug: 'stripe', kind: 'checkout', countries: [], currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'], notes: 'Global card checkout for buyers' },
]

export const DEFAULT_AI_PROVIDERS = [
  { name: 'OpenAI', slug: 'openai', purpose: 'vision', apiBaseUrl: 'https://api.openai.com/v1', notes: 'GPT-4o Vision — tags, quality, people detection' },
  { name: 'Replicate', slug: 'replicate', purpose: 'enhance', apiBaseUrl: 'https://api.replicate.com/v1', notes: 'Image enhancement and upscaling' },
]
