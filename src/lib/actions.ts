"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { signIn, auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { GRID_SIZE } from "@/lib/constants";

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

// --- REGISTRO E LOGIN ---

export async function registerUser(prevState: unknown, formData: FormData) {
  const ip = await getClientIp();
  const rl = checkRateLimit(`register:${ip}`);
  if (!rl.allowed) {
    const mins = Math.ceil((rl.retryAfterMs ?? 0) / 60000);
    return { error: `Muitas tentativas. Tente novamente em ${mins} minuto(s).` };
  }

  const name = formData.get("name") as string;
  const username = formData.get("username") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  const inviteCode = (formData.get("inviteCode") as string).toUpperCase();

  const fields = { name, username, email };

  try {
    if (password !== confirmPassword) return { error: "As senhas não coincidem.", fields };

    const userExists = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (userExists) {
      const msg = userExists.email === email ? "E-mail já cadastrado." : "Este username já está em uso.";
      return { error: msg, fields };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Master access code: cria admin sem consumir invite do banco
    const masterCode = process.env.MASTER_ACCESS_CODE;
    if (masterCode && inviteCode === masterCode) {
      await prisma.user.create({
        data: { name, username, email, password: hashedPassword, role: 'ADMIN' },
      });
    } else {
      const codeEntry = await prisma.inviteCode.findUnique({ where: { code: inviteCode } });
      if (!codeEntry || codeEntry.used) {
        return { error: "Código de convite inválido ou já utilizado.", fields };
      }
      const ageMs = Date.now() - codeEntry.createdAt.getTime();
      if (ageMs > 7 * 24 * 60 * 60 * 1000) {
        return { error: "Código de convite expirado.", fields };
      }

      await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: { name, username, email, password: hashedPassword, category: codeEntry.category },
        });
        await tx.inviteCode.update({
          where: { id: codeEntry.id },
          data: { used: true, userId: newUser.id },
        });
      });
    }

  } catch (e) {
    console.error("Erro no registro:", e);
    return { error: "Erro ao processar cadastro.", fields };
  }

  await signIn("credentials", { identifier: email, password, redirect: false });
  redirect("/");
}

export async function loginUser(prevState: unknown, formData: FormData) {
  const identifier = formData.get("identifier")?.toString();
  const password = formData.get("password")?.toString();

  if (!identifier || !password) return { error: "Preencha todos os campos." };

  const ip = await getClientIp();
  const rl = checkRateLimit(`login:${ip}`);
  if (!rl.allowed) {
    const mins = Math.ceil((rl.retryAfterMs ?? 0) / 60000);
    return { error: `Muitas tentativas. Tente novamente em ${mins} minuto(s).` };
  }

  try {
    await signIn("credentials", { identifier, password, redirect: false });
  } catch (error) {
    return { error: "Credenciais inválidas. Verifique seu usuário/e-mail e senha." };
  }
  resetRateLimit(`login:${ip}`);
  redirect("/");
}

// --- PERFIL ---

async function getAuthUserId(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return parseInt(session.user.id, 10);
}

export async function updateName(name: string) {
  const userId = await getAuthUserId();
  if (!name.trim()) return { error: 'Nome não pode ser vazio.' };
  await prisma.user.update({ where: { id: userId }, data: { name: name.trim() } });
  revalidatePath('/perfil');
  return { success: true };
}

export async function updateEmail(email: string) {
  const userId = await getAuthUserId();
  if (!email.trim()) return { error: 'E-mail não pode ser vazio.' };
  const exists = await prisma.user.findFirst({ where: { email, NOT: { id: userId } } });
  if (exists) return { error: 'E-mail já está em uso.' };
  await prisma.user.update({ where: { id: userId }, data: { email: email.trim() } });
  revalidatePath('/perfil');
  return { success: true };
}

export async function updateUsername(username: string) {
  const userId = await getAuthUserId();
  if (!username.trim()) return { error: 'Username não pode ser vazio.' };
  const exists = await prisma.user.findFirst({ where: { username, NOT: { id: userId } } });
  if (exists) return { error: 'Username já está em uso.' };
  await prisma.user.update({ where: { id: userId }, data: { username: username.trim() } });
  revalidatePath('/perfil');
  return { success: true };
}

