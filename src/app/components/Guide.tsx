'use client';

import React, { useState, useEffect } from 'react';
import { X, Keyboard, MousePointer, Info } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// List of shortcuts extracted from EditorContainer
const SHORTCUTS = [
    { key: 'Left/Middle Click Drag', description: 'Rotate camera' },
    { key: 'Right Click Drag', description: 'Pan camera' },
    { key: 'Scroll Wheel', description: 'Zoom camera' },
    { key: 'Ctrl+Click', description: 'Create new generation' },
    { key: 'W', description: 'Move handle' },
    { key: 'E', description: 'Scale handle' },
    { key: 'R', description: 'Rotate handle' },
];

export default function Guide() {
    const [showWelcome, setShowWelcome] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);

    // Show welcome message on first visit
    useEffect(() => {
        const hasVisited = localStorage.getItem('hasVisitedBefore');
        // const hasVisited = false;
        if (!hasVisited) {
            setShowWelcome(true);
            localStorage.setItem('hasVisitedBefore', 'true');
        }
    }, []);

    // Close the welcome message
    const closeWelcome = () => {
        setShowWelcome(false);
    };

    // Toggle shortcuts panel
    const toggleShortcuts = () => {
        setShowShortcuts(prev => !prev);
    };

    return (
        <>
            {/* Welcome overlay */}
            {showWelcome && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <Card className="max-w-2xl w-full relative panel-shape">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={closeWelcome}
                            className="absolute top-3 right-3 text-gray-400 hover:text-white"
                        >
                            <X size={20} />
                        </Button>

                        <CardHeader>
                            <CardTitle className="text-2xl">{"Hi :)"}</CardTitle>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            <p className="text-gray-300">
                                Welcome to this 3D AI editor demo.
                                Please notice that this is not a product and may stop working in anytime for maintenance. Enjoy!
                            </p>
                            <hr className="border-gray-500" />

                            <div className="grid  md:grid-cols-2 gap-3 grid-rows-4 grid-flow-col">
                                {SHORTCUTS.map((shortcut, index) => (
                                    <div key={index} className="flex items-center gap-3">
                                        <span className="inline-flex items-center justify-center px-2 py-1 bg-white/10 outline outline-gray-800 rounded text-sm font-mono">
                                            {shortcut.key}
                                        </span>
                                        <span className="text-gray-300">{shortcut.description}</span>
                                    </div>
                                ))}
                            </div>

                            <Button
                                onClick={closeWelcome}
                                className="w-full"
                            >
                                Get Started
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Shortcuts panel (toggled) */}
            {showShortcuts && !showWelcome && (
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
                                    <span className="text-gray-300 text-sm">{shortcut.description}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Toggle shortcuts button */}
            <Button
                onClick={toggleShortcuts}
                variant="secondary"
                size="icon"
                className="fixed right-4 bottom-4 z-30 rounded-full shadow-lg"
                title="Keyboard shortcuts"
            >
                <Keyboard size={20} />
            </Button>
        </>
    );
}
