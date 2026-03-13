import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/Navbar';

export default async function RegrasPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const displayUsername = (session.user as any).username || session.user.name || 'User';

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar username={displayUsername} isAdmin={(session.user as any).role === 'ADMIN'} />
      <main className="pt-6 pb-40 md:pb-12 px-6 lg:px-12 flex flex-col items-center">
        <div className="w-full max-w-3xl space-y-8">

          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white leading-none">
              Regulamento
            </h1>
            <p className="text-[#e10600] text-xs font-bold uppercase tracking-widest mt-2">
              Guia Oficial de Mecânicas · Web App F1 2026
            </p>
          </div>

          {/* Pontuação Básica */}
          <section className="bg-[#1f1f27] rounded-3xl border border-white/5 overflow-hidden">
            <div className="h-1 w-full bg-[#e10600]" />
            <div className="p-6 md:p-8 space-y-5">
              <div>
                <h2 className="text-xl font-black italic uppercase tracking-tight text-white">
                  Pontuação do Grid
                </h2>
                <p className="text-[#e10600] text-xs font-bold uppercase tracking-widest mt-0.5">
                  Escala Oficial da F1
                </p>
                <p className="text-gray-400 text-sm mt-2 italic">
                  Pontos atribuídos com base na posição final de cada piloto que você apostou no Top 10.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                {[
                  ['P1', 25], ['P2', 18], ['P3', 15], ['P4', 12], ['P5', 10],
                  ['P6', 8],  ['P7', 6],  ['P8', 4],  ['P9', 2],  ['P10', 1],
                ].map(([pos, pts]) => (
                  <div key={pos} className="flex items-center justify-between border-b border-white/5 py-2">
                    <span className="text-[#e10600] font-black italic text-lg tracking-tighter">{pos}</span>
                    <span className="text-white font-bold tabular-nums">+{pts} pts</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Mecânicas Automáticas */}
          <section className="bg-[#1f1f27] rounded-3xl border border-white/5 overflow-hidden">
            <div className="h-1 w-full bg-[#e10600]" />
            <div className="p-6 md:p-8 space-y-5">
              <div>
                <h2 className="text-xl font-black italic uppercase tracking-tight text-white">
                  Mecânicas Automáticas
                </h2>
                <p className="text-[#e10600] text-xs font-bold uppercase tracking-widest mt-0.5">
                  Bônus de Performance
                </p>
                <p className="text-gray-400 text-sm mt-2 italic">
                  O servidor calcula sozinho. Os pontos são cumulativos por piloto acertado.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <span className="shrink-0 text-[10px] font-black bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-1 rounded uppercase tracking-wider mt-0.5">
                    Hail Mary
                  </span>
                  <div>
                    <p className="text-white font-bold">+25 pts — O Milagre</p>
                    <p className="text-gray-400 text-sm mt-0.5">
                      Largou em P22 ou dos Boxes e terminou no Top 5.
                    </p>
                    <p className="text-gray-600 text-xs mt-1 uppercase tracking-wider font-bold">Máximo: 1 piloto / 25 pts</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <span className="shrink-0 text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded uppercase tracking-wider mt-0.5">
                    Underdog
                  </span>
                  <div>
                    <p className="text-white font-bold">+10 pts por piloto</p>
                    <p className="text-gray-400 text-sm mt-0.5">
                      Terminou no Top 3 tendo escalado pelo menos 10 posições.
                    </p>
                    <p className="text-gray-600 text-xs mt-1 uppercase tracking-wider font-bold">Máximo: 3 pilotos / 30 pts</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <span className="shrink-0 text-[10px] font-black bg-sky-500/20 text-sky-400 border border-sky-500/30 px-2 py-1 rounded uppercase tracking-wider mt-0.5">
                    Freefall
                  </span>
                  <div>
                    <p className="text-white font-bold">+5 pts por piloto</p>
                    <p className="text-gray-400 text-sm mt-0.5">
                      Despencou na corrida, terminando 5 ou mais posições abaixo de onde largou.
                    </p>
                    <p className="text-gray-600 text-xs mt-1 uppercase tracking-wider font-bold">Máximo: 10 pilotos / 50 pts</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Mecânicas Selecionáveis */}
          <section className="bg-[#1f1f27] rounded-3xl border border-white/5 overflow-hidden">
            <div className="h-1 w-full bg-[#e10600]" />
            <div className="p-6 md:p-8 space-y-5">
              <div>
                <h2 className="text-xl font-black italic uppercase tracking-tight text-white">
                  Mecânicas Selecionáveis
                </h2>
                <p className="text-[#e10600] text-xs font-bold uppercase tracking-widest mt-0.5">
                  Escolha do Jogador
                </p>
                <p className="text-gray-400 text-sm mt-2 italic">
                  Cada acerto em uma destas variáveis vale <span className="text-white font-bold not-italic">+10 pontos</span>.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { n: '1', label: 'Volta Rápida', desc: 'Acertar qual piloto faz a volta mais rápida da prova.' },
                  { n: '2', label: 'Total de DNFs', desc: 'Acertar o número exato de carros que abandonam a corrida.' },
                  { n: '3', label: 'SC + VSC', desc: 'Acertar o total combinado de Safety Cars e Virtual Safety Cars.' },
                ].map(({ n, label, desc }) => (
                  <div key={n} className="flex gap-4 items-start">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-[#e10600]/20 border border-[#e10600]/30 text-[#e10600] text-xs font-black flex items-center justify-center mt-0.5">
                      {n}
                    </span>
                    <div>
                      <p className="text-white font-bold">{label}</p>
                      <p className="text-gray-400 text-sm mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* All-In */}
          <section className="bg-[#1f1f27] rounded-3xl border border-white/5 overflow-hidden">
            <div className="h-1 w-full bg-[#e10600]" />
            <div className="p-6 md:p-8 space-y-5">
              <div>
                <h2 className="text-xl font-black italic uppercase tracking-tight text-white">
                  Modo All-In
                </h2>
                <p className="text-[#e10600] text-xs font-bold uppercase tracking-widest mt-0.5">
                  Opcional · Risco Máximo
                </p>
                <p className="text-gray-400 text-sm mt-2 italic">
                  Você escolhe <span className="text-white font-bold not-italic">UM piloto</span> entre os 12 que sobraram (fora do seu Top 10 apostado).
                </p>
              </div>

              <div className="space-y-3">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <p className="text-emerald-400 font-bold text-sm">Se terminar no Top 10</p>
                  <p className="text-gray-300 text-sm mt-1">
                    Você ganha a pontuação oficial da F1.
                  </p>
                  <p className="text-gray-500 text-xs mt-1">Ex: P1 = +25 pts, P10 = +1 pt</p>
                </div>

                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                  <p className="text-red-400 font-bold text-sm">Se terminar abaixo (P11 a P22)</p>
                  <p className="text-gray-300 text-sm mt-1">
                    Você perde pontos na escala direta: <span className="font-bold text-white">(10 − Posição)</span>.
                  </p>
                  <p className="text-gray-500 text-xs mt-1">P11 = −1 | P15 = −5 | P22 = −12</p>
                </div>

                <div className="bg-red-900/20 border border-red-900/40 rounded-xl p-4">
                  <p className="text-red-500 font-bold text-sm">DNF (Abandono)</p>
                  <p className="text-gray-300 text-sm mt-1">
                    Perda máxima da escala (−12) + penalidade de −5.
                  </p>
                  <p className="text-gray-500 text-xs mt-1">Total: −17 pontos</p>
                </div>
              </div>
            </div>
          </section>

          {/* Double Points */}
          <section className="bg-[#1f1f27] rounded-3xl border border-white/5 overflow-hidden">
            <div className="h-1 w-full bg-[#e10600]" />
            <div className="p-6 md:p-8 space-y-4">
              <div>
                <h2 className="text-xl font-black italic uppercase tracking-tight text-white">
                  Tokens de Double Points
                </h2>
              </div>

              <div className="space-y-3">
                <div className="flex gap-3 items-start">
                  <span className="shrink-0 w-2 h-2 rounded-full bg-[#e10600] mt-2" />
                  <p className="text-gray-300 text-sm">
                    Cada jogador tem <span className="text-white font-bold">3 tokens</span> para usar na temporada.
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="shrink-0 w-2 h-2 rounded-full bg-[#e10600] mt-2" />
                  <p className="text-gray-300 text-sm">
                    O token <span className="text-white font-bold">dobra o valor total</span> obtido na rodada, incluindo todos os bônus e o All-In.
                  </p>
                </div>
              </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
