import React, { useState } from 'react';
import { useEditorEngine } from '@/context/EditorEngineContext';
import SceneOutliner from './SceneOutliner';
import EntityDetails from './EntityDetails';
import ThreeJsDebugView from './ThreeDebugView';
import { Bug, X, Keyboard, Layers } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("threejs");
  const { engine } = useEditorEngine();

  if (!engine) return null;

  return (
    <>
      {/* Debug Toggle Button */}
      {!isOpen && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon"
                className="fixed bottom-4 left-4 z-50 bg-background shadow-md"
                onClick={() => setIsOpen(true)}
              >
                <Bug className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Open Debug Panel</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Debug Panel */}
      {isOpen && (
        <div className="fixed left-4 bottom-4 w-80 h-[calc(100vh-8rem)] z-50 bg-background border rounded-lg shadow-lg flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-medium flex items-center">
              <Bug className="h-4 w-4 mr-2" />
              Debug Panel
            </h3>
            <div className="flex items-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="mr-1">
                      <Keyboard className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs space-y-1">
                      <div><span className="font-bold">F</span> - Focus on selected entity</div>
                      <div><span className="font-bold">Delete</span> - Delete selected entity</div>
                      <div><span className="font-bold">W/E/R/T</span> - Change transform mode</div>
                      <div><span className="font-bold">Ctrl+D</span> - Duplicate entity</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TabsList className="grid grid-cols-2 mx-4 mt-2">
              <TabsTrigger value="entities" className="text-xs">
                Entities
              </TabsTrigger>
              <TabsTrigger value="threejs" className="text-xs">
                Three.js
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="entities" className="flex-1 overflow-hidden flex flex-col p-4 pt-2">
              <div className="flex-1 overflow-hidden">
                <SceneOutliner />
              </div>
              
              <div className="mt-4 pt-2 border-t border-gray-200 dark:border-gray-800">
                <EntityDetails />
              </div>
            </TabsContent>
            
            <TabsContent value="threejs" className="flex-1 overflow-hidden flex flex-col p-4 pt-2">
              <ThreeJsDebugView />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </>
  );
};

export default DebugPanel; 