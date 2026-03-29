/**
 * GCN D2C Fintech — D2C Compliance Rule Database
 *
 * Used by Agent 4 (D2C Compliance Auditor).
 * Versioned flat rule list — mirrors the spec table from Section 7 of the GCN doc.
 *
 * Each rule has:
 *   id          — unique rule identifier
 *   regulator   — RBI | SEBI | TRAI | DPDPA | NPCI
 *   category    — short category label
 *   description — what the rule checks for
 *   severity    — BLOCK | FLAG
 *   action      — what happens on violation
 *   keywords    — trigger words/phrases for fast pre-scan
 *   circular    — regulatory circular reference (where applicable)
 */

export const COMPLIANCE_RULES = [
  // ── RBI — Lending fair practices ───────────────────────────────────────
  {
    id:          'RBI-LP-001',
    regulator:   'RBI',
    category:    'Lending — Fair Practices',
    description: 'No misleading APR; all processing fees and prepayment charges stated upfront',
    severity:    'BLOCK',
    action:      'Pipeline halts — misleading APR or undisclosed fee detected',
    keywords:    ['interest rate', 'apr', 'rate', 'fee', 'processing', 'prepayment', 'charge', 'cost', 'loan', 'emi'],
    circular:    'RBI/2015-16/101 DBOD.No.Dir.BC.10',
  },
  {
    id:          'RBI-LP-002',
    regulator:   'RBI',
    category:    'Lending — Fair Practices',
    description: 'No coercive language in loan recovery content',
    severity:    'BLOCK',
    action:      'Pipeline halts — coercive recovery language detected',
    keywords:    ['recover', 'seize', 'legal action', 'defaulter', 'arrest', 'police', 'court'],
    circular:    'RBI/2015-16/101 DBOD.No.Dir.BC.10',
  },
  {
    id:          'RBI-DL-001',
    regulator:   'RBI',
    category:    'Digital Lending',
    description: 'Loan disbursed only to borrower bank account; no third-party disbursement language',
    severity:    'BLOCK',
    action:      'Pipeline halts — third-party disbursement language detected',
    keywords:    ['disburse', 'transfer', 'wallet', 'third party', 'agent', 'cash'],
    circular:    'RBI/2022-23/111 DOR.CRE.REC.66/21.07.001/2022-23',
  },

  // ── SEBI — Investment / savings ────────────────────────────────────────
  {
    id:          'SEBI-INV-001',
    regulator:   'SEBI',
    category:    'Investment / Savings Nudge',
    description: "Prohibited: 'guaranteed returns', 'assured profit', 'beat the market' without mandatory caveats",
    severity:    'BLOCK',
    action:      'Pipeline halts — guaranteed return language detected',
    keywords:    ['guaranteed', 'assured', 'risk-free', 'no risk', 'certain return', 'fixed return',
                  'beat the market', 'assured profit', 'zero risk', '100% safe', 'safe returns'],
    circular:    'SEBI/HO/IMD/DF3/CIR/2020/225',
  },

  // ── TRAI / DLT — Promotional SMS ───────────────────────────────────────
  {
    id:          'TRAI-DLT-001',
    regulator:   'TRAI',
    category:    'Promotional SMS',
    description: 'Promotional SMS must include opt-out instruction (e.g. STOP SMS)',
    severity:    'BLOCK',
    action:      'SMS dispatch halted — missing opt-out instruction',
    keywords:    ['sms', 'text message', 'promotional'],
    circular:    'TRAI TCCCPR 2018',
    appliesTo:   ['SMS'],
  },
  {
    id:          'TRAI-DLT-002',
    regulator:   'TRAI',
    category:    'Promotional SMS',
    description: 'SMS message must not exceed 160 characters (DLT template limit)',
    severity:    'BLOCK',
    action:      'SMS dispatch halted — character limit exceeded',
    keywords:    [],
    circular:    'TRAI TCCCPR 2018',
    appliesTo:   ['SMS'],
    charLimit:   160,
  },

  // ── DPDPA 2023 — Data privacy ──────────────────────────────────────────
  {
    id:          'DPDPA-001',
    regulator:   'DPDPA',
    category:    'Data Privacy',
    description: 'PAN / Aadhaar number must not appear in plain text in any consumer message',
    severity:    'BLOCK',
    action:      'Pipeline halts — PAN or Aadhaar reference in plain text',
    keywords:    ['pan', 'aadhaar', 'aadhar', 'uid', 'national id'],
    circular:    'DPDPA 2023 Section 4',
  },
  {
    id:          'DPDPA-002',
    regulator:   'DPDPA',
    category:    'Data Privacy',
    description: 'Any reference to personal financial data must include consent language',
    severity:    'BLOCK',
    action:      'Pipeline halts — personal data reference without consent language',
    keywords:    ['your data', 'your information', 'credit score', 'financial data', 'transaction history'],
    circular:    'DPDPA 2023 Section 6',
  },

  // ── RBI — Grievance redressal ──────────────────────────────────────────
  {
    id:          'RBI-GR-001',
    regulator:   'RBI',
    category:    'Grievance Redressal',
    description: 'Any customer-facing credit content must reference RBI Banking Ombudsman details',
    severity:    'FLAG',
    action:      'Flag — inject RBI Ombudsman disclosure',
    keywords:    ['complaint', 'grievance', 'dispute', 'escalate', 'ombudsman', 'redressal'],
    circular:    'RBI/2021-22/117 CO.CEPD.PRD.No.S781/13-01-018/2021-22',
  },

  // ── NPCI — UPI communications ──────────────────────────────────────────
  {
    id:          'NPCI-UPI-001',
    regulator:   'NPCI',
    category:    'UPI Communications',
    description: 'No misleading cashback claim; UPI Lite / NFC feature claims must match NPCI approved specs',
    severity:    'FLAG',
    action:      'Flag — rewrite required; misleading UPI/cashback claim',
    keywords:    ['cashback', 'upi lite', 'nfc', 'tap to pay', 'instant cashback', 'earn cashback',
                  'get cashback', 'free money', 'upi reward'],
    circular:    'NPCI/UPI/OC No.14 2020',
  },
];

