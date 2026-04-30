# Shop Filter (Amazon + AliExpress)

Personal-use Chrome/Brave extension that filters search results on **Amazon** and **AliExpress** by keyword, rating, price, and more.

## Install (Brave or Chrome)

1. **Unzip** the folder somewhere permanent (e.g. `~/Documents/extensions/shop-filter`).
2. Open `chrome://extensions` (or `brave://extensions`).
3. Toggle **Developer mode** ON.
4. Click **Load unpacked** → select the `shop-filter` folder.
5. Pin the icon to the toolbar.

## Usage

Click the extension icon → switch between **Amazon** and **AliExpress** tabs → set filters → Save.
Settings are saved per site, so each site keeps its own keywords, price range, etc.

## Features

### Amazon tab
- Block / must-have keywords
- Minimum star rating (0.1 step)
- Price range
- Auto-apply Prime filter
- Default sort
- Infinite scroll

### AliExpress tab
- Block / must-have keywords
- Minimum star rating (0.1 step)
- **Minimum units sold** (e.g. only show items with 100+ sold)
- Price range
- Free shipping toggle
- Default sort

## Notes / honest caveats

- **AliExpress ratings are inconsistent.** Many AE listings don't show a rating at all. If you set a min rating, expect a lot of items to disappear. The "hide unrated" toggle controls whether unrated items are filtered too.
- **AliExpress has no built-in pagination links** — they use scroll-loaded pagination natively, so the infinite-scroll feature only applies to Amazon.
- AliExpress changes its HTML class names regularly, so if filters stop catching listings on AE, the selectors may need updating.
