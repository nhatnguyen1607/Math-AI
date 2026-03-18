# AI Math (Math-AI)

A React‑based educational platform that combines interactive problem solving with an animated
`RobotCompanion` assistant. The companion uses a **hybrid 3D/2D model** and configurable
CSS overlays to provide visual feedback (thinking, correct, wrong) during student practice.

---

## 🚀 Setup & Run

1. **Clone repository** and `cd` into workspace:
   ```bash
   git clone <repo-url> d:\Math-AI
   cd d:\Math-AI
   ```
2. **Install dependencies** (uses npm):
   ```bash
   npm install
   ```
3. **Create `.env` file** in the project root with API keys:
   ```ini
   REACT_APP_GEMINI_API_KEY_1=<your first Gemini key>
   REACT_APP_GEMINI_API_KEY_2=<optional backup key>
   # any additional vars used by Firebase or services
   ```
4. **Start development server**:
   ```bash
   npm start
   ```
   The app will open at `http://localhost:3000` (or 3001 if 3000 is in use).
5. **Build for production**: `npm run build`.

> Environment variables prefixed with `REACT_APP_` are injected at build time.

---

## 🧩 Core Features

- **Robot Companion**: interactive feedback component with four string states
  (`idle`, `thinking`, `correct`, `wrong`).
- **Hybrid rendering**: 3D Spline model (via `@splinetool/react-spline`) persists
  through state changes with animated CSS overlays for effects.
- **Variant system**: overlays choose from randomized visual variants (confetti,
  radar, thunder, bubbles, etc.) to keep interactions lively.
- **Rate‑limited Gemini AI calls**: backend service uses multiple API keys and
  retry logic to avoid 429 errors.
- **Robust error handling**: null checks, fallback animations, and safe resets
  prevent WebGL crashes and console warnings.
- **Responsive layout**: fixed-width robot column on desktop, full‑width stack on
  smaller screens, identical behavior across all devices.
- **State management patterns**: direct `useState`, context API, auto‑reset helpers.

---

## ⚙️ Environment Variables

| Variable                          | Description                                   |
|----------------------------------|-----------------------------------------------|
| `REACT_APP_GEMINI_API_KEY_1`     | Primary Gemini/Google Generative AI key       |
| `REACT_APP_GEMINI_API_KEY_2`     | Backup key (optional)                         |
| `REACT_APP_FIREBASE_API_KEY` ... | Any Firebase credentials as required by app   |

> Add other keys following the `REACT_APP_` convention; see
> `src/services/geminiService.js` for usage.

---

## 🧠 Architecture & Tech Stack

- **Frontend**: React 19, React Router v7, TailwindCSS 3.
- **3D Rendering**: `@splinetool/react-spline` (Spline URL stored in `RobotCompanion.jsx`).
- **AI**: Gemini models via `@google/generative-ai`, managed by custom services.
- **State**: React hooks and optional context providers.
- **Animations**: CSS keyframes with hardware acceleration, `canvas-confetti` for explosions.
- **Backend**: Firebase Firestore + custom services for problems, exams, scoring.

The robot companion is self‑contained within `src/components/common/RobotCompanion.jsx`
and its stylesheet; other services live under `src/services/`.

---

## 📦 Usage Guide

### Import & render

```jsx
import RobotCompanion from './src/components/common/RobotCompanion';

function MyPage() {
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('Ready to help!');

  return (
    <RobotCompanion status={status} message={message} />
  );
}
```

### Common integration patterns

- **Simple state**: manage `status` and `message` with `useState`.
- **Auto‑reset helper**: set the robot to a state then clear back to `idle` after
a delay.
- **Context API**: wrap the app with a `RobotProvider` and call `useRobot()` from
anywhere for global control.

### Testing component

Navigate to `/robot-test` (add route to `App.jsx` pointing at
`RobotCompanionTest.jsx`) to interactively exercise all four statuses.

---

## 🛠️ Maintenance & Debugging

- **Build warnings**: watch for unused imports when refactoring overlay variants.
- **WebGL crashes**: ensure robot container has fixed `min-height` (400px).
- **429 errors**: API calls are throttled (2s) and keys rotate; monitor console.
- **Animation issues**: unsupported morph targets cause `THREE.PropertyBinding`
errors – only `Mood` variable is safe.

---

## ✅ Responsive UI Checklist

Use this quick checklist before merging UI changes:

- Mobile first by default: start with base classes, then add `sm:`, `md:`, `lg:` overrides.
- Touch targets: primary actions should be at least 44x44 pixels (`min-h-11`, `min-w-11`).
- Layout containers: use `app-shell` and `section-shell` for consistent spacing and max width.
- Tables: provide mobile card fallback for dense data; keep full table at `md` or `lg`.
- Typography: avoid fixed large headings; prefer responsive scales like `text-2xl sm:text-3xl lg:text-4xl`.
- Sticky elements: account for header height (`top-16` / `top-20`) to avoid overlap.
- Focus states: keyboard users must see focus rings (`:focus-visible` is enabled globally).
- Motion: avoid excessive animation on critical flows and support reduced motion.
- Ultra-wide screens: constrain content with `max-w-7xl` and center to prevent stretched layouts.
- QA sweep: test key pages at ~375px, 768px, 1280px, and 1536px widths.

---

## 💬 Contributors

- Original developer: [Your Name]
- Maintained by Math-AI Team

---

This README replaces scattered documentation; all previous `.md` files have been
removed to avoid confusion. For source code references, search `RobotCompanion` in
`src/components/common` or consult the services under `src/services`.
