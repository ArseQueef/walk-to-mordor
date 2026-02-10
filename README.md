# Walk to Mordor 🗻

A personal step-tracking web app that maps your daily walking distance to Frodo's journey from the Shire to Mordor and back.

## What This App Does

- **Track your daily steps** - Enter your step count for any day
- **See your progress on a map** - Your position updates based on cumulative distance
- **Compare with Frodo** - See where Frodo was on each day of his journey
- **Works offline** - All data stored locally in your browser
- **Mobile-friendly** - Add to iPhone home screen as a PWA

## 🚀 Getting Started (First-Time Setup)

### Option 1: Run Locally (Easiest for Testing)

1. **Extract the folder** - You should have a folder called `walk-to-mordor`

2. **Start a local web server** - Open Terminal/Command Prompt and navigate to the folder:
   ```bash
   cd path/to/walk-to-mordor
   ```

3. **Run a simple web server** using one of these methods:

   **If you have Python 3:**
   ```bash
   python3 -m http.server 8000
   ```

   **If you have Python 2:**
   ```bash
   python -m SimpleHTTPServer 8000
   ```

   **If you have Node.js:**
   ```bash
   npx http-server -p 8000
   ```

   **If you have PHP:**
   ```bash
   php -S localhost:8000
   ```

4. **Open in browser** - Go to `http://localhost:8000`

5. **That's it!** The app should now be running.

### Option 2: Deploy to GitHub Pages (Free Hosting)

1. **Create a GitHub account** (if you don't have one) at github.com

2. **Create a new repository:**
   - Click the "+" icon → "New repository"
   - Name it `walk-to-mordor`
   - Make it Public
   - Don't add README, .gitignore, or license
   - Click "Create repository"

3. **Upload your files:**
   - Click "uploading an existing file"
   - Drag all the files from the walk-to-mordor folder into the browser
   - Click "Commit changes"

4. **Enable GitHub Pages:**
   - Go to Settings → Pages
   - Under "Source", select "main" branch
   - Click Save

5. **Access your app:**
   - After a few minutes, your app will be live at:
   - `https://your-username.github.io/walk-to-mordor/`

### Add to iPhone Home Screen

1. Open the app in Safari
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Name it "Walk to Mordor" and tap Add
5. The app icon will appear on your home screen!

## 📱 How to Use

### Logging Steps

1. **Enter date** - Defaults to today, but you can pick any date
2. **Enter steps** - Type your step count (e.g., 10000)
3. **Click Save Entry** - Your data is saved automatically
4. **View your entries** - See all logged days in the list below

### Understanding the Map

- **Red dot** = Your current position
- **Blue dot** = Frodo's position on the selected day
- **Brown line** = The complete route from Shire to Mordor

### Comparing with Frodo

- Use the slider to select which day of Frodo's journey to compare
- The label shows what happened that day
- The "vs Frodo" stat shows how far ahead (+) or behind (-) you are

### Summary Stats

- **Total Steps** - Sum of all your logged steps
- **Distance Walked** - Converted to kilometers (0.762m per step)
- **Route Progress** - Percentage of the total 2,900km journey
- **vs Frodo** - Difference between your distance and Frodo's

## 🗺️ Customizing the Map

The app uses placeholder data. Here's how to make it accurate:

### 1. Replace the Map Image

- Find or create a Middle-earth map image
- Save it as `assets/map.jpg` (or .png)
- Keep it reasonably sized (1200-2000px wide is good)

### 2. Update the Route Coordinates

Edit `data/route.json`:

```json
{
  "totalKm": 2900,
  "points": [
    {"x": 0.12, "y": 0.78, "dKm": 0},
    {"x": 0.15, "y": 0.75, "dKm": 50}
  ]
}
```

- **x, y** - Position on map (0.0 to 1.0, where 0,0 is top-left)
- **dKm** - Cumulative distance at that point
- Add as many points as needed to trace the route

**How to find coordinates:**
1. Open your map image in an image editor
2. Note the image dimensions (e.g., 1200 x 800)
3. For each route point, note the pixel position (e.g., 144, 624)
4. Convert to normalized: x = 144/1200 = 0.12, y = 624/800 = 0.78

### 3. Update Frodo's Timeline

Edit `data/frodo_days.json`:

```json
[
  {"dayIndex": 1, "label": "Leaves Bag End", "frodoCumulativeKm": 0},
  {"dayIndex": 12, "label": "Arrives at Bree", "frodoCumulativeKm": 230}
]
```

- **dayIndex** - Day number in journey (1, 2, 3...)
- **label** - What happened that day
- **frodoCumulativeKm** - How far along the route Frodo was

## 🔧 Technical Details

### File Structure

```
walk-to-mordor/
├── index.html          # Main HTML page
├── styles.css          # All styling
├── app.js              # Application logic
├── manifest.json       # PWA configuration
├── README.md           # This file
├── assets/
│   ├── map.jpg         # Map background image
│   ├── icon-192.png    # App icon (small)
│   └── icon-512.png    # App icon (large)
└── data/
    ├── route.json      # Route coordinates
    └── frodo_days.json # Frodo's timeline
```

### How It Works

1. **Distance Calculation:**
   - Steps × 0.762 meters = distance in meters
   - Divide by 1000 = distance in kilometers

2. **Position on Map:**
   - Sort your entries by date
   - Calculate cumulative distance
   - Find which route segment you're on
   - Interpolate exact position along that segment

3. **Data Storage:**
   - Everything saved in browser's localStorage
   - No backend or cloud required
   - Data persists until you clear browser data

### Browser Compatibility

- ✅ Safari (iOS and macOS)
- ✅ Chrome (Desktop and Mobile)
- ✅ Firefox
- ✅ Edge

### Storage Limits

- localStorage can hold ~5-10MB of data
- You can log thousands of days before hitting limits
- If you need to reset: Open browser console and run `localStorage.clear()`

## 🐛 Troubleshooting

### Map not showing?
- Make sure `assets/map.jpg` exists
- Check browser console for errors (F12 → Console tab)
- Ensure you're running a web server (not just opening index.html)

### Data not saving?
- Check if localStorage is enabled in browser settings
- Try a different browser
- Check browser console for errors

### Dots not appearing?
- Make sure route.json and frodo_days.json are loading
- Check browser console for fetch errors
- Verify JSON files are valid (use jsonlint.com)

### Can't add to home screen?
- Must use Safari on iOS
- Must be served over HTTPS (local or GitHub Pages)
- Ensure manifest.json is present

## 🎯 Future Enhancements (Optional)

Some ideas for Phase 2:

- [ ] Weekly summary view
- [ ] Milestone notifications
- [ ] Export data to CSV
- [ ] Multiple journey routes
- [ ] Dark/light theme toggle
- [ ] Zoom and pan on map
- [ ] Share progress on social media

## 📝 Notes

- **Step length default:** 0.762m (30 inches) - average adult stride
- **Total journey:** ~2,900 km (Shire → Mordor → Shire)
- **Frodo's journey:** 199 days there, 81 days back
- **No cloud sync:** Data only exists in your browser
- **Privacy:** Nothing is tracked or sent anywhere

## ❓ Questions?

This is a simple web app - all the code is in the three main files (index.html, styles.css, app.js). Feel free to modify anything!

---

**Happy walking! One step at a time to Mount Doom! 🌋**
