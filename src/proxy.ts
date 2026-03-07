import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const proxyHandler = auth((req) => {
  const isLoggedIn = !!req.auth; // req.auth contém a sessão se o usuário estiver logado
  const { pathname } = req.nextUrl;

  // 1. Define o que é rota pública
  const isPublicRoute = pathname.startsWith("/login") || pathname.startsWith("/register");

  // 2. Regra para Rotas Públicas
  if (isPublicRoute) {
    if (isLoggedIn) {
      // Já tá logado e quer ir pro login? Chuta pra Home.
      return NextResponse.redirect(new URL("/", req.nextUrl));
    }
    // Não tá logado e quer ir pro login? Deixa passar.
    return NextResponse.next();
  }

  // 3. Regra para o resto do site (Área Restrita)
  if (!isLoggedIn) {
    // Não tem credencial? Chuta pra tela de Login imediatamente.
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // 4. Se chegou aqui, o usuário ESTÁ LOGADO e em uma rota PERMITIDA.
  // Agora sim aplicamos o seu cabeçalho de dispositivo.
  const userAgent = req.headers.get('user-agent') || '';
  const isMobile = /mobile/i.test(userAgent);

  const response = NextResponse.next();
  response.headers.set('x-device-type', isMobile ? 'mobile' : 'desktop');
  
  return response;
});

export { proxyHandler as proxy };

export const config = {
  // Ignora arquivos estáticos e de API para não gastar processamento
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};