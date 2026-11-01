// Maps the server's English validation messages to Bengali for display. Unknown messages fall back to a generic Bengali line,
// so English text never reaches the screen. tests/errors-bn.test.js checks every server message has a rule.
const n = (x) => Number(x).toLocaleString("bn-BD", { useGrouping: false });
const RULES = [
  [/must be YYYY-MM-DD$/, () => "তারিখ ঠিক ফরম্যাটে (বছর-মাস-দিন) দিন।"],
  [/is not a valid date$/, () => "তারিখটি বৈধ নয়।"],
  [/^Start date cannot be in the future$/, () => "শুরুর তারিখ ভবিষ্যতের হতে পারে না।"],
  [/^End date cannot be before start date$/, () => "শেষ দিন প্রথম দিনের আগে হতে পারে না।"],
  [/^End date cannot be in the future$/, () => "শেষ দিন ভবিষ্যতের হতে পারে না।"],
  [/^Date cannot be in the future$/, () => "ভবিষ্যতের তারিখ দেওয়া যাবে না।"],
  [/^Period is longer than (\d+) days$/, (m) => "মাসিক " + n(m[1]) + " দিনের বেশি হতে পারে না। তারিখ আবার দেখুন।"],
  [/^Another period is already recorded within (\d+) days/, (m) => "এই তারিখের " + n(m[1]) + " দিনের মধ্যে আরেকটি মাসিক আগেই লগ করা আছে।"],
  [/^A log already exists for this date$/, () => "এই তারিখের জার্নাল আগেই আছে। সেটি সম্পাদনা করুন।"],
  [/is too long$/, () => "লেখাটি অনেক বড়, ছোট করুন।"],
  [/must be text$/, () => "এখানে শুধু লেখা দেওয়া যাবে।"],
  [/^Invalid flowLevel$/, () => "রক্তপাতের মান ঠিক নয়।"],
  [/^Invalid mood$/, () => "মেজাজের মান ঠিক নয়।"],
  [/^sleepHours must be 0-24$/, () => "ঘুমের সময় ০ থেকে ২৪ ঘণ্টার মধ্যে দিন।"],
  [/^symptoms must be a list/, () => "উপসর্গ সর্বোচ্চ ২০টি দেওয়া যাবে।"],
  [/^Empty symptom$/, () => "খালি উপসর্গ দেওয়া যাবে না।"],
  [/^Invalid timezone$/, () => "টাইমজোন ঠিক নয়।"],
  [/^Invalid language$/, () => "ভাষা ঠিক নয়।"],
  [/^cycleLengthDefault must be (\d+)-(\d+)$/, (m) => "সাধারণ চক্র " + n(m[1]) + " থেকে " + n(m[2]) + " দিনের মধ্যে দিন।"],
  [/^lutealLength must be (\d+)-(\d+)$/, (m) => "লুটিয়াল পর্যায় " + n(m[1]) + " থেকে " + n(m[2]) + " দিনের মধ্যে দিন।"],
  [/^Cycle length and luteal length are inconsistent$/, () => "চক্রের দৈর্ঘ্য আর লুটিয়াল পর্যায়ের দৈর্ঘ্য মিলছে না। দুটির পার্থক্য অন্তত ৬ দিন হতে হবে।"],
  [/^Invalid ageBand$/, () => "বয়সের পরিসর ঠিক নয়।"],
  [/^Confirmation required$/, () => "নিশ্চিত করা দরকার।"],
  [/^(limit|offset) must be/, () => "অনুরোধ ঠিক নয়।"],
  [/^(Invalid data|Invalid type|Invalid channel|enabled must be|maintenanceMode must be|daysBefore must be|Invalid policyVersion|Invalid consentTypes|Invalid userId|Invalid status)/, () => "দেওয়া তথ্য ঠিক নয়।"],
  [/is invalid$/, () => "দেওয়া তথ্য ঠিক নয়।"],
  [/^title and body are required$/, () => "শিরোনাম ও লেখা দুটিই দিন।"],
  [/^You cannot change your own status$/, () => "নিজের অবস্থা নিজে বদলানো যায় না।"],
];
export const GENERIC = "তথ্য গ্রহণ করা যায়নি। দেওয়া তথ্য আবার দেখে চেষ্টা করুন।";
export function bnMessage(en) {
  const s = String(en || "");
  for (const [re, f] of RULES) { const m = re.exec(s); if (m) return f(m); }
  return null;
}
export const displayMessage = (en) => bnMessage(en) || GENERIC;
