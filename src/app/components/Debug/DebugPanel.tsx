import React, { useState } from 'react';
import { useEditorEngine } from '@/app/context/EditorEngineContext';
import SceneOutliner from './SceneOutliner';
import EntityDetails from './EntityDetails';
import { Bug, X } from 'lucide-react';
import { Button } from "@/components/ui/button";

const DebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { engine } = useEditorEngine();

  if (!engine) return null;

  return (
    <>
      {/* Debug Toggle Button */}
      {!isOpen && (
        <Button 
          variant="outline" 
          size="icon"
          className="fixed bottom-4 left-4 z-50 bg-background shadow-md"
          onClick={() => setIsOpen(true)}
        >
          <Bug className="h-4 w-4" />
        </Button>
      )}

      {/* Debug Panel */}
      {isOpen && (
        <div className="fixed left-4 bottom-4 w-80 h-[calc(100vh-8rem)] z-50 bg-background border rounded-lg shadow-lg flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-medium flex items-center">
              <Bug className="h-4 w-4 mr-2" />
              Debug Panel
            </h3>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-1 p-4 overflow-hidden">
            <SceneOutliner />
          </div>
          
          <div className="p-4 border-t">
            <EntityDetails />
          </div>
        </div>
      )}
    </>
  );
};

export default DebugPanel; 