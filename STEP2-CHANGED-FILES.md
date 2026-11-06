# ধাপ ২ আপডেট: কোন ফাইল কোথায় বসবে

মোট ১৭টি ফাইল (এই জিপে)। `worker/wrangler.toml` জিপে দিইনি, কারণ আপনারটিতে আপনার আসল মান আছে। নিচে ঠিক কোন লাইন যোগ করবেন লেখা আছে। **ফ্রন্টএন্ড (HTML, CSS, JS) বদলায়নি, GitHub/Netlify-তে কিছু করতে হবে না** (শুধু docs/tests চাইলে রিপোতে রাখতে পারেন)।

## ক) Apps Script (৫টি ফাইল, স্কিমা বদলায়নি)
script.google.com-এ একই নামের ফাইলের লেখা বদলান:
`Code.gs`, `Config.gs`, `DatabaseService.gs`, `ReminderService.gs`, `Setup.gs`

তারপর **Deploy → Manage deployments → ✏️ → Version: New version → Deploy।** `initializeDatabase()` আবার চালাতে হবে না।

## খ) Worker (৩টি ফাইল)
আপনার কম্পিউটারের `worker/src/`-এর এই তিনটি ফাইল জিপের ফাইল দিয়ে বদলান: `index.js`, `session.js`, `crypto.js`

(ঐচ্ছিক, প্রস্তাবিত) আপনার `worker/wrangler.toml`-এর **শেষে** এই তিনটি ব্লক যোগ করুন। Wrangler ৪.৩৬+ লাগে, আপনারটি ৪.১৫৫:

```toml
[[ratelimits]]
name = "RL_NONCE"
namespace_id = "1001"
  [ratelimits.simple]
  limit = 20
  period = 60

[[ratelimits]]
name = "RL_LOGIN"
namespace_id = "1002"
  [ratelimits.simple]
  limit = 5
  period = 60

[[ratelimits]]
name = "RL_API"
namespace_id = "1003"
  [ratelimits.simple]
  limit = 120
  period = 60
```

তারপর:
```
cd ~/Documents/womens-health-tracker/worker
npx wrangler deploy
```
ডিপ্লয়ে ত্রুটি এলে (বিশেষ করে `ratelimits` নিয়ে) ওই তিনটি ব্লক মুছে আবার ডিপ্লয় করুন। Worker তখন আগের মতো চলবে। **ডিপ্লয়ের পর লগইন পেজ একবার রিফ্রেশ করুন**, পুরোনো Worker-এর দেওয়া nonce অচল হয়ে যায়।

## গ) কী বদলেছে
1. **স্বাক্ষর-করা nonce:** nonce নেওয়া এখন KV-তে কিছু লেখে না। সফল লগইনে KV লেখা ৩ থেকে ২, আর ব্যর্থ বা জাল লগইনে ০। KV-র ফ্রি সীমা দিনে ১,০০০ লেখা।
2. **Rate limit:** Cloudflare-এর Rate Limiting binding (ঢিলেঢালা ফিল্টার), না থাকলে আগের ইন-মেমরি গণনা।
3. **Apps Script কোটা:** স্প্রেডশিট প্রতি অনুরোধে একবারই খোলে, স্প্রেডশিটের আইডি এক ঘণ্টা ক্যাশে থাকে। `GATEWAY_SECRET` ক্যাশে রাখা হয় না, বদলালে সঙ্গে সঙ্গে কার্যকর।
4. **কোটার তালিকা:** `docs/quotas-and-limits.md` (সীমা, প্রতিটি কাজের খরচ, আনুমানিক ক্ষমতা)।
5. **শেয়ার করা টেস্ট-ডেটা:** ব্রাউজারের ইঞ্জিন ও Apps Script-এর ইমেইল-রিমাইন্ডার একই চক্র-হিসাব করে কি না তা ১৬টি হাতে-যাচাই করা উদাহরণ ও ৪০০টি এলোমেলো উদাহরণে মেলানো হয়। এই কাজে একটি আসল অমিল ঠিক হয়েছে: আপনার সাধারণ চক্রের সেটিং ও একটি-মাত্র-মাপা-চক্র ইমেইল-রিমাইন্ডারে ব্যবহার হতো না (সে সবসময় ২৮ ধরত), এখন হয়।

## ঘ) ডিপ্লয়ের পর পরীক্ষা
1. লগইন করুন। সফল হলে সব ঠিক।
2. `curl -i -H "Origin: https://women-s-cycle-tracker.netlify.app" https://womens-health-gateway.xiannasai.workers.dev/auth/nonce` চালান। `nonce` এখন ৬২ অক্ষরের।
3. Cloudflare ড্যাশবোর্ড → Workers → KV-র ব্যবহার: নতুন লগইনের পর লেখা সংখ্যা প্রতি লগইনে ২ করে বাড়বে।

## ঙ) যা এই ধাপে করা হয়নি
- সেশনকে stateless করা (লগইন-প্রতি লেখা ১-এ নামত, কিন্তু সার্ভার থেকে সেশন বাতিল করা কঠিন হতো)। সিদ্ধান্ত আপনার।
- Users শিটের প্রতি অনুরোধে পুরো পড়া ক্যাশ করা (সাসপেন্ড করার কার্যকারিতা দেরিতে হতো, তাই এড়িয়েছি)।