export async function updatePassword(currentPassword: string, newPassword: string, confirmPassword: string) {
  const userId = await getAuthUserId();
  if (newPassword !== confirmPassword) return { error: 'As senhas não coincidem.' };
  if (newPassword.length < 6) return { error: 'A nova senha deve ter pelo menos 6 caracteres.' };
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: 'Usuário não encontrado.' };
  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) return { error: 'Senha atual incorreta.' };
  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
  return { success: true };
}

// --- VALIDAÇÃO DE APOSTAS ---

async function validateBetSession(sessionId: number, expectedType: 'RACE' | 'SPRINT', isAdmin: boolean) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, type: true, date: true, cancelled: true },
  });

  if (!session) return { error: 'Sessão não encontrada.' };
  if (session.cancelled) return { error: 'Sessão cancelada.' };
  if (session.type !== expectedType) return { error: 'Tipo de sessão inválido.' };

  // Admin pode apostar a qualquer momento
  if (!isAdmin && new Date(session.date) <= new Date()) {
    return { error: 'Prazo para apostas encerrado.' };
  }

  return { session };
}

function validateGridIds(gridIds: number[], expectedSize: number): string | null {
  if (!Array.isArray(gridIds)) return 'Grid inválido.';
  if (gridIds.length !== expectedSize) return `Grid deve ter exatamente ${expectedSize} pilotos.`;
  if (gridIds.some(id => typeof id !== 'number' || id <= 0)) return 'IDs de pilotos inválidos.';
  if (new Set(gridIds).size !== gridIds.length) return 'Pilotos duplicados no grid.';
  return null;
}

async function validateDriversExist(gridIds: number[]): Promise<string | null> {
  const count = await prisma.driver.count({ where: { id: { in: gridIds }, enabled: true } });
  if (count !== gridIds.length) return 'Um ou mais pilotos não existem ou estão desativados.';
  return null;
}

// --- APOSTA DA CORRIDA (TOP 10 + Dials + Coringa) ---

