"use client";

import { useEffect, useRef, useState } from "react";
import './ScrollTriggeredSVG.css';

const IMAGES = [
  "/p1.svg",
  "/p2.svg",
  "/p3.svg",
  "/p4.svg",
];

export default function RandomScrollImage() {
  const [image, setImage] = useState<string | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const currentScroll = window.scrollY;

      // prevent triggering on tiny scrolls
      if (Math.abs(currentScroll - lastScrollY.current) < 100) return;

      lastScrollY.current = currentScroll;

      if (timeoutRef.current) return;

      const delay = Math.random() * 3000 + 2000; // 2–5 sec

      timeoutRef.current = setTimeout(() => {
        const randomImage =
          IMAGES[Math.floor(Math.random() * IMAGES.length)];

        const randomX = Math.random() * 70 + 10; // %
        const randomY = Math.random() * 70 + 10; // %
        const rotation = Math.random() * 10 - 5; // -5deg to +5deg

        setStyle({
          top: `${randomY}%`,
          left: `${randomX}%`,
          transform: `translate(-50%, -50%) scale(1) rotate(${rotation}deg)`,
        });

        setImage(randomImage);

        timeoutRef.current = null;
      }, delay);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <>
      {image && (
        <img
          src={image}
          alt="random"
          className="random-image"
          style={style}
        />
      )}
    </>
  );
}
