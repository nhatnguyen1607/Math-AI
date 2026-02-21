import React, { useEffect, useRef, useCallback, useState, Suspense, Component } from 'react';
import confetti from 'canvas-confetti';
import './RobotCompanion.css';

// Lazy load Spline to handle React 19 compatibility issues
const Spline = React.lazy(() => import('@splinetool/react-spline'));

// Error Boundary to catch Spline loading errors
class SplineErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('Spline component failed to load:', error);
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI when Spline fails
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

// use local file to avoid cross-origin
// note: actual filename in public/models is cute_robot.spline
const SPLINE_URL = '/models/scene.splinecode';

// random utility
const rand = (min, max) => Math.random() * (max - min) + min;

/**
 * Floating math symbols used during "thinking" state
 */
const ThinkingOverlay = ({ variant = 0 }) => {
  // pre-generate two sets: math symbols and question marks
  const mathItems = useState(() =>
    Array.from({ length: 6 }).map(() => ({
      sym: ['+', '-', '×', '÷', '?'][Math.floor(Math.random() * 5)],
      left: rand(10, 90),
      top: rand(20, 80),
      delay: rand(0, 2)
    }))
  )[0];

  const questionItems = useState(() =>
    Array.from({ length: 6 }).map(() => ({
      left: rand(10, 90),
      top: rand(20, 80),
      delay: rand(0, 2)
    }))
  )[0];

  if (variant === 1) {
    // pulsing radar ripple
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="ripple-circle" />
      </div>
    );
  } else if (variant === 2) {
    // floating question marks
    return (
      <>
        {questionItems.map((it, i) => (
          <span
            key={i}
            className="question-mark text-4xl"
            style={{
              left: `${it.left}%`,
              top: `${it.top}%`,
              animationDelay: `${it.delay}s`
            }}
          >
            ?
          </span>
        ))}
      </>
    );
  }

  // default (variant 0) – original math symbols
  return (
    <>
      {mathItems.map((it, i) => (
        <span
          key={i}
          className="math-symbol text-2xl"
          style={{
            left: `${it.left}%`,
            top: `${it.top}%`,
            animationDelay: `${it.delay}s`
          }}
        >
          {it.sym}
        </span>
      ))}
    </>
  );
};

/**
 * Rain and red tint used for wrong answers
 */
const WrongOverlay = ({ variant = 0 }) => {
  const drops = useState(() =>
    Array.from({ length: 20 }).map(() => ({
      left: rand(0, 100),
      delay: rand(0, 1)
    }))
  )[0];

  const clouds = useState(() =>
    Array.from({ length: 3 }).map(() => ({
      left: rand(0, 100),
      delay: rand(0, 1)
    }))
  )[0];

  if (variant === 1) {
    // thunder flash + light red tint; container will shake harder
    return (
      <>
        <div className="thunder-flash" />
        <div className="absolute inset-0 bg-red-300 opacity-10" />
      </>
    );
  } else if (variant === 2) {
    // grayscale effect applied on container; show sad clouds
    return (
      <>
        <div className="absolute inset-0 bg-red-100 opacity-10" />
        {clouds.map((c, i) => (
          <span
            key={i}
            className="cloud-icon text-6xl"
            style={{ left: `${c.left}%`, animationDelay: `${c.delay}s` }}
          >
            ☁️
          </span>
        ))}
      </>
    );
  }

  // default variant 0 - rain
  return (
    <>
      <div className="absolute inset-0 bg-red-200 opacity-20" />
      {drops.map((d, i) => (
        <span
          key={i}
          className="rain-drop"
          style={{ left: `${d.left}%`, animationDelay: `${d.delay}s` }}
        />
      ))}
    </>
  );
};

/**
 * Rising icons and confetti for correct answers
 */
const CorrectOverlay = ({ variant = 0 }) => {
  const icons = useState(() =>
    Array.from({ length: 10 }).map(() => ({
      icon: Math.random() < 0.5 ? '⭐' : '❤️',
      left: rand(10, 90),
      delay: rand(0, 2)
    }))
  )[0];

  const bubbles = useState(() =>
    Array.from({ length: 8 }).map(() => ({
      left: rand(10, 90),
      size: rand(15, 40),
      delay: rand(0, 2)
    }))
  )[0];

  if (variant === 1) {
    // golden glow with text
    return (
      <>
        <div className="absolute inset-0 bg-yellow-radial opacity-60 pointer-events-none" />
        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 pointer-events-none">
          <span className="text-4xl font-bold text-yellow-800 animate-bounce-text">
            Tuyệt vời!
          </span>
          <span
            className="text-3xl font-semibold text-yellow-700 animate-bounce-text"
            style={{ animationDelay: '0.3s' }}
          >
            10 Điểm!
          </span>
        </div>
      </>
    );
  }
  if (variant === 2) {
    // floating bubbles
    return (
      <>
        {bubbles.map((b, i) => (
          <span
            key={i}
            className="bubble"
            style={{
              left: `${b.left}%`,
              width: `${b.size}px`,
              height: `${b.size}px`,
              animationDelay: `${b.delay}s`
            }}
          />
        ))}
      </>
    );
  }

  // default variant 0
  return (
    <>
      {icons.map((ic, i) => (
        <span
          key={i}
          className="math-symbol text-2xl"
          style={{
            left: `${ic.left}%`,
            top: '80%',
            animation: 'float 2s ease-in-out forwards',
            animationDelay: `${ic.delay}s`
          }}
        >
          {ic.icon}
        </span>
      ))}
    </>
  );
};

