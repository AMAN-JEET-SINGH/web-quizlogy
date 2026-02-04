'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { visitorTrackingApi } from '@/lib/visitorTracking';

export function VisitorTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    // Get screen resolution
    const screenResolution = typeof window !== 'undefined' 
      ? `${window.screen.width}x${window.screen.height}`
      : undefined;

    // Track page visit (backend automatically detects new sessions based on 30min timeout)
    visitorTrackingApi.trackVisit(pathname, screenResolution);

    // Track all clicks on the page
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Safely extract className (can be string, SVGAnimatedString, or DOMTokenList)
      let classNameStr = '';
      if (target.className) {
        if (typeof target.className === 'string') {
          classNameStr = target.className;
        } else if (typeof target.className === 'object') {
          // Check for SVGAnimatedString (has baseVal property)
          const classNameObj = target.className as any;
          if ('baseVal' in classNameObj && typeof classNameObj.baseVal === 'string') {
            // SVG element with SVGAnimatedString
            classNameStr = classNameObj.baseVal || '';
          } else if ('value' in classNameObj) {
            // Alternative SVG format
            classNameStr = String(classNameObj.value || '');
          } else {
            // DOMTokenList or other - convert to string
            classNameStr = String(target.className);
          }
        } else {
          // Fallback - convert to string
          classNameStr = String(target.className);
        }
      }
      
      // Get first class name if available
      const firstClass = classNameStr ? classNameStr.split(' ')[0] : '';
      const elementInfo = target.tagName + (target.id ? `#${target.id}` : '') + (firstClass ? `.${firstClass}` : '');
      
      // Track click with element info and current page
      visitorTrackingApi.trackClick(elementInfo, pathname);
    };

    // Track page exit when user leaves
    const handleBeforeUnload = () => {
      visitorTrackingApi.trackExit(pathname);
    };

    // Track when page becomes hidden (user switches tabs, closes window, etc.)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        visitorTrackingApi.trackExit(pathname);
      }
    };

    // Add click listener to document
    document.addEventListener('click', handleClick, true); // Use capture phase to catch all clicks

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Track exit on component unmount (route change)
      visitorTrackingApi.trackExit(pathname);
    };
  }, [pathname]);

  return null; // This component doesn't render anything
}

