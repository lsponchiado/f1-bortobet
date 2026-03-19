"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { signIn, auth } from "@/auth";
import { revalidatePath } from "next/cache";

// --- REGISTRO E LOGIN ---

export async function registerUser(prevState: any, formData: FormData) {
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

export async function loginUser(prevState: any, formData: FormData) {
  const identifier = formData.get("identifier")?.toString();
  const password = formData.get("password")?.toString();

  if (!identifier || !password) return { error: "Preencha todos os campos." };

  try {
    await signIn("credentials", { identifier, password, redirect: false });
  } catch (error) {
    return { error: "Credenciais inválidas. Verifique seu usuário/e-mail e senha." };
  }
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

// --- APOSTA DA CORRIDA (TOP 10 + Dials + Coringa) ---

export async function saveRaceBet(data: {
  sessionId: number;
  betId?: number;
  gridIds: number[];
  fastestLapId: number | null;
  allInDriverId: number | null;
  doublePoints: boolean;
  predictedSC: number;
  predictedDNF: number;
  targetUserId?: number;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  const isAdmin = (session.user as any).role === 'ADMIN';
  const userId = isAdmin && data.targetUserId ? data.targetUserId : parseInt(session.user.id, 10);

  try {
    await prisma.$transaction(async (tx) => {
      let bet = await tx.betRace.findFirst({
        where: { userId, sessionId: data.sessionId }
      });

      if (bet) {
        await tx.betRace.update({
          where: { id: bet.id },
          data: { predictedSC: data.predictedSC, predictedDNF: data.predictedDNF, driverId: data.allInDriverId, doublePoints: data.doublePoints }
        });
        await tx.betRaceGridItem.deleteMany({ where: { betId: bet.id } });
      } else {
        bet = await tx.betRace.create({
          data: { userId, sessionId: data.sessionId, predictedSC: data.predictedSC, predictedDNF: data.predictedDNF, driverId: data.allInDriverId, doublePoints: data.doublePoints }
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

// --- APOSTA DA SPRINT (TOP 8) ---

export async function saveSprintBet(data: {
  sessionId: number;
  gridIds: number[];
  targetUserId?: number;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  const isAdmin = (session.user as any).role === 'ADMIN';
  const userId = isAdmin && data.targetUserId ? data.targetUserId : parseInt(session.user.id, 10);

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
