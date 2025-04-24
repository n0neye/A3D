import React, { useEffect, useState, useRef } from 'react';
import { IconCheck } from '@tabler/icons-react';
import { ImageRatio } from '@/engine/utils/imageUtil';
import { Button } from './ui/button';

// Ratio options with icons
const ratioOptions: { value: ImageRatio; label: string }[] = [
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '16:9', label: '16:9' },
  { value: '3:4', label: '3:4' },
  { value: '9:16', label: '9:16' },
];

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
      <Button
        variant={'ghost'}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`h-6 px-1 flex items-center justify-center gap-1`}
        title="Aspect Ratio"
      >
        <div className='flex items-center justify-center h-4 rounded'>
          <div className={`${getRatioIconClass(value)}`}></div>
        </div>
        <span className="text-xs">{value}</span>
      </Button>

      {isOpen && !disabled && (
        <div className="absolute bottom-8 z-10 left-0 mt-1 panel-shape shadow-lg rounded-md py-1 min-w-[160px]">
          {ratioOptions.map((option) => (
            <div
              key={option.value}
              className="px-3 py-2 flex items-center hover:bg-gray-500 cursor-pointer"
              onClick={() => {
                onChange(option.value as ImageRatio);
                setIsOpen(false);
              }}
            >
              <div className={`${getRatioIconClass(option.value as ImageRatio)} mr-2`}></div>
              <span className="text-sm ">{option.label}</span>
              {value === option.value && <IconCheck size={16} className="ml-auto text-blue-400" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RatioSelector; 