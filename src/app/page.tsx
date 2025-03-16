'use client';

import { EditorProvider } from './context/EditorContext';
import EditorContainer from './components/EditorContainer';

export default function Home() {
  return (
    <EditorProvider>
      <EditorContainer />
    </EditorProvider>
  );
}
