'use client';

import { useEffect, useState } from 'react';

const HomeScreenDetect = () => {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if the app is running in standalone mode (added to home screen)
    const standalone = 
      // @ts-ignore - Safari-specific property
      window.navigator.standalone === true || 
      window.matchMedia('(display-mode: standalone)').matches;
    
    setIsStandalone(standalone);
    
    // Add a class to the body element for CSS targeting
    if (standalone) {
      document.body.classList.add('standalone-mode');
    }
    
    // Handle iOS viewport height issues (100vh behavior)
    const setAppHeight = () => {
      const doc = document.documentElement;
      doc.style.setProperty('--app-height', `${window.innerHeight}px`);
    };
    
    // Set the height initially and on resize
    window.addEventListener('resize', setAppHeight);
    setAppHeight();
    
    return () => {
      window.removeEventListener('resize', setAppHeight);
    };
  }, []);

  return null; // This component doesn't render anything visible
};

export default HomeScreenDetect; 