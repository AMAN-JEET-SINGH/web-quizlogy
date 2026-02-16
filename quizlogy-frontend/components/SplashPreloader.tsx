'use client';

import { useState, useEffect } from 'react';

// Critical images to preload across the app
const PRELOAD_IMAGES = [
  '/logo.svg',
  '/bg-quiz.svg',
  '/bg-black.svg',
  '/coin.svg',
  '/coin2.svg',
  '/bg-battle.svg',
  '/sword.webp',
  '/trophy.svg',
  '/star.svg',
  '/timer.svg',
  '/clock1.svg',
  '/spin.svg',
  '/wheel-base.svg',
  '/splash-bg.svg',
  '/b1.svg',
  '/oops.svg',
];

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // don't block on errors
    img.src = src;
  });
}

export default function SplashPreloader({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Check if already preloaded this session
    if (sessionStorage.getItem('images-preloaded') === '1') {
      setReady(true);
      return;
    }

    let loaded = 0;
    const total = PRELOAD_IMAGES.length;

    Promise.all(
      PRELOAD_IMAGES.map((src) =>
        preloadImage(src).then(() => {
          loaded++;
          setProgress(Math.round((loaded / total) * 100));
        })
      )
    ).then(() => {
      sessionStorage.setItem('images-preloaded', '1');
      // Small delay for smooth transition
      setTimeout(() => setReady(true), 200);
    });

    // Fallback: show app after 3s even if images aren't done
    const timeout = setTimeout(() => {
      sessionStorage.setItem('images-preloaded', '1');
      setReady(true);
    }, 3000);

    return () => clearTimeout(timeout);
  }, []);

  if (ready) return <>{children}</>;

  return (
    <div className="splash-preloader">
      <div className="splash-preloader-content">
        {/* Logo */}
        <div className="splash-logo-ring">
          <div className="splash-logo-ring-spinner" />
          <img src="/logo.svg" alt="Quizwala" className="splash-logo-img" />
        </div>

        {/* App Name */}
        <h1 className="splash-app-name">Quizwala</h1>
        <p className="splash-tagline">Play. Learn. Win.</p>

        {/* Progress Bar */}
        <div className="splash-progress-track">
          <div className="splash-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="splash-progress-text">{progress}%</p>
      </div>
    </div>
  );
}
