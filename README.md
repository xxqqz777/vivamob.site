# 🚗 VivaMob — MVP de Plataforma para Motoristas

Plataforma web completa de transporte de passageiros, desenvolvida como **MVP (Minimum Viable Product)** para demonstração. Todo o funcionamento ocorre localmente no navegador, sem backend ou banco de dados externo.

---

## 📁 Estrutura de Arquivos

```
vivamob/
├── index.html    → Estrutura SPA (Single Page Application)
├── style.css     → Estilos completos, responsivos, com tema dark
├── db.js         → Camada de persistência (IndexedDB)
└── app.js        → Lógica principal da aplicação
```

---

## 🚀 Como Executar

1. Baixe todos os arquivos para uma pasta
2. Abra o `index.html` em qualquer navegador moderno (Chrome, Firefox, Edge, Safari)
3. **Não é necessário servidor web** — funciona diretamente do arquivo local

---

## ✨ Funcionalidades

### Tela Inicial (Landing)
- Logo animado com identidade visual VivaMob
- Botões de cadastro e login
- Design responsivo (mobile + desktop)

### Cadastro em 3 Etapas
1. **Dados pessoais**: Nome, CPF (com máscara e validação), Senha (com toggle visível/oculto)
2. **Veículo**: Marca, Modelo, Ano (validado), Placa (com máscara Mercosul)
3. **Confirmação**: Resumo dos dados com mascaramento parcial

### Login
- Autenticação com CPF e senha
- Senhas armazenadas com **hash SHA-256** via Web Crypto API
- Recuperação de senha (demonstrativa)

### Área do Motorista (Dashboard)
- **Sidebar** (desktop) / **Bottom Nav** (mobile)
- Cards dinâmicos: Carteira, Corridas, Ganhos, Próxima corrida
- Ações rápidas

### Mapa Demonstrativo
- Mapa visual em HTML/CSS com ruas, áreas e marcadores
- Marcador do motorista com pulsação
- Clique no mapa para simular embarque/destino
- Rota simulada com SVG
- Controles de zoom e centralização

### Corridas
- Lista de corridas com status (Pendente, Aceita, Concluída, Cancelada)
- Criar corrida de demonstração com dados aleatórios
- Aceitar/Recusar corridas

### Carteira
- Saldo, Ganhos, Corridas, Créditos
- Histórico de transações
- Ações de transferir/adicionar (demonstração)

### Vale Combustível
- Solicitação de vale com modal explicativo
- Registro local das solicitações

### Perfil
- Dados do motorista com mascaramento parcial
- Informações do veículo

### Configurações
- Toggle de notificações, modo escuro, som
- Exportar dados em JSON
- **Apagar todos os dados** (para testes)

---

## 🗄️ Banco de Dados Local (IndexedDB)

O projeto utiliza **IndexedDB** para persistência local com as seguintes stores:

| Store | Dados |
|-------|-------|
| `motoristas` | Cadastro, auth, saldo, veículo |
| `corridas` | Corridas aceitas/concluídas |
| `transacoes` | Histórico da carteira |
| `solicitacoes_vale` | Solicitações de vale combustível |
| `configuracoes` | Preferências e sessão ativa |

---

## 🔒 Segurança do MVP

- Senhas são **hasheadas com SHA-256** (Web Crypto API)
- Nenhum dado é enviado para servidores externos
- Não coleta dados bancários, cartão ou CVV
- Dados de passageiros são **100% simulados**
- Função `clearLocalData()` disponível nas configurações

> ⚠️ **Nota**: SHA-256 é apenas para demonstração. Em produção, use bcrypt/argon2 no servidor.

---

## 🎨 Identidade Visual

- Paleta: Verde esmeralda (`#10B981`) como cor primária
- Tipografia: Inter (Google Fonts)
- Cards com sombras suaves, bordas arredondadas
- Microanimações e transições
- Skeleton loading na inicialização
- Toast notifications
- Modais
- Estados vazios com ilustrações
- Tema escuro opcional

---

## 📱 Responsividade

- **Mobile**: Bottom navigation, layout vertical, touch-friendly
- **Desktop**: Sidebar fixa, grid de cards, layout horizontal
- Breakpoint: 768px

---

## 🛠️ Para Desenvolvedores

### Substituir o banco local por API real

1. **db.js**: Substitua os métodos `add`, `get`, `put`, `getAll` por chamadas `fetch()`
2. **Autenticação**: Troque `db.autenticar()` por `POST /api/login`
3. **Cadastro**: Troque `db.cadastrarMotorista()` por `POST /api/register`
4. **Sessão**: Use JWT token em vez de `localStorage`/`IndexedDB`

### Exemplo de migração:
```javascript
// Antes (local)
const motorista = await db.autenticar(cpf, senha);

// Depois (API)
const res = await fetch('/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ cpf, senha })
});
const motorista = await res.json();
```

---

## 📄 Licença

MVP de demonstração. Não utiliza em produção sem revisão de segurança.

---

**VivaMob** — Plataforma de operação para motoristas 🚗💨
