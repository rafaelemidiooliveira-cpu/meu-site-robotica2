# Robótica na Escola

Site estático para GitHub Pages, com banco, autenticação e aprovação de projetos pelo Supabase.

## Publicar no GitHub Pages

1. Envie todos os arquivos e pastas deste projeto para o repositório.
2. No GitHub, abra **Settings → Pages** e escolha a branch principal e a pasta raiz (`/`).
3. Aguarde a publicação. O endereço será parecido com `https://SEU-USUARIO.github.io/SEU-REPOSITORIO/`.

## Conectar o Supabase

1. Crie um projeto no Supabase.
2. No SQL Editor do projeto, execute o conteúdo de `database/supabase.sql`.
3. Em **Project Settings → API**, copie o Project URL e a chave `anon`/publishable.
4. Preencha `supabaseUrl` e `supabaseAnonKey` em `js/config.js`.
5. Envie a alteração ao GitHub. A chave `anon` é pública por definição; a segurança dos dados é feita pelas políticas RLS do SQL. **Nunca coloque a chave `service_role` no site.**
6. Em **Authentication → Sign In / Providers → Email**, habilite cadastro por e-mail e confirmação de e-mail. Configure em **URL Configuration** o endereço do site no GitHub Pages.
7. Crie somente a conta administrativa em **Authentication → Users**, usando `rafael.emidio.oliveira@escola.pr.gov.br`. Escolha uma senha forte e exclusiva; senhas não devem ser colocadas neste repositório.
8. No SQL Editor, promova essa conta:

```sql
update public.profiles
set role = 'admin'
where lower(email) = 'rafael.emidio.oliveira@escola.pr.gov.br';
```

Depois, habilite o cadastro público para que os estudantes criem suas próprias contas na tela de acesso. O banco atribui perfil `student` apenas a endereços terminados em `@escola.pr.gov.br`; qualquer outro domínio recebe perfil `visitor`, que pode entrar e visualizar o site, mas não enviar ou editar projetos. A confirmação do e-mail é necessária antes do acesso.

Estudantes podem enviar projetos e propor edição dos próprios projetos publicados. As propostas ficam privadas até a aprovação do administrador; apenas os projetos aprovados aparecem na galeria pública. O perfil administrativo é atribuído pelo SQL Editor e não pode ser escolhido no formulário.

O GitHub Pages não fornece banco de dados nem autenticação no servidor. O Supabase é necessário para que login, conteúdo compartilhado e aprovação funcionem com segurança.
