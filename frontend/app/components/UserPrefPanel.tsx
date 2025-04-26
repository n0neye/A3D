'use client';

import React, { useEffect, useState } from 'react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IconSettings, IconSun, IconMoon, IconEye, IconEyeOff } from '@tabler/icons-react';
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
  };

  useEffect(() => {
    setApiKeyInput(userPreferences.falApiKey);
  }, [userPreferences.falApiKey]);

  useEffect(() => {
    setUserPreference('falApiKey', apiKeyInput);
  }, [apiKeyInput]);

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
          <h3 className="text-sm font-bold">User Preferences</h3>

          <div className="space-y-4">
            {/* Theme Toggle */}
            <div className="flex justify-between items-center">
              <Label htmlFor="theme-toggle" className="text-xs flex items-center gap-2">
                Dark Mode
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
              <div className="flex">
                <Input
                  id="api-key"
                  type={showApiKey ? "text" : "password"}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Enter your API key"
                  className="text-xs h-8 rounded-r-none"
                />
                <Button
                  variant={showApiKey ? "default" : "outline"}
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="rounded-l-none h-8 w-8"
                  title={showApiKey ? "Showing API Key" : "Hiding API Key"}
                >
                  {showApiKey ? <IconEye size={16} /> : <IconEyeOff size={16} />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserPrefPanel;
