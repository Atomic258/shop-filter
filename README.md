# Shop Filter

Personal Chrome/Brave extension that filters search results on Amazon and AliExpress by keyword, rating, price, and more.

## Install

1. Download or clone this repo:
git clone https://github.com/YOUR-USERNAME/shop-filter.git
2. Open `chrome://extensions` (or `brave://extensions`)
3. Toggle **Developer mode** ON (top right)
4. Click **Load unpacked** → select the `shop-filter` folder
5. Pin the icon to the toolbar

## Features

- **Keyword filtering** — block words and must-have words (whole-word, case-insensitive)
- **Rating filter** — minimum stars with 0.1 precision
- **Price range** — applied via URL params for server-side filtering
- **Hide ads** — sponsored listings on both sites
- **Default sort** — set your preferred sort per site
- **Infinite scroll** — auto-loads next page as you scroll
- **Amazon-specific:** Auto-apply Prime filter
- **AliExpress-specific:** Free shipping toggle, minimum sold count, debug mode

## Personal use

This is built for personal use. Settings are stored locally per browser profile and never leave your machine.
