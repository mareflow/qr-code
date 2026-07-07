# Maré Flow — Sistema de Prontuário Digital com QR Code para Oficinas

## 📌 Sobre o Projeto

O **Maré Flow** é uma plataforma SaaS web (PWA) voltada para **relacionamento, fidelização e transparência** no mercado de oficinas automotivas (carros e motos). O principal diferencial é a geração de um **QR Code único por veículo (por placa)**: ao colar a etiqueta no veículo, o cliente pode escanear a qualquer momento para acessar o seu **Prontuário Digital**, com identidade visual White-Label da oficina, contendo todo o histórico de manutenções, fotos, PDFs e botões de contato direto.

---

## 🚀 Módulos e Funcionalidades

### 1. Landing Page Comercial (`index.html`)
Página de entrada do produto, voltada para atrair novas oficinas parceiras.
- Hero section com copy de venda e login do parceiro integrado
- Seção "Como Funciona" (3 passos: Cadastrar OS → Imprimir QR → Cliente Acessa)
- Seção de evidências: Prontuário Completo, Relatórios PDF e Fotos
- Seção "White-Label" destacando personalização da marca
- FAQ (Perguntas Frequentes) com accordion
- CTA final com link para página de cadastro
- Footer com redes sociais, termos e privacidade
- Cookie banner com persistência em `localStorage`
- Links para "Acesso Cliente" e "Buscar Oficinas Parceiras"

---

### 2. Painel Administrativo da Oficina (`painel.html` + `js/painel.js`)
Dashboard principal para os usuários parceiros (oficinas).

#### Aba — Configuração da Oficina
- **Identidade da Oficina**: nome, WhatsApp, Instagram, link de avaliação Google, CPF/CNPJ
- **Upload de Logo** (Preview em tempo real)
- **Localização no Mapa**: Rua, número, bairro, cidade, UF — para aparecer no Mapa de Parceiros
- **Aparência do QR Code para impressão térmica**: texto personalizado (máx. 20 chars) ou ícone em P&B
- **Preview do QR Code** via canvas antes de salvar
- **Personalização de Cores** (5 variáveis): Header, Botões, Fundo Painel, Texto Painel, Fundo App Cliente
- Salvar configurações no banco (Supabase)

#### Aba — Histórico de OS
- **Dashboard de relatório** com métricas: OS no Mês, Faturamento do Mês, Ticket Médio, Top Serviço
- **Filtros avançados**: Período (início e fim), Compartimento (MOTOR, ÓLEO, SUSPENSÃO, FREIOS, CÂMBIO, etc.), Campo de busca por placa ou cliente
- **Listagem paginada** de OS com edição e exclusão
- **Modal de QR Code** por placa: baixar imagem ou imprimir etiqueta diretamente
- Aviso de OS excluídas (não retornam à cota mensal)

#### Aba — Nova OS
- Seletor de tipo de veículo: **Carro 🚗 / Moto 🏍️**
- Campos: Placa*, Marca, Modelo, Motorização
- Dados do Cliente: Nome*, E-mail*, Telefone
- Vínculo automático placa ↔ e-mail: ao redigitar a placa, o sistema detecta e-mails já cadastrados e alerta caso haja conflito (revenda de veículo)
- Botão para **alterar e-mail cadastrado** da placa (em caso de troca de proprietário)
- Campos: Quilometragem, Data da OS
- **Serviços Realizados** (textarea)
- **Tags de Compartimentos** (checkboxes multi-seleção): MOTOR, ÓLEO MOTOR, SUSPENSÃO, FREIOS, CÂMBIO, CÂMBIO AUT., ÓLEO CÂMBIO AUT., ÓLEO CÂMBIO, PNEUS, INJEÇÃO, EMBREAGEM, ESCAPAMENTO, OUTRO (com campo livre)
- **Valor Total** da OS
- **Anexar PDF** da OS (aviso: não tem validade como NF)
- **Upload de múltiplas Fotos** do serviço
- **Agendar Lembrete / Notificação** (seção destacada em roxo):
  - Destino: Lembrete Interno (Oficina) / Sininho do Cliente / Ambos
  - Título, Data, KM, Observações, Valor Estimado
  - Preview visual do sininho como o cliente verá
- **Salvar como Finalizada** ou **Criar como Pendente** (aguardando documentos)
- Resultado: QR Code gerado, link público do veículo, botões para Baixar e Imprimir Etiqueta

