
interface Coords {
  latitude: number;
  longitude: number;
}

// A simplified map of country codes to official languages.
// In a real app, this would be a more comprehensive library or API.
const countryLanguageMap: Record<string, string> = {
  US: 'English', DE: 'German', FR: 'French', ES: 'Spanish', IT: 'Italian',
  JP: 'Japanese', CN: 'Mandarin Chinese', RU: 'Russian', IN: 'Hindi', BR: 'Portuguese',
  GB: 'English', CA: 'English', AU: 'English', MX: 'Spanish', AR: 'Spanish',
  ZA: 'English', NG: 'English', EG: 'Arabic', SA: 'Arabic', KR: 'Korean',
  TR: 'Turkish', ID: 'Indonesian', PK: 'Urdu', BD: 'Bengali', VN: 'Vietnamese'
};


export const getCurrentLocation = (): Promise<{ city: string; country: string; countryCode: string }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          // In a real app, you'd use a reverse geocoding API.
          // Here, we simulate it for demonstration purposes.
          // This public API is just for demo, rate limits may apply.
          const { latitude, longitude } = position.coords;
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          if (!response.ok) {
              throw new Error("Reverse geocoding failed.")
          }
          const data = await response.json();
          const address = data.address;
          resolve({
            city: address.city || address.town || address.village || 'Unknown City',
            country: address.country || 'Unknown Country',
            countryCode: (address.country_code || 'us').toUpperCase(),
          });
        } catch (error) {
          console.error("Using fallback location due to geocoding error:", error);
           resolve({ city: 'Mountain View', country: 'United States', countryCode: 'US' });
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        // Fallback for when permission is denied or location is unavailable
        resolve({ city: 'Mountain View', country: 'United States', countryCode: 'US' });
      }
    );
  });
};

export const getLanguageForCountry = (countryCode: string): string => {
  return countryLanguageMap[countryCode] || 'English'; // Default to English
};
