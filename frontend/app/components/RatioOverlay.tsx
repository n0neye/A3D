import { useEditorEngine } from '../context/EditorEngineContext';
import { useEffect, useState } from 'react';

interface BorderDimensions {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OverlayDimensions {
  frame: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  borders: {
    top: BorderDimensions;
    right: BorderDimensions;
    bottom: BorderDimensions;
    left: BorderDimensions;
  };
  isVisible: boolean;
}

export default function RatioOverlay() {
  const { engine } = useEditorEngine();
  const [dimensions, setDimensions] = useState<OverlayDimensions | null>(null);

  // Update dimensions whenever the camera or window changes
  useEffect(() => {
    const updateDimensions = () => {
      if (engine) {
        const cameraManager = engine.getCameraManager();
        const newDimensions = cameraManager.getRatioOverlayDimensions();
        setDimensions(newDimensions);
      }
    };

    // Initial update
    updateDimensions();

    // Listen for window resize
    window.addEventListener('resize', updateDimensions);

    // Listen for ratio changes using the camera observer
    const cameraManager = engine?.getCameraManager();
    if (cameraManager) {
      const observer = cameraManager.observer;
      
      const unsubVisibility = observer.subscribe('ratioOverlayVisibilityChanged', updateDimensions);
      const unsubPadding = observer.subscribe('ratioOverlayPaddingChanged', updateDimensions);
      const unsubRightPadding = observer.subscribe('ratioOverlayRightPaddingChanged', updateDimensions);
      const unsubRatio = observer.subscribe('ratioOverlayRatioChanged', updateDimensions);
      
      // Clean up on unmount
      return () => {
        window.removeEventListener('resize', updateDimensions);
        unsubVisibility();
        unsubPadding();
        unsubRightPadding();
        unsubRatio();
      };
    }
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, [engine]);

  // Don't render if no dimensions or overlay is not visible
  if (!dimensions || !dimensions.isVisible) return null;

  const { borders } = dimensions;

  const borderStyle = {
    position: 'absolute' as 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  };

  return (
    <div className="ratio-overlay fixed inset-0 pointer-events-none">
      {/* Top border */}
      <div style={{
        ...borderStyle,
        left: borders.top.x,
        top: borders.top.y,
        width: borders.top.width,
        height: borders.top.height,
      }} />
      
      {/* Right border */}
      <div style={{
        ...borderStyle,
        left: borders.right.x,
        top: borders.right.y,
        width: borders.right.width,
        height: borders.right.height,
      }} />
      
      {/* Bottom border */}
      <div style={{
        ...borderStyle,
        left: borders.bottom.x,
        top: borders.bottom.y,
        width: borders.bottom.width,
        height: borders.bottom.height,
      }} />
      
      {/* Left border */}
      <div style={{
        ...borderStyle,
        left: borders.left.x,
        top: borders.left.y,
        width: borders.left.width,
        height: borders.left.height,
      }} />
    </div>
  );
} 