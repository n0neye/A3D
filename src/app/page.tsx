'use client';

import { EditorProvider } from './context/EditorContext';
import EditorContainer from './components/EditorContainer';
import { RenderSettingsProvider } from './context/RenderSettingsContext';

export default function Home() {
  return (
    <EditorProvider>
      <RenderSettingsProvider>
        <EditorContainer />
      </RenderSettingsProvider>
    </EditorProvider>
  );
}
