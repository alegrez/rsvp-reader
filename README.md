# ⚡ RSVP Speed Reader

A lightweight, web-based speed reading tool utilizing the **RSVP** (Rapid Serial Visual Presentation) technique. This project features a dual interface optimized for both desktop and mobile devices, with offline support for `.epub` books.

**[🚀 Try the App Live](https://alegrez.github.io/rsvp-reader/)**

## ✨ Key Features

### 🧠 Core Reading Engine

- **Smart Pacing:** The engine automatically adjusts exposure time based on punctuation (commas, periods) and word length to improve comprehension and reduce fatigue.
- **Optical Centering:** Highlights the optimal focal point (pivot letter) in red to minimize eye movement (saccades).
- **Interactive Context Mode:** Press `V` or click "View Text" to see the full paragraph. **Click on any word** in this mode to instantly jump to that position in the reader.

### 📖 eBook Support & Persistence

- **EPUB Reader:** Load `.epub` files directly in the browser (parsed via `epub.js`).
- **Auto-Save:** Your reading progress (chapter, word position, and WPM) is saved automatically to your browser.
- **Offline Library:** Uses **IndexedDB** to store book files locally. You don't need to re-upload your book every time you visit the page.
- **Phrase Search:** Easily sync your position with other devices (e.g., Kindle) by searching for a specific 3-4 word phrase within the current chapter.

### 🖥️ Desktop Version

- **Keyboard Shortcuts:**
- `Space`: Play / Pause
- `Up/Down`: Adjust WPM (Words Per Minute)
- `Left/Right`: Skip words
- `Ctrl + Left/Right`: Skip paragraphs
- `F`: Toggle Fullscreen

- **Focus Mode:** Minimalist interface designed for long reading sessions on large screens.

### 📱 Mobile Version (PWA Ready)

- **Touch Gestures:**
- **Double tap sides:** Rewind / Fast-forward.
- **Triple tap left:** Restart the current paragraph.
- **Center tap:** Play / Pause.

- **Immersive Mode:** Optimized for landscape orientation.
- **Floating HUD:** A minimalist toolbar appears only in fullscreen mode to adjust speed without obstructing the text.
- **Adaptive UI:** Automatically detects mobile devices to serve the optimized touch interface.

## 🛠️ Tech Stack & Architecture

This project is built with **Vanilla JavaScript** (ES6+) and requires no build step (bundlers). It leverages modern browser APIs and CDNs for extended functionality.

### Core Libraries

- **[epub.js](https://www.google.com/search?q=https://github.com/futurepress/epub.js):** For parsing and rendering `.epub` files (supports XHTML strict).
- **[idb-keyval](https://github.com/jakearchibald/idb-keyval):** A lightweight wrapper for `IndexedDB` to handle persistent file storage.
- **[marked](https://github.com/markedjs/marked):** For parsing Markdown input in text mode.
- **[JSZip](https://stuk.github.io/jszip/):** Required dependency for handling zipped EPUB containers.

## 📂 Project Structure

The code is modularized for maintainability and separation of concerns:

```text
├── index.html          # Desktop entry point
├── mobile.html         # Mobile entry point
├── css/
│   ├── style.css       # Shared base styles
│   ├── desktop.css     # Desktop-specific layout
│   └── mobile.css      # Mobile-specific layout & touch handling
├── js/
│   ├── rsvp-core.js    # Core engine (Smart pacing, word parsing, HTML sanitization)
│   ├── epub-bridge.js  # Adapter to handle EPUB parsing & XML serialization
│   ├── storage.js      # Service for IndexedDB (files) & LocalStorage (settings)
│   ├── desktop.js      # Desktop UI controller
│   └── mobile.js       # Mobile UI controller
└── update_versions.py  # Python utility for cache-busting (updates ?v= timestamps)

```

## 🚀 Installation & Local Development

Since this is a static site, you don't need `npm` or complex build tools.

1. **Clone the repository:**

```bash
git clone https://github.com/alegrez/rsvp-reader.git
cd rsvp-reader

```

2. **Run locally:**
   You need a local server to handle CORS for web workers and EPUB files properly.

```bash
# Using Python 3
python -m http.server 8000

```

3. **Open in browser:**
   Go to `http://localhost:8000`

## 🔄 Deployment & Cache Busting

Browsers aggressively cache JS/CSS files. This project includes a utility to prevent stale code in production.

1. **Run the update script:**
   This updates the `?v=timestamp` query parameters in your HTML files for all local CSS/JS assets.

```bash
python update_versions.py

```

2. **Commit and push** to GitHub Pages (or your hosting provider).

## 📄 License

MIT License. Feel free to use and modify.
