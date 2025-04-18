'use client';

import React, { useState } from 'react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IconSettings, IconSun, IconMoon } from '@tabler/icons-react';
import { useEditorEngine } from '../context/EditorEngineContext';

const UserPrefPanel: React.FC = () => {
  const { userPreferences, setUserPreference } = useEditorEngine();
  const [apiKeyInput, setApiKeyInput] = useState(userPreferences.falApiKey);
  
  // Show/hide API key 
  const [showApiKey, setShowApiKey] = useState(false);
  
  // Handle theme toggle
  const handleThemeToggle = (checked: boolean) => {
    const newTheme = checked ? 'dark' : 'light';
    setUserPreference('theme', newTheme);
    document.documentElement.classList.toggle('dark', checked);
  };
  
  // Handle API key update
  const handleSaveApiKey = () => {
    setUserPreference('falApiKey', apiKeyInput);
  };

  return (
    <div className='group relative'>
      <Button
        variant={'outline'}
        size="icon"
        aria-label="user preferences"
        className='relative'
      >
        <IconSettings className="h-4 w-4" />
      </Button>
      <div className="hidden group-hover:block absolute top-8 pt-5 right-0">
        <div className="panel-shape p-4 space-y-4 w-64">
          <h3 className="text-sm font-medium">User Preferences</h3>
          
          <div className="space-y-4">
            {/* Theme Toggle */}
            <div className="flex justify-between items-center">
              <Label htmlFor="theme-toggle" className="text-xs flex items-center gap-2">
                Theme
                {userPreferences.theme === 'dark' ? 
                  <IconMoon className="h-3 w-3" /> : 
                  <IconSun className="h-3 w-3" />}
              </Label>
              <Switch
                id="theme-toggle"
                checked={userPreferences.theme === 'dark'}
                onCheckedChange={handleThemeToggle}
              />
            </div>
            
            {/* Fal.ai API Key */}
            <div className="space-y-2">
              <Label htmlFor="api-key" className="text-xs">Fal.ai API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="api-key"
                  type={showApiKey ? "text" : "password"}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Enter your API key"
                  className="text-xs h-8"
                />
              </div>
              <div className="flex justify-between items-center mt-1">
                <Label htmlFor="show-api-key" className="text-xs">
                  Show API Key
                </Label>
                <Switch
                  id="show-api-key"
                  checked={showApiKey}
                  onCheckedChange={setShowApiKey}
                />
              </div>
              
              <Button 
                size="sm" 
                className="w-full mt-2 h-8"
                onClick={handleSaveApiKey}
                disabled={apiKeyInput === userPreferences.falApiKey}
              >
                Save API Key
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserPrefPanel;
