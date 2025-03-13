import SceneViewer from './components/SceneViewer';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-8">
      <div className="w-full max-w-5xl">
        <h1 className="text-3xl font-bold mb-6">3D-to-Image Generator</h1>
        
        <p className="mb-6 text-gray-600">
          Create 3D scenes and generate high-quality images using AI.
        </p>
        
        <div className="p-4 bg-white rounded-lg shadow-md">
          <SceneViewer />
        </div>
      </div>
    </main>
  );
}