export async function saveRaceBet(data: {
  sessionId: number;
  betId?: number;
  gridIds: number[];
  fastestLapId: number | null;
  doublePoints: boolean;
  predictedSC: number;
  predictedDNF: number;
  targetUserId?: number;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  const isAdmin = session.user.role === 'ADMIN';
  const userId = isAdmin && data.targetUserId ? data.targetUserId : parseInt(session.user.id, 10);

  // Validar sessão
  const sessionCheck = await validateBetSession(data.sessionId, 'RACE', isAdmin);
  if ('error' in sessionCheck) return { error: sessionCheck.error };

  // Validar grid
  const gridError = validateGridIds(data.gridIds, GRID_SIZE.RACE);
  if (gridError) return { error: gridError };

  const driversError = await validateDriversExist(data.gridIds);
  if (driversError) return { error: driversError };

  // Validar fastest lap
  if (!data.fastestLapId || !data.gridIds.includes(data.fastestLapId)) {
    return { error: 'Volta mais rápida deve ser um piloto do grid.' };
  }

  // Validar SC/DNF
  if (data.predictedSC < 0 || data.predictedDNF < 0) {
    return { error: 'Valores de SC/DNF não podem ser negativos.' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      let bet = await tx.betRace.findFirst({
        where: { userId, sessionId: data.sessionId }
      });

      if (bet) {
        await tx.betRace.update({
          where: { id: bet.id },
          data: { predictedSC: data.predictedSC, predictedDNF: data.predictedDNF, driverId: null, doublePoints: data.doublePoints }
        });
        await tx.betRaceGridItem.deleteMany({ where: { betId: bet.id } });
      } else {
        bet = await tx.betRace.create({
          data: { userId, sessionId: data.sessionId, predictedSC: data.predictedSC, predictedDNF: data.predictedDNF, driverId: null, doublePoints: data.doublePoints }
        });
      }

      const gridItems = data.gridIds.map((driverId, index) => ({
        betId: bet!.id,
        driverId: driverId,
        predictedPosition: index + 1,
        fastestLap: driverId === data.fastestLapId,
      }));

      await tx.betRaceGridItem.createMany({ data: gridItems });
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Erro ao salvar aposta da corrida." };
  }
}

// --- DELETAR APOSTA DA CORRIDA ---

export async function deleteRaceBet(data: { sessionId: number; targetUserId?: number }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  const isAdmin = session.user.role === 'ADMIN';
  const userId = isAdmin && data.targetUserId ? data.targetUserId : parseInt(session.user.id, 10);

  const sessionCheck = await validateBetSession(data.sessionId, 'RACE', isAdmin);
  if ('error' in sessionCheck) return { error: sessionCheck.error };

  try {
    const bet = await prisma.betRace.findFirst({ where: { userId, sessionId: data.sessionId } });
    if (!bet) return { error: "Nenhuma aposta encontrada." };

    await prisma.$transaction(async (tx) => {
      await tx.betRaceGridItem.deleteMany({ where: { betId: bet.id } });
      await tx.betRace.delete({ where: { id: bet.id } });
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Erro ao deletar aposta da corrida." };
  }
}

// --- DELETAR APOSTA DA SPRINT ---

export async function deleteSprintBet(data: { sessionId: number; targetUserId?: number }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  const isAdmin = session.user.role === 'ADMIN';
  const userId = isAdmin && data.targetUserId ? data.targetUserId : parseInt(session.user.id, 10);

  const sessionCheck = await validateBetSession(data.sessionId, 'SPRINT', isAdmin);
  if ('error' in sessionCheck) return { error: sessionCheck.error };

  try {
    const bet = await prisma.betSprint.findFirst({ where: { userId, sessionId: data.sessionId } });
    if (!bet) return { error: "Nenhuma aposta encontrada." };

    await prisma.$transaction(async (tx) => {
      await tx.betSprintGridItem.deleteMany({ where: { betId: bet.id } });
      await tx.betSprint.delete({ where: { id: bet.id } });
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Erro ao deletar aposta da sprint." };
  }
}

// --- APOSTA DA SPRINT (TOP 8) ---

export async function saveSprintBet(data: {
  sessionId: number;
  gridIds: number[];
  targetUserId?: number;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  const isAdmin = session.user.role === 'ADMIN';
  const userId = isAdmin && data.targetUserId ? data.targetUserId : parseInt(session.user.id, 10);

  // Validar sessão
  const sessionCheck = await validateBetSession(data.sessionId, 'SPRINT', isAdmin);
  if ('error' in sessionCheck) return { error: sessionCheck.error };

  // Validar grid
  const gridError = validateGridIds(data.gridIds, GRID_SIZE.SPRINT);
  if (gridError) return { error: gridError };

  const driversError = await validateDriversExist(data.gridIds);
  if (driversError) return { error: driversError };

  try {
    await prisma.$transaction(async (tx) => {
      let bet = await tx.betSprint.findFirst({
        where: { userId, sessionId: data.sessionId }
      });

      if (bet) {
        await tx.betSprintGridItem.deleteMany({ where: { betId: bet.id } });
      } else {
        bet = await tx.betSprint.create({
          data: { userId, sessionId: data.sessionId }
        });
      }

      const gridItems = data.gridIds.map((driverId, index) => ({
        betId: bet!.id,
        driverId: driverId,
        predictedPosition: index + 1
      }));

      await tx.betSprintGridItem.createMany({ data: gridItems });
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Erro ao salvar aposta da sprint." };
  }
}

// --- BACKUP BETS ---

export async function saveBackupRaceBet(data: {
  gridIds: number[];
  fastestLapId: number | null;
  predictedSC: number;
  predictedDNF: number;
}) {
  const userId = await getAuthUserId();

  try {
    await prisma.backupRaceBet.upsert({
      where: { userId },
      update: {
        gridIds: data.gridIds,
        fastestLapId: data.fastestLapId,
        predictedSC: data.predictedSC,
        predictedDNF: data.predictedDNF,
      },
      create: {
        userId,
        gridIds: data.gridIds,
        fastestLapId: data.fastestLapId,
        predictedSC: data.predictedSC,
        predictedDNF: data.predictedDNF,
      },
    });

    revalidatePath("/perfil");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Erro ao salvar backup da corrida." };
  }
}

export async function saveBackupSprintBet(data: { gridIds: number[] }) {
  const userId = await getAuthUserId();

  try {
    await prisma.backupSprintBet.upsert({
      where: { userId },
      update: { gridIds: data.gridIds },
      create: { userId, gridIds: data.gridIds },
    });

    revalidatePath("/perfil");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Erro ao salvar backup da sprint." };
  }
}

export async function deleteBackupBet(type: 'race' | 'sprint') {
  const userId = await getAuthUserId();

  try {
    if (type === 'race') {
      await prisma.backupRaceBet.deleteMany({ where: { userId } });
    } else {
      await prisma.backupSprintBet.deleteMany({ where: { userId } });
    }

    revalidatePath("/perfil");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Erro ao deletar backup." };
  }
}
