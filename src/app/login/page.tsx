"use client";

import { useActionState } from "react";
import { loginUser } from "@/lib/actions";
import Link from "next/link";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginUser, null);

  return (
    <main className="min-h-screen bg-[#15151e] flex items-center justify-center p-6 text-white">
      <div className="w-full max-w-md bg-[#1f1f27] rounded-3xl p-10 border border-gray-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-[#e10600]"></div>

        <header className="text-center mb-8">
          <h1 className="text-[#e10600] text-4xl font-black italic uppercase tracking-tighter">F1 BORTOBET</h1>
          <p className="text-gray-400 text-xs mt-2 font-medium uppercase tracking-widest">Acesse seu Paddock</p>
        </header>

        <form action={formAction} className="space-y-5">
          {state?.error && (
            <div className="bg-red-900/20 border border-red-600 text-red-500 text-xs p-3 rounded-xl text-center font-bold">
              ⚠️ {state.error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1 tracking-widest">E-mail ou Username</label>
            <input 
              name="identifier" // <<--- O NOME DA "PEÇA" QUE DEVE COMBINAR COM A ACTION
              type="text" 
              required 
              className="w-full bg-[#2b2b35] border border-transparent rounded-xl p-4 text-white focus:ring-2 focus:ring-[#e10600] outline-none transition-all"
              placeholder="seu@email.com ou username"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1 tracking-widest">Senha</label>
            <input 
              name="password" 
              type="password" 
              required 
              className="w-full bg-[#2b2b35] border border-transparent rounded-xl p-4 text-white focus:ring-2 focus:ring-[#e10600] outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full mt-4 bg-[#e10600] hover:bg-[#ff0700] disabled:bg-gray-700 text-white font-black py-4 rounded-xl transition-all uppercase italic text-lg shadow-lg active:scale-95"
          >
            {isPending ? "Autenticando..." : "Entrar no Grid"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <Link href="/register" className="text-gray-500 text-sm hover:text-[#e10600] transition-colors">
            Não tem uma credencial? <span className="font-bold underline">Solicitar acesso</span>
          </Link>
        </div>
      </div>
    </main>
  );
}