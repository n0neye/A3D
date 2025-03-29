'use client';

import { EditorProvider } from './context/EditorContext';
import EditorContainer from './components/EditorContainer';
import { ProjectSettingsProvider } from './context/ProjectSettingsContext';

export default function Home() {
  return (
    <EditorProvider>
      <ProjectSettingsProvider>
        <EditorContainer />
      </ProjectSettingsProvider>
    </EditorProvider>
  );
}
