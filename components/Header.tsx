
import React from 'react';
import { Feature } from '../types';

interface HeaderProps {
  activeFeature: Feature;
  setActiveFeature: (feature: Feature) => void;
}

const Header: React.FC<HeaderProps> = ({ activeFeature, setActiveFeature }) => {
  const navItems: Feature[] = ['SOS', 'NEWS'];

  return (
    <header className="bg-gray-800 shadow-lg">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-white">
              SOS<span className="text-brand-accent">Connect</span>
            </h1>
          </div>
          <nav className="flex space-x-2 bg-gray-700 p-1 rounded-lg">
            {navItems.map((item) => (
              <button
                key={item}
                onClick={() => setActiveFeature(item)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${
                  activeFeature === item
                    ? item === 'SOS' ? 'bg-brand-sos text-white' : 'bg-brand-news text-white'
                    : 'text-gray-300 hover:bg-gray-600'
                }`}
              >
                {item === 'SOS' ? '🔴 SOS' : '🟢 Share Story'}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
