
import React from 'react';

interface GeneratedImageProps {
  src: string;
  alt: string;
}

const GeneratedImage: React.FC<GeneratedImageProps> = ({ src, alt }) => {
  return (
    <div className="bg-gray-800 p-2 rounded-lg shadow-md">
      <img src={src} alt={alt} className="w-full h-auto object-cover rounded" />
    </div>
  );
};

export default GeneratedImage;
