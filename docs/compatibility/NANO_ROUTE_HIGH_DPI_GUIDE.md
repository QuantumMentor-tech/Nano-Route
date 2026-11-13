# Nano Route High-DPI Display Scaling & Multi-Monitor Engineering Guide

## 1. High-DPI Architecture in Tauri v2
Windows desktop displays range from legacy 100% 96 DPI monitors (1080p) to modern 125%, 150%, 175%, and 200% High-DPI displays (1440p, 4K laptops, and Surface devices). Nano Route is engineered with **Per-Monitor V2 DPI Awareness** (`PerMonitorV2`), ensuring automatic scaling and sharp rendering across dynamic display changes.

---

## 2. Scaling Calculation & Layout Adapters

### 2.1 Coordinate Mapping
Display scaling in WebView2 is governed by the device pixel ratio (`window.devicePixelRatio`):
```text
Effective CSS Width  = Physical Screen Width  / DPI Scale Factor
Effective CSS Height = Physical Screen Height / DPI Scale Factor
```

### 2.2 Canonical Scaling Verification Table

| Physical Display Resolution | Windows Scaling Factor | Effective CSS Viewport | Meets Minimum (1000×650) | Verification State |
|:---|:---|:---|:---|:---|
| **1920 × 1080 (FHD)** | 100% (1.0x) | 1920 × 1080 px | Yes (Full layout) | **PASS** |
| **1920 × 1080 (FHD Laptop)** | 125% (1.25x) | 1536 × 864 px | Yes (Full layout) | **PASS** |
| **1920 × 1080 (Compact)** | 150% (1.50x) | 1280 × 720 px | Yes (Compact layout)| **PASS** |
| **2560 × 1440 (QHD)** | 125% (1.25x) | 2048 × 1152 px | Yes (Full layout) | **PASS** |
| **2560 × 1440 (QHD Laptop)** | 150% (1.50x) | 1706 × 960 px | Yes (Full layout) | **PASS** |
| **3840 × 2160 (4K UHD)** | 150% (1.50x) | 2560 × 1440 px | Yes (Full layout) | **PASS** |
| **3840 × 2160 (4K UHD)** | 200% (2.0x) | 1920 × 1080 px | Yes (Full layout) | **PASS** |
| **1366 × 768 (Legacy HD)** | 100% (1.0x) | 1366 × 768 px | Yes (Min baseline) | **PASS** |
| **1366 × 768 (Legacy HD)** | 125% (1.25x) | 1092 × 614 px | No (Height < 650px) | **UNSUPPORTED / SCROLL ENGAGED** |

---

## 3. High-DPI Layout Rules & Invariants
1. **Vector Iconography:** All application icons use SVG vectors (via Lucide React). No raster bitmap stretching occurs at 150% or 200% scale.
2. **Relative Typography:** Font sizes are specified in relative `rem` units based on a root `16px` baseline, reflowing predictably across zoom levels.
3. **Responsive Breakpoints:**
   - `> 1200px`: Full sidebar with expanded labels, side-by-side telemetry charts.
   - `1000px - 1200px`: Collapsible sidebar mode, stacked analytics cards.
   - `< 1000px`: Application maintains `minWidth: 1000px` to prevent layout collapse.
4. **No Horizontal Window Clipping:** Critical UI elements (prompt submission buttons, model selectors, credential save forms) remain accessible on all qualified resolutions.

---

## 4. Multi-Monitor Coordinate Clamping

When moving windows between displays with mismatched DPI scaling (e.g. dragging from 4K 150% to 1080p 100%):
- **Dynamic Reflow:** The WebView2 engine dynamically triggers `resize` and DPI update events without requiring application restart.
- **Off-Screen Recovery (`sanitizeWindowPlacement`):**
  If a secondary monitor is unplugged while Nano Route is open, the window coordinate resolver detects out-of-bound coordinates and repositions the window to the center of the primary display.

