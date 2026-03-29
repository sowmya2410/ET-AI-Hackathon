/**
 * GCN D2C Fintech — In-Memory Vector DB
 *
 * Simulates ChromaDB / Pinecone with 15 past-run records.
 * Each record represents a previous campaign run:
 *   segment × product × channels × intent → persona + engagement outcome
 *
 * Used by Agent 2 (D2C Persona Matcher) via cosine-like similarity scoring.
 */

export const VECTOR_DB = [
  // ── Gen Z ────────────────────────────────────────────────────────────
  {
    id: 'r001',
    segment:  'Gen Z (18-25)',
    product:  'Personal Loan',
    channels: ['Instagram', 'Push Notification'],
    intent:   'Acquisition',
    persona:  'The Hustler',
    ctr:        0.087,
    conversion: 0.031,
  },
  {
    id: 'r002',
    segment:  'Gen Z (18-25)',
    product:  'Personal Loan',
    channels: ['YouTube Shorts', 'Instagram'],
    intent:   'Acquisition',
    persona:  'The Hustler',
    ctr:        0.112,
    conversion: 0.041,
  },
  {
    id: 'r003',
    segment:  'Gen Z (18-25)',
    product:  'UPI/Payments',
    channels: ['Instagram', 'WhatsApp'],
    intent:   'Feature Adoption',
    persona:  'The Hustler',
    ctr:        0.095,
    conversion: 0.052,
  },
  {
    id: 'r011',
    segment:  'Gen Z (18-25)',
    product:  'Credit Card',
    channels: ['Instagram', 'YouTube Shorts'],
    intent:   'Acquisition',
    persona:  'The Hustler',
    ctr:        0.091,
    conversion: 0.038,
  },
  {
    id: 'r015',
    segment:  'Gen Z (18-25)',
    product:  'UPI/Payments',
    channels: ['Instagram', 'Push Notification'],
    intent:   'Referral/Growth',
    persona:  'The Hustler',
    ctr:        0.103,
    conversion: 0.049,
  },

  // ── Millennial ───────────────────────────────────────────────────────
  {
    id: 'r004',
    segment:  'Millennial (26-38)',
    product:  'Personal Loan',
    channels: ['Blog', 'Email'],
    intent:   'Acquisition',
    persona:  'The Planner',
    ctr:        0.043,
    conversion: 0.028,
  },
  {
    id: 'r005',
    segment:  'Millennial (26-38)',
    product:  'Wallet/Savings',
    channels: ['Email', 'Push Notification'],
    intent:   'Retention',
    persona:  'The Advisor',
    ctr:        0.038,
    conversion: 0.019,
  },
  {
    id: 'r006',
    segment:  'Millennial (26-38)',
    product:  'Neo-bank',
    channels: ['Blog', 'Email', 'In-app Banner'],
    intent:   'Education',
    persona:  'The Planner',
    ctr:        0.051,
    conversion: 0.033,
  },
  {
    id: 'r010',
    segment:  'Millennial (26-38)',
    product:  'Wallet/Savings',
    channels: ['Blog', 'Push Notification'],
    intent:   'Education',
    persona:  'The Advisor',
    ctr:        0.044,
    conversion: 0.024,
  },
  {
    id: 'r014',
    segment:  'Millennial (26-38)',
    product:  'Insurance',
    channels: ['Email', 'Blog'],
    intent:   'Acquisition',
    persona:  'The Advisor',
    ctr:        0.029,
    conversion: 0.015,
  },

  // ── Bharat ───────────────────────────────────────────────────────────
  {
    id: 'r007',
    segment:  'Bharat (Tier 2/3 vernacular)',
    product:  'Personal Loan',
    channels: ['SMS', 'WhatsApp'],
    intent:   'Acquisition',
    persona:  'The Neighbour',
    ctr:        0.061,
    conversion: 0.022,
  },
  {
    id: 'r008',
    segment:  'Bharat (Tier 2/3 vernacular)',
    product:  'UPI/Payments',
    channels: ['SMS', 'IVR'],
    intent:   'Feature Adoption',
    persona:  'The Neighbour',
    ctr:        0.048,
    conversion: 0.018,
  },
  {
    id: 'r012',
    segment:  'Bharat (Tier 2/3 vernacular)',
    product:  'Education/FAQ',
    channels: ['WhatsApp', 'IVR'],
    intent:   'Education',
    persona:  'The Neighbour',
    ctr:        0.039,
    conversion: 0.014,
  },

  // ── Mixed / Grievance ────────────────────────────────────────────────
  {
    id: 'r009',
    segment:  'Mixed',
    product:  'Grievance',
    channels: ['Email', 'In-app Banner'],
    intent:   'Grievance',
    persona:  'The Trustee',
    ctr:        0.021,
    conversion: 0.011,
  },
  {
    id: 'r013',
    segment:  'Mixed',
    product:  'Grievance',
    channels: ['Email', 'In-app Banner'],
    intent:   'Grievance',
    persona:  'The Trustee',
    ctr:        0.018,
    conversion: 0.009,
  },
];

/**
 * All valid D2C persona names.
 * Must match the persona strings used in VECTOR_DB and ruleScore.
 */
export const PERSONAS = [
  'The Hustler',
  'The Planner',
  'The Neighbour',
  'The Advisor',
  'The Trustee',
];

/**
 * Example content briefs shown as quick-select chips in the UI.
 */
export const EXAMPLES = [
  'Launch campaign for a new instant personal loan — Rs.10,000 to Rs.5,00,000, 6-24 month tenure, APR 18-36%. Target young urban users aged 18-25 in metro cities. Channels: Instagram Reels and app push notifications. Goal: new user acquisition.',
  'Promote new UPI cashback feature — 2% cashback on first 5 transactions using UPI Lite. Target existing wallet users, 25-35 age group. Channels: WhatsApp broadcast and in-app banner. Goal: feature adoption and retention.',
  'Send loan repayment reminder to Bharat users in Tier 2/3 cities. Hindi language preferred. Channel: SMS only. Low-literacy-friendly format. Goal: reduce overdue EMI rate.',
  'Write a blog post explaining the difference between EMI and lump sum repayment for our neo-bank savings product. Target millennial investors 28-40. Channel: blog and email newsletter. Goal: customer education and trust building.',
  'Handle a complaint acknowledgement for a credit card dispute. Must reference RBI Ombudsman. All customer segments. Channels: email and in-app support chat. Goal: grievance resolution and trust.',
];
