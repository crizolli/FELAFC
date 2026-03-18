# Supabase setup

## 1. Crie o projeto

1. Crie um projeto no Supabase.
2. Em `Project Settings > API`, copie:
   - `Project URL`
   - `anon public key`

## 2. Configure o site

Edite [`supabase-config.js`](/Users/caio/Desktop/Site/supabase-config.js):

```js
window.FelasSupabaseConfig = {
  url: "https://SEU-PROJETO.supabase.co",
  anonKey: "SUA_ANON_KEY"
};
```

## 3. Crie a tabela

No SQL Editor do Supabase, execute o conteúdo de [`supabase-schema.sql`](/Users/caio/Desktop/Site/supabase-schema.sql).

Se você já tinha executado esse arquivo antes, rode novamente para criar também a tabela `media_videos`.

## 4. Crie seu usuário admin

No dashboard do Supabase:

1. Vá em `Authentication > Users`
2. Clique em `Add user`
3. Crie um usuário com email e senha

Esse email e senha serão usados em [`admin.html`](/Users/caio/Desktop/Site/admin.html).

## 5. Publicação

Depois disso:

1. A home passa a ler notícias do banco
2. O admin faz login real com Supabase Auth
3. Todas as notícias passam a aparecer para todos os visitantes

## Observação

O site continua sendo estático, mas agora os dados vêm do Supabase. O painel admin só funciona depois que `supabase-config.js` estiver preenchido e a tabela existir.
