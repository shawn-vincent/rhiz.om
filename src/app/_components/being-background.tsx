// src/app/_components/being-background.tsx
import React from 'react';

export function BeingBackground() {
  return (
    <div
      className="absolute inset-0 z-0 bg-cover bg-center"
      style={{ backgroundImage: `url('https://upload.wikimedia.org/wikipedia/commons/1/14/Rockies_in_the_morning.jpg')` }}
    ></div>
  );
}
