"use client";

import { useActionState, useState, useEffect } from "react";
import { registerUser } from "@/lib/actions";
import Link from "next/link";

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(registerUser, null);
  const [code, setCode] = useState("");

  // Limpa o código visual quando o servidor retorna um erro
  useEffect(() => {
    if (state?.error) {
      setCode("");
    }
  }, [state]);

  return (
    <main className="min-h-screen bg-[#15151e] flex items-center justify-center p-6 text-white font-sans">
      <div className="w-full max-w-md bg-[#1f1f27] rounded-3xl p-8 border border-gray-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-[#e10600]"></div>

        <header className="text-center mb-6">
          <h1 className="text-[#e10600] text-3xl font-black italic uppercase tracking-tighter">F1 BORTOBET</h1>
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">Crie sua ID de Piloto</p>
        </header>

        <form action={formAction} className="space-y-3">
          {state?.error && (
            <div className="bg-red-900/20 border border-red-600/50 text-red-500 text-[11px] p-3 rounded-xl text-center font-bold animate-shake">
              ⚠️ {state.error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1">Nome</label>
              <input name="name" defaultValue={state?.fields?.name} className="w-full bg-[#2b2b35] rounded-xl p-3 text-sm focus:ring-1 focus:ring-[#e10600] outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1">Username</label>
              <input name="username" defaultValue={state?.fields?.username} placeholder="claudio" className="w-full bg-[#2b2b35] rounded-xl p-3 text-sm focus:ring-1 focus:ring-[#e10600] outline-none transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1">E-mail</label>
            <input name="email" type="email" defaultValue={state?.fields?.email} className="w-full bg-[#2b2b35] rounded-xl p-3 text-sm focus:ring-1 focus:ring-[#e10600] outline-none transition-all" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1">Senha</label>
              <input name="password" type="password" className="w-full bg-[#2b2b35] rounded-xl p-3 text-sm focus:ring-1 focus:ring-[#e10600] outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1">Confirmar Senha</label>
              <input name="confirmPassword" type="password" className="w-full bg-[#2b2b35] rounded-xl p-3 text-sm focus:ring-1 focus:ring-[#e10600] outline-none transition-all" />
            </div>
          </div>

          <div className="pt-4">
            <label className="block text-[10px] font-bold text-[#e10600] uppercase mb-3 text-center tracking-widest">Código de Autorização</label>
            <div className="relative flex justify-center gap-1.5">
              <input
                name="inviteCode"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
              />
              {Array(8).fill(0).map((_, i) => (
                <div key={i} className={`w-8 h-11 border-2 rounded-lg flex items-center justify-center text-lg font-mono font-bold transition-all
                  ${code[i] ? 'border-[#e10600] bg-[#e10600]/10 text-white' : 'border-gray-700 bg-[#2b2b35] text-gray-600'}
                `}>
                  {code[i] || ""}
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={isPending} className="w-full bg-[#e10600] hover:bg-[#ff0700] disabled:bg-gray-800 text-white font-black py-4 rounded-xl transition-all uppercase italic mt-4">
            {isPending ? "Sincronizando..." : "Confirmar Cadastro"}
          </button>
        </form>
      </div>
    </main>
  );
}