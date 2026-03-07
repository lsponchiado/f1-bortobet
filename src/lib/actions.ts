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

    const codeEntry = await prisma.inviteCode.findUnique({ where: { code: inviteCode } });
    if (!codeEntry || codeEntry.used) {
      return { error: "Código de convite inválido ou já utilizado.", fields };
    }

    const userExists = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (userExists) {
      const msg = userExists.email === email ? "E-mail já cadastrado." : "Este username já está em uso.";
      return { error: msg, fields };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { 
          name, 
          username, 
          email, 
          password: hashedPassword,
          category: codeEntry.category
        },
      });

      await tx.inviteCode.update({
        where: { id: codeEntry.id },
        data: { 
          used: true,
          userId: newUser.id 
        },
      });
    });

  } catch (e) {
    console.error("Erro no registro:", e);
    return { error: "Erro ao processar cadastro.", fields };
  }
  
  redirect("/login");
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

// --- APOSTA DA CORRIDA (TOP 10 + Dials + Coringa) ---

export async function saveRaceBet(data: {
  raceId: number;
  gridIds: number[];
  fastestLapId: number | null;
  favoriteId: number | null;
  predictedSC: number;
  predictedDNF: number;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  const userId = parseInt(session.user.id, 10);

  try {
    await prisma.$transaction(async (tx) => {
      let bet = await tx.betRace.findFirst({
        where: { userId, raceId: data.raceId }
      });

      if (bet) {
        await tx.betRace.update({
          where: { id: bet.id },
          data: { predictedSC: data.predictedSC, predictedDNF: data.predictedDNF }
        });
        await tx.betRaceGridItem.deleteMany({ where: { betId: bet.id } });
      } else {
        bet = await tx.betRace.create({
          data: { userId, raceId: data.raceId, predictedSC: data.predictedSC, predictedDNF: data.predictedDNF }
        });
      }

      const gridItems = data.gridIds.map((driverId, index) => ({
        betId: bet!.id,
        driverId: driverId,
        predictedPosition: index + 1,
        fastestLap: driverId === data.fastestLapId,
        favorite: driverId === data.favoriteId
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
  sprintId: number;
  gridIds: number[];
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  const userId = parseInt(session.user.id, 10);

  try {
    await prisma.$transaction(async (tx) => {
      let bet = await tx.betSprint.findFirst({
        where: { userId, sprintId: data.sprintId }
      });

      if (bet) {
        await tx.betSprintGridItem.deleteMany({ where: { betId: bet.id } });
      } else {
        bet = await tx.betSprint.create({
          data: { userId, sprintId: data.sprintId }
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