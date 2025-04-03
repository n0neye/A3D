import SkeletonTestScene from './SkeletonTestScene';

export default function SkeletonTestPage() {
  return (
    <div className="w-full h-screen flex flex-col">
      <h1 className="text-2xl font-bold p-4">Skeleton Test</h1>
      <div className="flex-grow">
        <SkeletonTestScene />
      </div>
    </div>
  );
} 