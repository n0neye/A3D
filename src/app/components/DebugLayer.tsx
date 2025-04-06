
import { Inspector } from '@babylonjs/inspector';
import { useEffect, useState } from 'react';
import { useOldEditorContext } from '../context/OldEditorContext';

function DebugLayer() {
    const [showInspector, setShowInspector] = useState(false);
    const { scene, isDebugMode, setIsDebugMode } = useOldEditorContext();

    useEffect(() => {
        if (!scene) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            console.log("DebugLayer handleKeyDown", event.ctrlKey, event.key);
            // Toggle inspector with Ctrl+\
            if (event.ctrlKey && event.key === '\\') {
                event.preventDefault();
                setShowInspector(prev => {
                    const newValue = !prev;
                    if (newValue) {
                        Inspector.Show(scene, { overlay: true, embedMode: false });
                    } else {
                        Inspector.Hide();
                    }
                    setIsDebugMode(newValue);
                    return newValue;
                });
                return;
            }
        }

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        }
    }, [scene])

    return (
        <></>
    );
}

export default DebugLayer;