#### Aba — Oportunidades
- Lista de clientes que rodaram acima de X km desde a última OS (filtro configurável)
- **Cards de clientes** para contato: placa, nome, KM percorrida, data da última OS
- Estatísticas: Total de clientes, Aguardando contato, Já contatados
- **Modal de mensagem customizável** para envio via WhatsApp com um clique
- Status de contato persistido por placa

#### Navbar / Geral do Painel
- **Sininho de Lembretes** (ícone com badge): modal de lembretes do dia para a oficina
- Link **"Minha Assinatura"** (💳)
- Botão de logout
- Cores do navbar e tabs dinâmicas conforme configuração da oficina
- Suporte a **Dark Mode** (tema escuro)

---

### 3. Área do Cliente — Prontuário Digital (`os.html` + `js/os.js`)
Página pública acessada via QR Code.

#### Autenticação
- **Acesso restrito via Magic Link (OTP)**: o cliente informa o e-mail, recebe um código de acesso único e tem seu prontuário desbloqueado — 100% em conformidade com a LGPD
- Botão "Sair" disponível após login

#### Header do Prontuário (White-Label)
- Logo e cores customizadas da oficina que realizou o último serviço
- Botão de notificações (sininho de lembretes do cliente)
- **Toggle de Tema** (Claro/Escuro)

#### Dados do Veículo
- Placa, Cliente, Marca, Modelo, Motorização
- **Quilometragem editável** pelo próprio cliente (com botão de edição inline)
- Data da última manutenção, Telefone/WhatsApp

#### Histórico de Serviços (Linha do Tempo)
- Timeline com todas as OS do veículo, incluindo serviços de **múltiplas oficinas parceiras** (ecossistema)
- **Filtros**: por Compartimento, por Oficina, por Data do Serviço
- Para cada OS: data, oficina, serviços realizados, valor, PDFs e galeria de fotos

#### Notificações e Engajamento
- **Sininho de lembretes**: avisos agendados pela oficina aparecem para o cliente (data, KM prevista)
- **Alerta automático** quando a última visita for superior a 6 meses
- **Seletor de veículo**: se o cliente possuir mais de um veículo cadastrado, pode alternar entre eles na mesma tela

#### Modo Público (Revenda)
- O proprietário pode gerar um **link de compartilhamento público temporário** (24h de validade), ideal para mostrar o histórico completo ao vender o veículo — sem expor dados pessoais

---

### 4. Mapa de Parceiros (`mapa.html` + `js/mapa.js`)
- Mapa interativo via **Leaflet.js** mostrando todas as oficinas parceiras cadastradas
- Marcadores customizados com logo de cada oficina
- Popup com nome, endereço e link de contato ao clicar
- Acessível pela Landing Page e pela área do cliente

---

### 5. Cadastro de Parceiro (`cadastro.html` + `js/cadastro.js`)
- Formulário de cadastro de nova oficina: nome, e-mail, senha
- Envio de dados para o Supabase Auth

---

### 6. Login do Cliente (`login-cliente.html` + `js/login-cliente.js`)
- Página dedicada para clientes acessarem o histórico informando a placa do veículo ou o e-mail cadastrado
- Envia Magic Link (OTP) para autenticação segura

---

### 7. Assinatura (`assinatura.html` + `js/assinatura.js`)
Gerenciamento de plano e pagamento para a oficina parceira.
- **Card de Status** da assinatura: Ativo (verde), Inadimplente/Aviso (amarelo), Bloqueado (vermelho)
- **Grid de Informações**: plano contratado, próximo vencimento, valor, próxima cobrança
- **Seção de Pagamento via PIX**: chave PIX, valor da mensalidade, botão Copiar
- **Histórico de Cobranças**: lista de pagamentos anteriores com status (Pago, Pendente, Cancelado)
- **Tela de Bloqueio** (overlay): caso inadimplente, bloqueia o acesso ao sistema com instruções de pagamento e chave PIX
- Integração com **Asaas** para cobranças automáticas (CPF/CNPJ exigido nas configurações)

---

### 8. Lembrete de Manutenção (`lembrete.html` + `js/lembrete.js`)
- Página pública enviada ao cliente como aviso de serviço pendente
- Exibe logo e nome da oficina, placa do veículo, título e observações do lembrete, e valor estimado
- Botão de ação para **agendar no WhatsApp** da oficina diretamente

---

### 9. Recuperação de Senha (`recuperar.html` + `js/recuperar.js`)
- Página dedicada para redefinição de senha via link enviado ao e-mail (integrado ao Supabase Auth)

---

