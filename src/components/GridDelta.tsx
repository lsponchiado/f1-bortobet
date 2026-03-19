import { ChevronDown, ChevronUp, Minus } from 'lucide-react';

export function GridDelta({ delta }: { delta?: number | string }) {
  let content = null;

  if (typeof delta === 'string') {
    content = (
      <span className="text-red-500 font-black text-[10px] italic tracking-tight">{delta}</span>
    );
  } else if (delta !== undefined && delta > 0) {
    content = (
      <div className="flex flex-col items-center justify-center text-green-500 font-bold leading-tight">
        <ChevronUp size={16} strokeWidth={3} />
        <span>{delta}</span>
      </div>
    );
  } else if (delta !== undefined && delta < 0) {
    content = (
      <div className="flex flex-col items-center justify-center text-red-500 font-bold leading-tight">
        <span>{Math.abs(delta)}</span>
        <ChevronDown size={16} strokeWidth={3} />
      </div>
    );
  } else if (delta === 0) {
    content = <div className="flex items-center text-gray-500 font-bold"><Minus size={20} /></div>;
  }

  return (
    <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-sm bg-gray-800 text-sm">
      {content}
    </div>
  );
}