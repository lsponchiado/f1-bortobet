export function GridPosition({ position }: { position: number }) {
  return (
    <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-sm bg-red-600 text-2xl font-black text-white shadow-lg">
      {position}
    </div>
  );
}