### 10. Painel Administrativo Interno (`admin.html` + `js/admin.js`)
- Área restrita para a equipe Maré Flow gerenciar as oficinas parceiras
- Acesso restrito, não visível para parceiros

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5, CSS3, JavaScript (ES6+ com ES Modules) |
| Estilização | Tailwind CSS (via CDN) |
| Backend & Auth | [Supabase](https://supabase.com/) (Autenticação, Database, Storage) |
| Mapa | [Leaflet.js](https://leafletjs.com/) (v1.9.4) |
| QR Code | [QRCode.js](https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/) |
| Cobranças | [Asaas](https://www.asaas.com/) (API de pagamentos via PIX) |
| PWA | Service Worker + Web App Manifest |
| Tipografia | Inter (Google Fonts) |

---

## ⚙️ Como Executar Localmente

O projeto usa ES Modules (`<script type="module">`), portanto **precisa de um servidor local** (não abre via `file://`).

### Opção 1 — VS Code Live Server
Instale a extensão **Live Server** e clique em "Go Live".

### Opção 2 — Node.js
```bash
npx serve .
```

### Opção 3 — Python
```bash
python -m http.server
```

### Opção 4 — PHP
```bash
php -S localhost:8000
```

Acesse `http://localhost:3000` (ou a porta indicada) no navegador. A página inicial é o `index.html`.

---

## 📁 Estrutura de Arquivos

```
/
├── index.html              # Landing Page comercial + Login do Parceiro
├── painel.html             # Dashboard da Oficina (Config, Histórico, Nova OS, Oportunidades)
├── os.html                 # Prontuário Digital do Cliente (acesso via QR Code)
├── login-cliente.html      # Login do Cliente (por placa ou e-mail)
├── cadastro.html           # Cadastro de nova Oficina Parceira
├── assinatura.html         # Gestão de Plano e Pagamento da Oficina
├── lembrete.html           # Aviso de Manutenção Pendente (enviado ao cliente)
├── mapa.html               # Mapa interativo de Oficinas Parceiras
├── admin.html              # Painel Administrativo Interno (equipe Maré Flow)
├── recuperar.html          # Redefinição de Senha
├── termos.html             # Termos de Uso
├── privacidade.html        # Política de Privacidade
├── manifest.json           # PWA Manifest
├── sw.js                   # Service Worker (cache offline)
│
├── js/
│   ├── config.js           # Configuração de conexão com o Supabase
│   ├── login.js            # Autenticação do Parceiro (Oficina)
│   ├── login-cliente.js    # Autenticação do Cliente (Magic Link)
│   ├── painel.js           # Lógica principal do Dashboard (CRUD OS, QR, Config, Oportunidades)
│   ├── os.js               # Renderização do Prontuário Digital do Cliente
│   ├── assinatura.js       # Lógica da página de assinatura e pagamentos
│   ├── cadastro.js         # Lógica do cadastro de parceiro
│   ├── mapa.js             # Integração com Leaflet e carregamento dos parceiros
│   ├── lembrete.js         # Carregamento do aviso de manutenção
│   ├── admin.js            # Lógica do painel administrativo interno
│   ├── recuperar.js        # Lógica de redefinição de senha
│   └── theme.js            # Gerenciador de tema claro/escuro
│
└── assets/
    ├── logo.png            # Logo padrão Maré Flow
    └── logoqr.png          # Ícone para PWA e QR Code
```

---

## 🔐 Segurança e LGPD

- **Magic Link (OTP)**: O acesso ao prontuário exige validação de identidade via e-mail — nenhum dado é exposto sem autenticação.
- **Conformidade com LGPD**: Dados pessoais do cliente nunca são expostos publicamente. O modo de compartilhamento (revenda) oculta informações sensíveis.
- **Row Level Security (RLS)**: Cada oficina acessa apenas os seus próprios dados no Supabase.
- **Histórico Inviolável**: Registros de OS não podem ser editados retroativamente de forma silenciosa.

---

## 💳 Modelo de Assinatura

O acesso ao painel é via assinatura mensal com cobranças gerenciadas pelo **Asaas**. Ao se cadastrar, a oficina informa seu CPF ou CNPJ para habilitar as cobranças automáticas. O status da assinatura (Ativo, Aviso, Bloqueado) é exibido no painel e pode bloquear o acesso ao sistema em caso de inadimplência.

---

## 📞 Contato

- **WhatsApp**: [+55 48 99223-3575](https://wa.me/5548992233575)
- **Instagram**: [@mare.flow](https://www.instagram.com/mare.flow/)
- **Facebook**: [Maré Flow](https://www.facebook.com/profile.php?id=61576111221964)
- **E-mail**: ia.mareflow@gmail.com.br
- **© 2026 Maré Flow. Todos os direitos reservados.**
