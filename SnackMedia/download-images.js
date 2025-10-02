// download-images.js (CommonJS, Windows-friendly)
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const https = require("https");
const http = require("http");
const { URL } = require("url");

const OUT_DIR = path.resolve(process.cwd(), "images");

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
  "Referer": "https://commons.wikimedia.org/",
};

const CT_EXT = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

const urls = [
  "https://upload.wikimedia.org/wikipedia/commons/6/69/Potato-Chips.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/5/5e/Snickers.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/9/9f/2020-09-06_16_12_15_An_open_can_of_Original_Pringles_in_the_Franklin_Farm_section_of_Oak_Hill,_Fairfax_County,_Virginia.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/3/3f/Bounty-Split.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/3/3e/Oreo-Two-Cookies.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/2/28/Doritos.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/f/fc/Kit-Kat-Split.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/5/53/Pringles_chips.JPG",
  "https://upload.wikimedia.org/wikipedia/commons/8/8b/Twix.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/1/10/Cheetos.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/5/55/Three_protein_bars.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/f/f0/M%26M%27s.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/4/40/Vegan_Caramel_Popcorn_(4753552907).jpg",
  "https://upload.wikimedia.org/wikipedia/commons/0/06/Fancy_raw_mixed_nuts_macro.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/9/90/Milka_Alpine_Milk_Chocolate_bar_100g.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/a/a0/Kinder-Bueno-Split.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/b/be/Baked_Chips_(4958552198).jpg",
  "https://upload.wikimedia.org/wikipedia/commons/b/b6/Trail_Mix_Superman_Mix_dried_blueberries_dates_almonds_coconut_chips_chia_snack_treat_(27818928974).jpg",
  "https://upload.wikimedia.org/wikipedia/commons/e/ec/Haribo_Goldbears_(203841324).jpg",
  "https://upload.wikimedia.org/wikipedia/commons/b/b7/Chocolate_rice_cake.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/3/3e/Boost_Energy_exotic_fruits.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/0/0c/Chewy-Granola-Bar.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/6/67/Sandwich_seaweed_crisps.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/c/c6/Pretzel-Crisps.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/9/9c/Home_made_sandwich_(4811136859).jpg",
  "https://upload.wikimedia.org/wikipedia/commons/8/88/Oatmeal_cookies.JPG",
  "https://upload.wikimedia.org/wikipedia/commons/1/19/Passion_fruit_gummies.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/6/65/Beef_jerky.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/f/f6/Chocolate_muffins_2.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/e/e1/5_gum_package.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/0/04/Dukat_jogurt.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/d/df/Salami_sandwich.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/5/5c/Zhejiang_Jiaxing_freeze-dried_apple_chips.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/a/a7/Salted_peanuts.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/a/ad/Typical_japanese_sushi_set.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/e/e4/Ham_and_cheese_sandwich.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/2/20/Fruit_cup.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/4/48/Milkground_cheese_sticks.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/5/52/Bottle_of_water.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/4/40/Chicken_wrap_2.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/6/6a/US-Mars-Bar-Split.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/0/0f/Iced_green_tea_latte.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/2/29/Caesar_salad.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/5/5d/Top_view_Closeup_mini_cookies_in_vintage_box._Colorful_beautiful_cookie_(49213733858).jpg",
  "https://upload.wikimedia.org/wikipedia/commons/f/fd/Panini_with_Ham,_Red_Onion_%26_Cheese_-_Rotunda_Cafe_2023-12-16.jpg",
];

// ---------- helpers ----------
function extFrom(contentType, urlPath) {
  if (contentType && CT_EXT[contentType.toLowerCase()]) {
    return CT_EXT[contentType.toLowerCase()];
  }
  const raw = path.extname(urlPath).split("?")[0];
  return raw ? raw.toLowerCase() : ".jpg";
}

function httpRequest(urlStr, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 7) return reject(new Error("Too many redirects"));
    const u = new URL(urlStr);
    const mod = u.protocol === "https:" ? https : http;

    const req = mod.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + (u.search || ""),
        method: "GET",
        headers: DEFAULT_HEADERS,
      },
      (res) => {
        const status = res.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(status)) {
          const loc = res.headers.location;
          if (!loc) return reject(new Error(`Redirect without Location: ${urlStr}`));
          const next = new URL(loc, urlStr).toString();
          res.resume();
          return httpRequest(next, redirectCount + 1).then(resolve, reject);
        }
        resolve(res);
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function fetchWithFallback(urlStr) {
  // 1) прямой upload
  try {
    const res = await httpRequest(urlStr);
    if (res.statusCode === 200) return { res, forExtPath: new URL(urlStr).pathname };
    res.resume();
  } catch (_) {}

  // 2) Special:FilePath fallback
  const baseFile = decodeURIComponent(new URL(urlStr).pathname.split("/").pop());
  const filePathUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${baseFile}`;
  const res2 = await httpRequest(filePathUrl);
  if (res2.statusCode !== 200) {
    res2.resume();
    throw new Error(`Failed via Special:FilePath (${res2.statusCode}) for ${baseFile}`);
  }
  return { res: res2, forExtPath: new URL(filePathUrl).pathname };
}

function streamToFile(res, outPath) {
  return new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(outPath, { flags: "w" });
    res.pipe(ws);
    ws.on("finish", () => ws.close(resolve));
    ws.on("error", reject);
  });
}

async function safeDownload(urlStr, numberBase, attempt = 1) {
  const { res, forExtPath } = await fetchWithFallback(urlStr);
  const ext = extFrom(res.headers["content-type"], forExtPath);
  const finalName = `${numberBase}${ext}`;
  const tmpName = `${numberBase}.part${attempt}${ext}`;

  const outTmp = path.join(OUT_DIR, tmpName);
  const outFinal = path.join(OUT_DIR, finalName);

  try {
    await streamToFile(res, outTmp);
    await fsp.rename(outTmp, outFinal);
    return finalName;
  } catch (err) {
    // если стрельнуло «UNKNOWN» или другая IO — попробуем ещё раз
    try { await fsp.unlink(outTmp).catch(() => {}); } catch {}
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 300 + attempt * 200));
      return safeDownload(urlStr, numberBase, attempt + 1);
    }
    throw err;
  }
}

// ---------- run ----------
(async () => {
  await fsp.mkdir(OUT_DIR, { recursive: true });

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const num = String(i + 1).padStart(2, "0");
    process.stdout.write(`Скачиваю ${num} … `);
    try {
      const saved = await safeDownload(url, num);
      console.log(`OK → ${path.join("images", saved)}`);
    } catch (e) {
      console.log(`Ошибка → ${e.message}`);
    }
    // мягкий троттлинг CDN
    await new Promise(r => setTimeout(r, 150));
  }

  console.log("\nГотово. Файлы в папке:", OUT_DIR);
})();
