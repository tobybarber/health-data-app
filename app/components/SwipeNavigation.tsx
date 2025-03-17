'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// Define the navigation routes in order
const routes = ['/', '/upload', '/records', '/analysis', '/wearables'];

export default function SwipeNavigation({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationClass, setAnimationClass] = useState('');
  
  // Minimum swipe distance to trigger navigation (in pixels)
  const minSwipeDistance = 50;

  // Function to navigate without triggering Safari bars
  const navigateWithoutBars = (path: string) => {
    // Use replaceState to change the URL without triggering a full navigation
    // This helps prevent Safari from showing the navigation bars
    window.history.replaceState(null, '', path);
    
    // Then use Next.js router to update the UI
    router.push(path);
  };

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      setTouchStartX(e.touches[0].clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartX || isAnimating) return;
      
      const currentX = e.touches[0].clientX;
      const diff = touchStartX - currentX;
      
      // Determine swipe direction for visual feedback
      if (Math.abs(diff) > 20) {
        setSwipeDirection(diff > 0 ? 'left' : 'right');
      } else {
        setSwipeDirection(null);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartX || isAnimating) return;
      
      setTouchEndX(e.changedTouches[0].clientX);
      
      const distance = touchStartX - e.changedTouches[0].clientX;
      
      // Only navigate if the swipe distance is significant
      if (Math.abs(distance) > minSwipeDistance) {
        const currentIndex = routes.indexOf(pathname);
        
        // If current page is not in our routes array, don't navigate
        if (currentIndex === -1) {
          setSwipeDirection(null);
          return;
        }
        
        if (distance > 0) {
          // Swipe left - go to next page
          const nextIndex = Math.min(currentIndex + 1, routes.length - 1);
          if (nextIndex !== currentIndex) {
            // Show animation
            setIsAnimating(true);
            setAnimationClass('slide-out-left');
            
            // Navigate after animation completes
            setTimeout(() => {
              navigateWithoutBars(routes[nextIndex]);
              
              // Reset animation after navigation
              setTimeout(() => {
                setAnimationClass('');
                setIsAnimating(false);
              }, 50);
            }, 250);
          }
        } else {
          // Swipe right - go to previous page
          const prevIndex = Math.max(currentIndex - 1, 0);
          if (prevIndex !== currentIndex) {
            // Show animation
            setIsAnimating(true);
            setAnimationClass('slide-out-right');
            
            // Navigate after animation completes
            setTimeout(() => {
              navigateWithoutBars(routes[prevIndex]);
              
              // Reset animation after navigation
              setTimeout(() => {
                setAnimationClass('');
                setIsAnimating(false);
              }, 50);
            }, 250);
          }
        }
      }
      
      // Reset touch coordinates and direction
      setTouchStartX(null);
      setTouchEndX(null);
      setSwipeDirection(null);
    };

    // Add event listeners
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);

    // Clean up event listeners
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [touchStartX, pathname, router, isAnimating]);

  // Apply subtle feedback during swipe
  let feedbackClass = '';
  if (!isAnimating && swipeDirection === 'left') {
    feedbackClass = 'translate-x-[-3%] transition-transform duration-200';
  } else if (!isAnimating && swipeDirection === 'right') {
    feedbackClass = 'translate-x-[3%] transition-transform duration-200';
  }

  return (
    <div className={`${feedbackClass} ${animationClass}`}>
      {children}
    </div>
  );
} 