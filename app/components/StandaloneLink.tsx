'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReactNode, useContext } from 'react';
import { StandaloneModeContext } from './ClientWrapper';

type StandaloneLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  prefetch?: boolean;
  title?: string;
};

export default function StandaloneLink({
  href,
  children,
  className,
  style,
  onClick,
  prefetch = true,
  title,
  ...restProps
}: StandaloneLinkProps) {
  const router = useRouter();
  const { isStandalone } = useContext(StandaloneModeContext);

  // If not in standalone mode, just use the regular Next.js Link
  if (!isStandalone) {
    return (
      <Link 
        href={href} 
        className={className} 
        style={style} 
        onClick={onClick}
        prefetch={prefetch}
        title={title}
        {...restProps}
      >
        {children}
      </Link>
    );
  }

  // In standalone mode, handle the navigation ourselves to prevent Safari UI appearance
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    
    // First call any onClick handlers provided by the parent component
    if (onClick) {
      onClick(e);
    }
    
    // Force page to maximum scroll position (if at top) to hide Safari UI
    if (window.scrollY === 0) {
      window.scrollTo(0, 1);
    }
    
    // Add a transition effect to make navigation feel smoother
    document.body.style.opacity = '0.5';
    document.body.style.transition = 'opacity 0.1s ease';
    
    // Use setTimeout to allow the transition to start
    setTimeout(() => {
      // Push the route using Next.js router
      router.push(href);
      
      // Apply iOS standalone fixes after navigation
      setTimeout(() => {
        // Restore opacity
        document.body.style.opacity = '1';
        
        // Force Safari UI to hide by scrolling slightly
        if (window.scrollY === 0) {
          window.scrollTo(0, 1);
          setTimeout(() => window.scrollTo(0, 0), 50);
        }
      }, 50);
    }, 50);
  };

  return (
    <a 
      href={href} 
      className={className} 
      style={style} 
      onClick={handleClick}
      title={title}
      {...restProps}
    >
      {children}
    </a>
  );
} 