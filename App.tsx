
import React, { useState } from 'react';
import SosFeature from './components/SosFeature';
import NewsFeature from './components/NewsFeature';
import Header from './components/Header';
import { Feature } from './types';

const App: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState<Feature>('SOS');

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans flex flex-col">
      <Header activeFeature={activeFeature} setActiveFeature={setActiveFeature} />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
        {activeFeature === 'SOS' ? <SosFeature /> : <NewsFeature />}
      </main>
      <footer className="text-center p-4 text-xs text-gray-500">
        <p>SOSConnect &copy; 2025. Making every voice heard, everywhere.</p>
      </footer>
    </div>
  );
};

export default App;