'use client';

import { useEffect, useRef, useState } from 'react';

interface AdsenseAdProps {
  adSlot?: string;
  adFormat?: 'auto' | 'rectangle' | 'vertical' | 'horizontal';
  className?: string;
  style?: React.CSSProperties;
}

// Generate unique ad slot IDs for different placements
const generateAdSlot = (index: number): string => {
  // Use different ad slots for better performance and revenue
  // You can create multiple ad units in AdSense dashboard and use different slot IDs here
  const baseSlot = '8153775072';
  // For now using same slot, but structure allows easy addition of more slots
  return baseSlot;
};

export default function AdsenseAd({ 
  adSlot, 
  adFormat = 'auto',
  className = '',
  style = {}
}: AdsenseAdProps) {
  const adRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const pushedRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Use provided adSlot or generate one
  const finalAdSlot = adSlot || '8153775072';

  // Only render on client to prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Initialize Intersection Observer for lazy loading
    if (typeof window === 'undefined' || !adRef.current) return;

    // Check if adsbygoogle is available
    if (typeof (window as any).adsbygoogle === 'undefined') {
      // Script not loaded yet, wait a bit
      const checkScript = setInterval(() => {
        if (typeof (window as any).adsbygoogle !== 'undefined') {
          clearInterval(checkScript);
          setupObserver();
        }
      }, 100);

      return () => clearInterval(checkScript);
    }

    setupObserver();

    function setupObserver() {
      // Create Intersection Observer to load ad when it becomes visible
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !isVisible) {
              setIsVisible(true);
              // Small delay to ensure container is fully rendered
              setTimeout(() => {
                loadAd();
              }, 100);
            }
          });
        },
        {
          rootMargin: '50px', // Start loading 50px before ad comes into view
          threshold: 0.1
        }
      );

      if (adRef.current) {
        observerRef.current.observe(adRef.current);
      }
    }

    return () => {
      if (observerRef.current && adRef.current) {
        observerRef.current.unobserve(adRef.current);
      }
    };
  }, []);

  const loadAd = () => {
    if (pushedRef.current || !adRef.current) return;

    // Ensure container has width (is rendered)
    const width = adRef.current.offsetWidth;
    if (width === 0) {
      // Retry after a short delay if container not ready
      setTimeout(loadAd, 200);
      return;
    }

    try {
      // Check if adsbygoogle is available
      if (typeof (window as any).adsbygoogle === 'undefined') {
        console.warn('AdSense script not loaded');
        return;
      }

      // Push ad to AdSense
      (window as any).adsbygoogle = (window as any).adsbygoogle || [];
      (window as any).adsbygoogle.push({});
      pushedRef.current = true;
      setIsLoaded(true);
    } catch (e) {
      console.error('AdSense error:', e);
      // Retry once after delay
      if (!pushedRef.current) {
        setTimeout(() => {
          try {
            (window as any).adsbygoogle = (window as any).adsbygoogle || [];
            (window as any).adsbygoogle.push({});
            pushedRef.current = true;
            setIsLoaded(true);
          } catch (retryError) {
            console.error('AdSense retry error:', retryError);
          }
        }, 1000);
      }
    }
  };

  // Fallback: Load ad after component mounts if Intersection Observer not supported
  useEffect(() => {
    if (!isVisible && typeof window !== 'undefined') {
      const fallbackTimer = setTimeout(() => {
        if (!pushedRef.current && adRef.current) {
          const width = adRef.current.offsetWidth;
          if (width > 0) {
            setIsVisible(true);
            setTimeout(loadAd, 100);
          }
        }
      }, 2000); // Fallback after 2 seconds

      return () => clearTimeout(fallbackTimer);
    }
  }, [isVisible]);

  // Set fixed height to prevent layout shift
  const containerHeight = adFormat === 'vertical' ? '600px' : adFormat === 'horizontal' ? '90px' : '280px';
  
  // Don't render ad element on server to prevent hydration mismatch
  if (!isMounted) {
    return (
      <div
        className={`w-full flex justify-center items-center relative ${className}`}
        style={{ 
          height: containerHeight,
          minHeight: containerHeight,
          ...style 
        }}
      >
        <div className="absolute text-gray-400 text-xs">
          Loading ad...
        </div>
      </div>
    );
  }
  
  return (
    <div
      ref={adRef}
      className={`w-full flex justify-center items-center relative ${className}`}
      style={{ 
        height: containerHeight,
        minHeight: containerHeight,
        ...style 
      }}
    >
      <ins
        className="adsbygoogle"
        style={{ 
          display: 'block',
          width: '100%',
          height: containerHeight,
          minHeight: containerHeight
        }}
        // data-ad-client="ca-pub-7998229594949316"
        data-ad-slot={finalAdSlot}
        data-ad-format={adFormat}
        data-full-width-responsive="true"
      />
      {!isLoaded && (
        <div className="absolute text-gray-400 text-xs">
          Loading ad...
        </div>
      )}
    </div>
  );
}
