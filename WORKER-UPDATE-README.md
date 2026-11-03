# Worker আপডেট: একাধিক সাইট (GitHub Pages + Netlify)

## কী বদলেছে
`ALLOWED_ORIGIN`-এ এখন কমা দিয়ে একাধিক ঠিকানা দেওয়া যায়। মেলানো হুবহু (কোনো `*`, পথ বা শেষের `/` চলবে না)।

## কী করবেন (৪টি ধাপ)
1. এই জিপের `worker/src/index.js` দিয়ে আপনার কম্পিউটারের `worker/src/index.js` বদলান।
2. আপনার `worker/wrangler.toml`-এ (আমি এটা জিপে দিইনি, কারণ ওতে আপনার আসল মান আছে) শুধু এই লাইনটি বদলান:
   ALLOWED_ORIGIN = "https://gaziabdulahad.github.io,https://women-s-cycle-tracker.netlify.app"
3. `cd ~/Documents/womens-health-tracker/worker` তারপর `npx wrangler deploy`
4. Google Cloud → Google Auth Platform → Clients → আপনার Web client → Authorized JavaScript origins-এ দুটি ঠিকানাই থাকতে হবে:
   https://gaziabdulahad.github.io
   https://women-s-cycle-tracker.netlify.app

## পরীক্ষা
curl -i -H "Origin: https://women-s-cycle-tracker.netlify.app" https://womens-health-gateway.xiannasai.workers.dev/auth/nonce
curl -i -H "Origin: https://gaziabdulahad.github.io" https://womens-health-gateway.xiannasai.workers.dev/auth/nonce
দুটিতেই 200 এবং সংশ্লিষ্ট `access-control-allow-origin` লাইন আসা উচিত।

## অন্য ফাইল
`tests/worker.test.js`, `docs/gateway-deploy.md`, `docs/troubleshooting.md` রিপোর জন্য (ঐচ্ছিক, সাইটের কাজে লাগে না)।
