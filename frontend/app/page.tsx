'use client';

import { useEffect, useState } from 'react';
import { Laptop } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditorEngineProvider } from './context/EditorEngineContext';

export default function Home() {
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    console.log("page.tsx init")
    setIsClient(true);

    // Function to check if device is mobile based on screen width
    const checkIfMobile = () => {
      const width = window.innerWidth;
      // setIsMobile(width < 1024); // Consider devices with width less than 1024px as mobile
    };

    // Check initially
    checkIfMobile();

    // Add event listener to check on resize
    window.addEventListener('resize', checkIfMobile);

    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Only render content after client-side hydration
  if (!isClient) return null;

  if (isMobile) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black text-gray-200 p-4">
        <Card className="max-w-md w-full  bg-white/10">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              Mobile not supported ATM
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              The editor is designed for desktop use with a mouse and keyboard.
              Please access it from a computer.
            </p>
            <div className="flex justify-center">
              <Laptop className="h-24 w-24 text-gray-400" />
            </div>
            {/* <p className="text-sm text-gray-400">
              If you'd still like to continue on mobile, you may experience limited functionality and usability issues.
            </p>
            <button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md transition-colors"
              onClick={() => setIsMobile(false)}
            >
              Continue Anyway
            </button> */}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <EditorEngineProvider>
      < >
      </>
    </EditorEngineProvider>
  );
}
