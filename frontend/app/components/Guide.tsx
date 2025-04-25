'use client';

import React, { useState, useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ButtonLink from './ui/buttonLink';
import { siteConfig } from '@/siteConfig';
import { IconBrandGithub, IconBrandX, IconInfoSmall } from '@tabler/icons-react';
import { useEditorEngine } from '@/context/EditorEngineContext';

// List of shortcuts extracted from EditorContainer
const SHORTCUTS = [
    { key: 'Left/Middle Click Drag', description: 'Rotate camera' },
    { key: 'Right Click Drag', description: 'Pan camera' },
    { key: 'Scroll Wheel', description: 'Zoom camera' },
    // { key: 'Ctrl+Click', description: 'Create new generation' },
    { key: 'W', description: 'Move handle' },
    { key: 'E', description: 'Rotate handle' },
    { key: 'R', description: 'Scale handle' },
];

export default function Guide() {
    const { showGuide, setShowGuide } = useEditorEngine();
    const [showShortcuts, setShowShortcuts] = useState(false);

    // Show welcome message on first visit
    useEffect(() => {
        const hasVisited = localStorage.getItem('hasVisitedBefore');
        // const hasVisited = false;
        if (!hasVisited) {
            setShowGuide(true);
            localStorage.setItem('hasVisitedBefore', 'true');
        }
    }, []);

    // Close the welcome message
    const closeWelcome = () => {
        setShowGuide(false);
    };

    // Toggle shortcuts panel
    const toggleShortcuts = () => {
        setShowShortcuts(prev => !prev);
    };

    return (
        <>
            {/* Welcome overlay */}
            {showGuide && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <Card className="max-w-2xl w-full relative panel-shape p-8">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={closeWelcome}
                            className="absolute top-3 right-3"
                        >
                            <X size={20} />
                        </Button>

                        <div className='flex flex-col items-center gap-4'>
                            <div className='p-5'>
                                <img src="./logo.svg" alt="A3D Logo" className="w-64 drop-shadow-lg" />
                            </div>
                            <div className='flex flex-col gap-2 items-center'>
                                {/* Social links */}
                                <div className="flex items-center gap-2 mt-2">
                                    <ButtonLink href={siteConfig.links.github} className='w-8 h-8 rounded-full' variant='outline' > <IconBrandGithub /> </ButtonLink>
                                    <ButtonLink href={siteConfig.links.x} className='w-8 h-8 rounded-full' variant='outline' > <IconBrandX /> </ButtonLink>
                                </div>

                            </div>
                        </div>

                        <div className="space-y-6">
                            <hr className="border-gray-500" />
                            <h3 className="text-lg font-bold text-center">Getting Started</h3>
                            <p className='text-center'>
                                Enter your <ButtonLink href={siteConfig.guideLinks.falAPI} variant='secondary' >Fal.ai API key </ButtonLink> in the settings, 
                                or <ButtonLink href={siteConfig.guideLinks.comfyUI} variant='secondary'>install the ComfyUI Integration Node</ButtonLink> to get started.

                                Please note this is the beta version and is not ready for production. Any feedback is appreciated!
                            </p>


                            <hr className="border-gray-500" />
                            <h3 className="text-lg font-bold text-center">Keyboard Shortcuts</h3>
                            <div className="grid  md:grid-cols-2 gap-3 grid-rows-4 grid-flow-col">
                                {SHORTCUTS.map((shortcut, index) => (
                                    <div key={index} className="flex items-center gap-3">
                                        <span className="inline-flex items-center justify-center px-2 py-1 bg-white/10 outline outline-gray-800 rounded text-sm font-mono">
                                            {shortcut.key}
                                        </span>
                                        <span className="">{shortcut.description}</span>
                                    </div>
                                ))}
                            </div>

                            <Button
                                onClick={closeWelcome}
                                className="w-full"
                            >
                                Get Started
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Shortcuts panel (toggled) */}
            {showShortcuts && !showGuide && (
                <div className="fixed right-4 bottom-16 z-40">
                    <Card className="w-80 panel-shape">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Keyboard size={18} />
                                    Keyboard Shortcuts
                                </CardTitle>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={toggleShortcuts}
                                    className="h-8 w-8"
                                >
                                    <X size={16} />
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-2 pt-0">
                            {SHORTCUTS.map((shortcut, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <span className="inline-flex items-center justify-center px-2 py-0.5 bg-white/20 rounded text-xs font-mono">
                                        {shortcut.key}
                                    </span>
                                    <span className=" text-sm">{shortcut.description}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Toggle shortcuts button */}
            {/* <Button
                onClick={toggleShortcuts}
                variant="secondary"
                size="icon"
                className="fixed right-4 bottom-4 z-30 rounded-full shadow-lg"
                title="Keyboard shortcuts"
            >
                <Keyboard size={20} />
            </Button> */}

            <Button
                onClick={() => setShowGuide(true)}
                className="fixed right-4 bottom-4 z-30 rounded-full shadow-lg p-1 w-5 h-5 p-1"
                title="Keyboard shortcuts"
                variant='secondary'
                style={{ padding: 0 }}
            >
                <IconInfoSmall size={32} className='w-4 h-4' style={{ width: '32px', height: '32px' }} />
            </Button>
        </>
    );
}