/**
 * Main Robot companion component
 */
const RobotCompanion = ({ status = 'idle', message = '' }) => {
  const splineAppRef = useRef(null);
  const hasConfettiRef = useRef(false);
  const [effectVariant, setEffectVariant] = useState(0); // overlay style selector (0/1/2)

  const handleSplineLoad = useCallback((app) => {
    splineAppRef.current = app;
    
    console.log('✅ Spline Loaded - Initializing Robot');
    
    // 🔍 DEBUG: Log all available variables in the model
    try {
      const vars = app.getVariables();
      console.log('📋 Available Variables in Model:', vars);
      
      // Also try to list all animatable properties
      if (app.scene && app.scene.animations) {
        console.log('🎬 Available Animations:', app.scene.animations);
      }
    } catch (e) {
      console.debug('ℹ️ Could not retrieve model variables:', e.message);
    }
    
    // Initialize mood to 0 (idle) on load
    try {
      app.setVariable('Mood', 0);
      console.log('✅ Robot loaded - Initial Mood set to 0 (Idle)');
    } catch (e) {
      console.error('❌ Error initializing robot mood:', e);
    }
  }, []);

  // Update mood, pick a random overlay variant, and trigger animations based on status
  useEffect(() => {
    // choose a new variant each time the status changes
    setEffectVariant(Math.floor(Math.random() * 3));

    if (!splineAppRef.current) {
      console.warn('⚠️ Spline app not loaded yet');
      return;
    }

    // 1. Map string status to Spline Mood number (0 covers idle/thinking)
    let targetMood = 0;
    if (status === 'correct') {
      targetMood = 1;
    } else if (status === 'wrong') {
      targetMood = 2;
    } else {
      targetMood = 0; // idle, thinking, or any other fallback
    }

    // 2. Apply mood with invisible reset when transitioning to active animations
    if (targetMood === 1 || targetMood === 2) {
      try {
        splineAppRef.current.setVariable('Mood', 0);
      } catch (e) {
        /* ignore */
      }
      setTimeout(() => {
        if (splineAppRef.current) {
          try {
            splineAppRef.current.setVariable('Mood', targetMood);
          } catch (e) {
            /* ignore */
          }
        }
      }, 100);
    } else {
      try {
        splineAppRef.current.setVariable('Mood', targetMood);
      } catch (e) {
        /* ignore */
      }
    }
  }, [status]);

  // Confetti effect for correct answers with variant-specific colors
  useEffect(() => {
    const isCorrect = status === 'correct';
    
    if (isCorrect && !hasConfettiRef.current) {
      hasConfettiRef.current = true;
      console.log('🎉 Triggering confetti animation (variant', effectVariant, ')');
      const colors =
        effectVariant === 1
          ? ['#FFD700', '#FFC107', '#FFEB3B'] // golden variant
          : ['#ffecb3', '#ffe082', '#fff176', '#ffd54f'];
      confetti({
        particleCount: 120,
        spread: 100,
        colors,
        origin: { y: 0.7 }
      });
    } else if (!isCorrect) {
      hasConfettiRef.current = false;
    }
  }, [status, effectVariant]);

  // responsive container: fixed aspect ratio and a maximum width to keep it narrow.
  // height adjusts automatically, keeping 3:4 vertical orientation.
  // booleans now strict equality for visual cues
  const isThinking = status === 'thinking';
  const isWrong = status === 'wrong';
  const isCorrect = status === 'correct';
  // note: idle produces no overlays so no need for isIdle variable

  // variant helpers
  const isThunder = isWrong && effectVariant === 1;
  const isGrayscale = isWrong && effectVariant === 2;
  const isGolden = isCorrect && effectVariant === 1;

  // ⚠️ CRITICAL: Enforce minimum dimensions to prevent WebGL crash
  const containerClasses = `w-full h-[400px] relative shrink-0 max-w-[320px] aspect-[3/4] overflow-hidden rounded-2xl bg-gradient-to-b from-blue-50 to-white shadow-xl border-2 border-blue-200 ${
    isThinking ? 'border-blue-400 animate-pulse' : ''
  } ${isThunder ? 'animate-heavy-shake' : isWrong ? 'animate-shake' : ''} ${
    isGolden ? 'bg-yellow-50' : ''
  } ${isGrayscale ? 'filter grayscale' : ''} ${
    isCorrect ? 'shadow-glow' : ''
  }`;

  return (
    <div className={containerClasses}>
      {/* 3D robot always visible - wrapped in Error Boundary and Suspense */}
      <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-b from-blue-100 to-blue-50">
        <SplineErrorBoundary fallback={<div className="text-blue-400 text-sm">Robot đang nghỉ ngơi...</div>}>
          <Suspense fallback={<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>}>
            <Spline 
              scene={SPLINE_URL} 
              onLoad={handleSplineLoad} 
              className="w-full h-full object-cover" 
            />
          </Suspense>
        </SplineErrorBoundary>
      </div>

      {/* overlays */}
      <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
        {(() => {
          if (status === 'thinking') return <ThinkingOverlay variant={effectVariant} />;
          if (status === 'correct') return <CorrectOverlay variant={effectVariant} />;
          if (status === 'wrong') return <WrongOverlay variant={effectVariant} />;
          return null;
        })()}
      </div>
    </div>
  );
};

export default RobotCompanion;