/**
 * Statutory disclosure text injected by Agent 5 (Disclosure Injection Agent).
 * Keyed by disclosure type. These are LOCKED — never paraphrased or shortened.
 */
export const DISCLOSURES = {
  APR_FEE_SCHEDULE: `[DISCLOSURE: Loan APR range 18%–36% p.a. Processing fee up to 2%. No prepayment penalty. All charges inclusive of GST. Loan subject to credit assessment and approval. T&C apply.]`,

  RBI_OMBUDSMAN: `[DISCLOSURE: For grievances unresolved within 30 days, contact RBI Banking Ombudsman: https://cms.rbi.org.in | Toll-free: 14448]`,

  TRAI_OPT_OUT: `[To unsubscribe, SMS STOP to 1909]`,

  SEBI_RISK_WARNING: `[DISCLOSURE: Investments are subject to market risks. Returns are not guaranteed. Read all scheme-related documents carefully before investing. SEBI-registered.]`,

  DPDPA_CONSENT: `[DISCLOSURE: Your data is processed per DPDPA 2023. You may withdraw consent at any time via Settings > Privacy.]`,

  NPCI_CASHBACK: `[DISCLOSURE: Cashback subject to NPCI UPI guidelines. T&C apply. Offer valid for limited period.]`,
};

/**
 * Persona-specific compliance thresholds.
 * Hustler content uses a STRICTER threshold — per GCN spec.
 * All other personas use standard.
 */
export const PERSONA_THRESHOLDS = {
  'The Hustler':   { strictMode: true,  blockOnFlag: false, maxWarnings: 1 },
  'The Planner':   { strictMode: false, blockOnFlag: false, maxWarnings: 3 },
  'The Neighbour': { strictMode: false, blockOnFlag: false, maxWarnings: 2 },
  'The Advisor':   { strictMode: false, blockOnFlag: false, maxWarnings: 2 },
  'The Trustee':   { strictMode: false, blockOnFlag: true,  maxWarnings: 0 },
};

/**
 * Content type → required disclosures mapping.
 * Agent 5 uses this to resolve [DISCLOSURE_PLACEHOLDER] tags.
 */
export const DISCLOSURE_MAP = {
  'Personal Loan':  ['APR_FEE_SCHEDULE', 'RBI_OMBUDSMAN'],
  'Credit Card':    ['APR_FEE_SCHEDULE', 'RBI_OMBUDSMAN'],
  'UPI/Payments':   ['NPCI_CASHBACK'],
  'Wallet/Savings': ['SEBI_RISK_WARNING'],
  'Insurance':      ['SEBI_RISK_WARNING'],
  'Neo-bank':       ['APR_FEE_SCHEDULE', 'SEBI_RISK_WARNING'],
  'Grievance':      ['RBI_OMBUDSMAN'],
  'Education/FAQ':  [],
};

/**
 * Channel-specific additional disclosures.
 */
export const CHANNEL_DISCLOSURE_MAP = {
  'SMS':        ['TRAI_OPT_OUT'],
  'WhatsApp':   [],
  'Email':      [],
  'Instagram':  [],
  'Blog':       [],
  'Push Notification': [],
  'In-app Banner':     [],
};
