'use client';

import { useState, useActionState } from 'react';
import { requestPasswordReset, resetPassword } from '@/lib/actions';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email');
  const [email, setEmail] = useState('');

  const [requestState, requestAction, requestPending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await requestPasswordReset(prev, formData);
      if (result?.success && result.email) {
        setEmail(result.email);
        setStep('code');
      }
      return result;
    },
    null,
  );

  const [resetState, resetAction, resetPending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      formData.set('email', email);
      const result = await resetPassword(prev, formData);
      if (result?.success) setStep('done');
      return result;
    },
    null,
  );

  return (
    <main className="min-h-screen bg-[#15151e] flex items-center justify-center p-6 text-white">
      <div className="w-full max-w-md bg-[#1f1f27] rounded-3xl p-10 border border-gray-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-[#e10600]"></div>

        <header className="text-center mb-8">
          <h1 className="text-[#e10600] text-4xl font-black italic uppercase tracking-tighter">F1 BORTOBET</h1>
          <p className="text-gray-400 text-xs mt-2 font-medium uppercase tracking-widest">
            {step === 'done' ? 'Senha Redefinida' : 'Recuperar Senha'}
          </p>
        </header>

        {step === 'email' && (
          <form action={requestAction} className="space-y-5">
            {requestState?.error && (
              <div className="bg-red-900/20 border border-red-600 text-red-500 text-xs p-3 rounded-xl text-center font-bold">
                {requestState.error}
              </div>
            )}

            <p className="text-gray-400 text-sm text-center">
              Informe seu e-mail para receber um código de recuperação.
            </p>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1 tracking-widest">E-mail</label>
              <input
                name="email"
                type="email"
                required
                className="w-full bg-[#2b2b35] border border-transparent rounded-xl p-4 text-white focus:ring-2 focus:ring-[#e10600] outline-none transition-all"
                placeholder="seu@email.com"
              />
            </div>

            <button
              type="submit"
              disabled={requestPending}
              className="w-full mt-4 bg-[#e10600] hover:bg-[#ff0700] disabled:bg-gray-700 text-white font-black py-4 rounded-xl transition-all uppercase italic text-lg shadow-lg active:scale-95"
            >
              {requestPending ? 'Enviando...' : 'Enviar Código'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form action={resetAction} className="space-y-5">
            {resetState?.error && (
              <div className="bg-red-900/20 border border-red-600 text-red-500 text-xs p-3 rounded-xl text-center font-bold">
                {resetState.error}
              </div>
            )}

            <p className="text-gray-400 text-sm text-center">
              Enviamos um código para <span className="text-white font-bold">{email}</span>
            </p>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1 tracking-widest">Código</label>
              <input
                name="code"
                type="text"
                required
                inputMode="numeric"
                maxLength={6}
                className="w-full bg-[#2b2b35] border border-transparent rounded-xl p-4 text-white text-center text-2xl font-black tracking-[0.5em] focus:ring-2 focus:ring-[#e10600] outline-none transition-all"
                placeholder="000000"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1 tracking-widest">Nova Senha</label>
              <input
                name="password"
                type="password"
                required
                minLength={6}
                className="w-full bg-[#2b2b35] border border-transparent rounded-xl p-4 text-white focus:ring-2 focus:ring-[#e10600] outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1 tracking-widest">Confirmar Senha</label>
              <input
                name="confirmPassword"
                type="password"
                required
                minLength={6}
                className="w-full bg-[#2b2b35] border border-transparent rounded-xl p-4 text-white focus:ring-2 focus:ring-[#e10600] outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={resetPending}
              className="w-full mt-4 bg-[#e10600] hover:bg-[#ff0700] disabled:bg-gray-700 text-white font-black py-4 rounded-xl transition-all uppercase italic text-lg shadow-lg active:scale-95"
            >
              {resetPending ? 'Redefinindo...' : 'Redefinir Senha'}
            </button>

            <button
              type="button"
              onClick={() => setStep('email')}
              className="w-full text-gray-500 text-sm hover:text-gray-300 transition-colors"
            >
              Usar outro e-mail
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="text-center space-y-6">
            <div className="text-green-400 text-5xl">&#10003;</div>
            <p className="text-gray-300 text-sm">Sua senha foi redefinida com sucesso.</p>
            <Link
              href="/login"
              className="block w-full bg-[#e10600] hover:bg-[#ff0700] text-white font-black py-4 rounded-xl transition-all uppercase italic text-lg shadow-lg active:scale-95 text-center"
            >
              Entrar no Grid
            </Link>
          </div>
        )}

        {step !== 'done' && (
          <div className="mt-8 text-center">
            <Link href="/login" className="text-gray-500 text-sm hover:text-[#e10600] transition-colors">
              Lembrou a senha? <span className="font-bold underline">Voltar ao login</span>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
