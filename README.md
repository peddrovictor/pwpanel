# ⚔️ ROMA — Painel do Clã (Perfect World)

Painel de controle para o clã ROMA do Perfect World, com gerenciamento de membros, presenças em eventos, controle semanal de TW e contas emprestadas.

---

## 🚀 Como colocar online (passo a passo)

### 1. Criar o banco de dados no Firebase (grátis)

1. Acesse [console.firebase.google.com](https://console.firebase.google.com/)
2. Clique em **"Adicionar projeto"** → dê o nome **roma-panel** → criar
3. No painel do projeto, clique em **"Realtime Database"** no menu lateral
4. Clique em **"Criar banco de dados"**
5. Escolha a região **United States (us-central1)**
6. Selecione **"Iniciar no modo de teste"** (pode alterar depois)
7. Clique em **Criar**

### 2. Pegar as credenciais do Firebase

1. No painel do projeto, clique na engrenagem ⚙️ → **"Configurações do projeto"**
2. Em **"Seus apps"**, clique no ícone **Web** `</>`
3. Dê um nome (ex: **roma-panel**) → **Registrar app**
4. Copie os valores do `firebaseConfig` que aparecer
5. Abra o arquivo `src/firebase.js` e substitua os valores:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",              // ← cole o seu
  authDomain: "roma-panel.firebaseapp.com",
  databaseURL: "https://roma-panel-default-rtdb.firebaseio.com",
  projectId: "roma-panel",
  storageBucket: "roma-panel.appspot.com",
  messagingSenderId: "123...",
  appId: "1:123...:web:abc..."
};
```

### 3. (Opcional) Proteger o banco de dados

Após testar, vá em **Realtime Database → Regras** e use:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

> Para produção, você pode restringir por domínio nas configurações do Firebase.

### 4. Publicar na Vercel

**Opção A — Pelo GitHub (recomendado):**

1. Crie um repositório no GitHub e suba os arquivos do projeto
2. Acesse [vercel.com](https://vercel.com) e faça login com GitHub
3. Clique em **"New Project"** → selecione o repositório
4. Framework: **Vite** (detecta automaticamente)
5. Clique em **Deploy**
6. Pronto! Vai gerar um link tipo `roma-panel.vercel.app`

**Opção B — Pela linha de comando:**

```bash
# Instalar a CLI da Vercel
npm install -g vercel

# Na pasta do projeto
npm install
npm run build
vercel --prod
```

---

## 📁 Estrutura do projeto

```
roma-panel/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx          # Entry point
│   ├── App.jsx           # Todos os componentes
│   ├── firebase.js       # ⚠️  EDITAR COM SUAS CREDENCIAIS
│   ├── constants.js      # Classes, cultivos, mapeamentos
│   ├── Icons.jsx         # Ícones SVG
│   └── styles.css        # Tema romano
```

---

## 🛡️ Funcionalidades

- **Membros** — cadastro com Nome, Classe (WR/MG/WB/WF/EA/EP/MC/PSY), Nível, Cultivo, WhatsApp
- **Importação em Massa** — colar lista de membros com conversão automática de classes PT-BR
- **Exportar Excel** — baixa planilha .xlsx com todos os membros
- **Gráfico de Balanceamento** — visualização da distribuição de classes
- **Presenças** — controle de presença em TW, World Boss e Marcial
- **Controle TW** — confirmação semanal de quem vai/não vai na TW
- **Contas Emprestadas** — registro com login e senha (mascarada)
- **Login da Staff** — sistema de autenticação com Admin e Staff
- **Tempo real** — dados sincronizados entre todos os staffs via Firebase

---

## 💡 Dicas

- O primeiro login cria a conta **Admin** — só ela pode criar staffs
- Todos os dados são compartilhados em tempo real entre os staffs
- Mande o link da Vercel pros staffs, cada um loga com sua conta
- Para resetar tudo, apague os dados no Firebase Console → Realtime Database
