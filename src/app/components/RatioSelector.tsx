import React, { useEffect, useState, useRef } from 'react';
import { IconCheck } from '@tabler/icons-react';
import { ImageRatio } from '../util/generation-util';

// Ratio options with icons
const ratioOptions: { value: ImageRatio; label: string }[] = [
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '16:9', label: '16:9' },
  { value: '3:4', label: '3:4' },
  { value: '9:16', label: '9:16' },
];

// CSS for the ratio icons
const ratioIconStyles = `
.ratio-icon-square, .ratio-icon-wide, .ratio-icon-tall, .ratio-icon-standard, .ratio-icon-portrait {
  display: inline-block;
  border: 2px solid #9ca3af;
  border-radius: 2px;
}

.ratio-icon-square {
  width: 14px;
  height: 14px;
}

.ratio-icon-wide {
  width: 16px;
  height: 9px;
}

.ratio-icon-tall {
  width: 9px;
  height: 16px;
}

.ratio-icon-standard {
  width: 14px;
  height: 11px;
}

.ratio-icon-portrait {
  width: 11px;
  height: 14px;
}
`;

interface RatioSelectorProps {
  value: ImageRatio;
  onChange: (value: ImageRatio) => void;
  disabled?: boolean;
}

const RatioSelector: React.FC<RatioSelectorProps> = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Add global style for ratio icons
  useEffect(() => {
    // Only add the style sheet if it doesn't already exist
    if (!document.getElementById("ratio-icon-styles")) {
      const styleSheet = document.createElement("style");
      styleSheet.id = "ratio-icon-styles";
      styleSheet.textContent = ratioIconStyles;
      document.head.appendChild(styleSheet);
    }
    
    // No need to remove on unmount, as multiple instances might be using it
    // We'll let it persist
  }, []);

  // Generate ratio icon CSS class
  const getRatioIconClass = (ratio: ImageRatio) => {
    switch (ratio) {
      case '1:1': return 'ratio-icon-square';
      case '16:9': return 'ratio-icon-wide';
      case '9:16': return 'ratio-icon-tall';
      case '4:3': return 'ratio-icon-standard';
      case '3:4': return 'ratio-icon-portrait';
      default: return 'ratio-icon-square';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center justify-center p-1 w-6 h-6 rounded hover:bg-gray-700 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        title="Aspect Ratio"
      >
        <div className={`${getRatioIconClass(value)}`}></div>
        {/* <span className="text-xs text-gray-400">{value}</span> */}
      </button>
      
      {isOpen && !disabled && (
        <div className="absolute bottom-8 z-10 left-0 mt-1 panel-shape-dark shadow-lg rounded-md py-1 min-w-[160px]">
          {ratioOptions.map((option) => (
            <div
              key={option.value}
              className="px-3 py-2 flex items-center hover:bg-gray-700 cursor-pointer"
              onClick={() => {
                onChange(option.value as ImageRatio);
                setIsOpen(false);
              }}
            >
              <div className={`${getRatioIconClass(option.value as ImageRatio)} mr-2`}></div>
              <span className="text-sm text-gray-200">{option.label}</span>
              {value === option.value && <IconCheck size={16} className="ml-auto text-blue-400" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RatioSelector; 