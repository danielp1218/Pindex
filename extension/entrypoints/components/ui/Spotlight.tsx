import { useState, useEffect } from 'react';

export function Spotlight() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div style={{
      pointerEvents: 'none',
      position: 'fixed',
      inset: 0,
      zIndex: 30,
      transition: 'duration-300',
    }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 1,
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59, 130, 246, 0.15), transparent 40%)`,
        }}
      />
    </div>
  );
}
