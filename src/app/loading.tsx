export default function Loading() {
  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-4">
      <img src="/icon-192.png" alt="Bortobet" className="w-16 h-16 rounded-2xl" />
      <div className="w-8 h-8 border-2 border-white/10 border-t-[#e10600] rounded-full animate-spin" />
    </div>
  );
}
