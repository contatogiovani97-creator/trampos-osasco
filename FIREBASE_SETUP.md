# Configuração do Firebase

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/) e registre um aplicativo Web.
2. Em **Authentication → Sign-in method**, habilite **E-mail/senha**.
3. Crie o banco em **Firestore Database**.
4. Copie a configuração do aplicativo Web para `firebase` em `src/environments/environment.ts` e `src/environments/environment.prod.ts`. Substitua todos os valores `PREENCHER_*`. A configuração Web do Firebase é usada pelo cliente; a proteção dos dados é feita pelas regras do Firestore.
5. Publique as regras e índices do projeto a partir desta pasta. O `.firebaserc` já seleciona `trampos-osasco` como projeto padrão:

   ```powershell
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules,firestore:indexes
   ```

Cadastro e login por e-mail/senha, perfis, oportunidades, candidaturas, conversas e mensagens usam o Firestore. As conversas ficam vinculadas à oportunidade e são acessíveis somente ao profissional candidato e à pessoa que publicou; as mensagens são atualizadas em tempo real. O autor pode remover um anúncio, que deixa de aparecer publicamente, mas permanece no histórico e mantém as conversas. A exclusão permanente de oportunidades é bloqueada pelas regras. Após adicionar essas regras ou índices, publique-os com o comando acima. As fotos são reduzidas no aparelho para até 512 × 512 pixels e 400 KiB antes de salvar no perfil; isso evita depender do Firebase Storage, que exige upgrade de plano neste projeto. Como os perfis são públicos, as fotos também são públicas. Os perfis não armazenam o e-mail da conta.

## Conteúdo da comunidade de Osasco

A página **Acontece em Osasco** permite consultar notícias, eventos e jogos de várzea. O workflow do GitHub Actions em `.github/workflows/sync-osasco-news.yml` consulta o RSS público do Google Notícias a cada seis horas e publica até 30 notícias de Osasco na coleção `osascoPosts`, mantendo o título, um resumo, a fonte e o link para a matéria original. Notícias que deixam de aparecer no feed são arquivadas. Os usuários do app podem apenas ler documentos com `status: "published"`; criação, edição e exclusão pelo cliente estão bloqueadas pelas regras.

Para ativar a atualização automática sem Cloud Functions:

1. Envie o código e o arquivo `.github/workflows/sync-osasco-news.yml` para o GitHub no repositório conectado ao app.
2. No Google Cloud Console do projeto Firebase `trampos-osasco`, crie uma conta de serviço exclusiva para a sincronização das notícias e conceda a ela o papel **Cloud Datastore User**. Gere uma chave JSON para essa conta.
3. No GitHub, abra **Settings → Secrets and variables → Actions → New repository secret** e cadastre a chave JSON completa com o nome `FIREBASE_SERVICE_ACCOUNT`. Não salve esse arquivo no repositório nem compartilhe seu conteúdo.
4. No repositório, abra **Actions → Sync Osasco news → Run workflow** para executar a primeira sincronização. Depois, o GitHub tentará executá-la a cada seis horas. O agendamento pode atrasar e depende de o repositório continuar ativo; verifique a aba **Actions** se uma execução falhar.

O workflow usa a conta de serviço somente no GitHub Actions e grava notícias no Firestore; não implanta Cloud Functions nem exige Blaze para o agendador. O Firestore continua sujeito aos limites gratuitos e às condições de cobrança do projeto. Eventos e jogos de várzea continuam sendo cadastrados diretamente na coleção `osascoPosts` pelo Firebase Console. Para removê-los do app, altere `status` para `rejected` ou outro valor diferente de `published`.

## Notificações de mensagens no Android

O app mostra a contagem de conversas não lidas e marca uma conversa como lida quando ela é aberta. Para receber uma notificação sonora também quando o app estiver em segundo plano ou fechado, é necessário configurar e publicar o envio push:

1. No Firebase Console, registre um aplicativo Android com o mesmo ID de pacote configurado em `capacitor.config.ts` e `android/app/build.gradle` (atualmente `io.ionic.starter`).
2. Baixe o `google-services.json` desse aplicativo e salve em `android/app/google-services.json`. Não crie esse arquivo manualmente nem o envie ao repositório.
3. Instale as dependências das Cloud Functions e publique as regras e a função:

   ```powershell
   npm install --prefix functions
   npx firebase-tools deploy --only firestore:rules,functions
   ```

   A implantação de Cloud Functions exige que o projeto Firebase esteja no plano Blaze e que o faturamento esteja habilitado. O runtime das funções está configurado para Node.js 22.
4. Sincronize e compile o app Android:

   ```powershell
   npx cap sync android
   ```

   Abra `android` no Android Studio, compile e instale no dispositivo. Ao entrar com uma conta, aceite a permissão de notificações do Android. O som padrão é configurado no canal “Mensagens”; o próprio Android permite controlar som e notificações desse canal nas configurações do aparelho.
