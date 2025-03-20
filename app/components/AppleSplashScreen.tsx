'use client';

import React, { useEffect, useState } from 'react';

// This component adds specific meta tags and links for iOS splash screens
const AppleSplashScreen = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Prevent overscroll/bounce effect on iOS
    document.body.addEventListener('touchmove', (e) => {
      if (
        // @ts-ignore - Safari-specific property
        window.navigator.standalone === true &&
        e.target &&
        // @ts-ignore - Using closest to find scrollable parent
        !(e.target as Element).closest('div[data-scrollable="true"]')
      ) {
        e.preventDefault();
      }
    }, { passive: false });
    
    // Fix for vh units in iOS
    const setVHUnit = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    setVHUnit();
    window.addEventListener('resize', setVHUnit);
    
    return () => {
      window.removeEventListener('resize', setVHUnit);
    };
  }, []);

  // Only render on client side
  if (!mounted) return null;
  
  // Use logo.png from the public images folder for the splash screen icon
  const iconPath = '/images/logo.png';
  
  return (
    <>
      {/* iOS Icon */}
      <link rel="apple-touch-icon" href={iconPath} />
      
      {/* iOS Splash Screens - we're using a simple approach with just one image */}
      <link
        rel="apple-touch-startup-image"
        href={iconPath}
        media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)"
      />
    </>
  );
};

export default AppleSplashScreen; 