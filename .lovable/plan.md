

# Pagina de Login com Supabase Auth

## O que sera feito

1. **Criar pagina `/login`** (`src/pages/LoginPage.tsx`)
   - Formulario com campos de email e senha
   - Botao de login
   - Feedback de erro inline (credenciais invalidas, etc.)
   - Usa `supabase.auth.signInWithPassword()`
   - Redireciona para `/` apos login bem-sucedido via `useNavigate()`
   - Design consistente com o tema do projeto (card centralizado, cores do sistema)

2. **Adicionar rota no App.tsx**
   - Nova rota `<Route path="/login" element={<LoginPage />} />`

## Detalhes tecnicos

- Componente usa `useState` para email, senha, loading e erro
- Chamada `supabase.auth.signInWithPassword({ email, password })`
- Se sucesso: `navigate("/", { replace: true })`
- Se erro: exibe mensagem de erro abaixo do formulario
- Sem protecao de rotas neste momento (apenas login, sem guard)
- Sem signup/reset por enquanto (apenas login)

## Arquivos modificados
- `src/pages/LoginPage.tsx` (novo)
- `src/App.tsx` (adicionar rota)

