export const NOTICE = "এই তারিখগুলো ক্যালেন্ডারভিত্তিক অনুমান, নিশ্চিত ফলাফল নয়। প্রকৃত ডিম্বস্ফোটন আগে বা পরে হতে পারে। গর্ভাবস্থা, প্রসব-পরবর্তী সময়, বুকের দুধ খাওয়ানো, হরমোনাল জন্মনিয়ন্ত্রণ বা অনিয়মিত চক্রে হিসাব নির্ভরযোগ্য নাও হতে পারে। এটি গর্ভধারণ প্রতিরোধের নির্ভরযোগ্য পদ্ধতি নয়।";
export const WARN = {
  INSUFFICIENT_DATA: "ইতিহাস কম, তাই এখন ২৮ দিনের চক্র ধরা হয়েছে। আরও মাসিক লগ করলে হিসাব আপনার নিজের চক্র অনুযায়ী হবে।",
  IRREGULAR_CYCLES: "আপনার চক্রের দৈর্ঘ্যে অনেক ওঠানামা আছে, তাই পূর্বাভাস কম নির্ভরযোগ্য।",
  PERIOD_LATE: "মাসিক ৭ দিনের বেশি দেরি হয়েছে। মাসিক দেরি মানেই গর্ভাবস্থা নয়; চিন্তা হলে চিকিৎসকের পরামর্শ নিন।",
};
export const PHASE = { menstrual: "মাসিক পর্যায় (Menstrual)", follicular: "ফলিকুলার পর্যায় (Follicular)", ovulation: "ডিম্বস্ফোটন / উর্বর পর্যায় (Ovulation)", luteal: "লুটিয়াল পর্যায় (Luteal)", late: "মাসিক দেরি" };
export const FLOW = { "": "—", none: "নেই", light: "হালকা", medium: "মাঝারি", heavy: "বেশি" };
export const MOOD = { "": "—", good: "ভালো", neutral: "স্বাভাবিক", irritable: "খিটখিটে", low: "মন খারাপ" };
export const SYMPTOMS = { cramps: "পেটব্যথা/ক্র্যাম্প", headache: "মাথাব্যথা", backache: "পিঠব্যথা", bloating: "পেট ফাঁপা", fatigue: "ক্লান্তি", breast_tenderness: "স্তনে ব্যথা", nausea: "বমি বমি ভাব", acne: "ব্রণ",
  discharge_clear: "স্রাব: স্বচ্ছ", discharge_white: "স্রাব: সাদা", discharge_other: "স্রাব: অন্যরকম", energy_low: "শক্তি কম", energy_high: "শক্তি বেশি", sleep_poor: "ঘুম ভালো হয়নি" };
export const symLabel = (k) => SYMPTOMS[k] || k;
export const logSummary = (l) => [l.flowLevel && "রক্তপাত: " + FLOW[l.flowLevel], l.mood && "মেজাজ: " + MOOD[l.mood], l.sleepHours != null && "ঘুম: " + l.sleepHours + " ঘণ্টা", ...(l.symptoms || []).map(symLabel), l.notes].filter(Boolean).join(" · ");
