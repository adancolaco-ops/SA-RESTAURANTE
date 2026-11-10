# 🍔 TechFood

Sistema web do restaurante IOT: reservas de mesa (sexta, sábado e domingo), cardápio com compra antecipada, controle financeiro e comissão de 10% para o garçom do atendimento.

**Identidade visual:** vermelho `#D62828` + amarelo `#FFC21A`, logo em `public/shared/logo.svg`.

## Como rodar (localhost)

Requisitos: Node.js 20 ou superior.

```bash
npm install
npm start
```

- Site Cliente: http://localhost:3000
- Site Gestão (funcionários/admin): http://localhost:3000/gestao
- API: http://localhost:3000/api

O banco SQLite (`techfood.db`) é criado sozinho na primeira execução, já com mesas, cardápio e usuários de teste.

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | admin@techfood.com | admin123 |
| Funcionário (garçom) | garcom@techfood.com | garcom123 |
| Cliente | cliente@techfood.com | cliente123 |

Variáveis opcionais: `PORT`, `JWT_SECRET`, `JWT_EXPIRES` (padrão `2h`), `CORS_ORIGINS` (lista separada por vírgula), `DB_FILE`.

## Arquitetura em camadas

```
src/
  server.js          # Express, CORS, arquivos estáticos
  config.js
  routes/            # rotas + middlewares (auth, RBAC, validação)
  controllers/       # HTTP <-> serviços
  services/          # regras de negócio
  repositories/      # persistência (SQL)
  database/db.js     # schema SQLite + seed
  schemas/           # validações Zod
  middlewares/       # auth JWT, RBAC, validate, errorHandler
public/
  cliente/           # Site Cliente
  gestao/            # Site Gestão
  shared/            # CSS, logo e utilitários
```

## Requisitos atendidos

- **RBAC:** `admin`, `employee`, `client` (middleware `authorize`).
- **JWT** com expiração configurável, enviado em `Authorization: Bearer <token>`.
- **Bcrypt** (`bcryptjs`) para senhas. **Zod** para validar body, query e params.
- **CORS** restrito à lista em `CORS_ORIGINS`.
- **Erros padronizados:** `{ "error": { "status": 400, "message": "...", "details": [...] } }`.

## Regras de negócio

- Cadastro público cria sempre **cliente**; funcionários e admins são criados pelo administrador.
- Reservas só às sextas, sábados e domingos. O sistema escolhe a menor mesa livre que comporta o grupo, sem conflito de horário.
- **Compra antecipada:** o cliente vincula o pedido a uma reserva confirmada.
- **Comissão de 10%:** o garçom é o funcionário que assume o pedido (ao iniciar o preparo, ou ao registrar o pagamento). A comissão é gerada quando o pedido está **pago** e tem garçom, e vai para o garçom correto.
- **Financeiro:** cada pagamento gera uma entrada; o admin registra compras de alimentos (saídas). Lucro = vendas − compras − comissões.

## Documentação da API

Prefixo `/api`. 🔒 = exige token. Perfis entre colchetes.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/register` | Cadastra cliente `{name,email,password}` |
| POST | `/auth/login` | Login `{email,password}` → `{token,user}` |
| GET | `/auth/me` 🔒 | Usuário logado |
| GET | `/users` 🔒 [admin] | Lista usuários |
| POST | `/users` 🔒 [admin] | Cria usuário `{name,email,password,role}` |
| PATCH | `/users/:id` 🔒 [admin] | Altera `name`, `role`, `active` |
| GET | `/menu` | Itens disponíveis (público) |
| GET | `/menu/all` 🔒 [staff] | Todos os itens |
| POST | `/menu` 🔒 [admin] | Cria item `{name,description,price,category}` |
| PATCH | `/menu/:id` 🔒 [admin] | Edita item |
| DELETE | `/menu/:id` 🔒 [admin] | Remove item |
| GET | `/reservations/availability?date=AAAA-MM-DD&people=2` 🔒 | Horários e mesas livres |
| GET | `/reservations?date=` 🔒 | Cliente: as suas. Staff: todas |
| POST | `/reservations` 🔒 | Cria `{date,time,people}` |
| PATCH | `/reservations/:id/status` 🔒 | `confirmed`, `completed`, `cancelled` (cliente só cancela) |
| GET | `/orders?status=` 🔒 | Cliente: os seus. Staff: todos |
| GET | `/orders/:id` 🔒 | Detalhe do pedido |
| POST | `/orders` 🔒 | `{items:[{menuItemId,quantity}], reservationId?}` |
| PATCH | `/orders/:id/status` 🔒 | `preparing` → `ready` → `delivered` (ou `cancelled`) |
| POST | `/orders/:id/pay` 🔒 | Registra pagamento (simulado) |
| GET | `/finance/summary` 🔒 [admin] | Vendas, compras, comissões, lucro |
| POST | `/finance/expenses` 🔒 [admin] | Compra de alimentos `{description,amount}` |
| GET | `/finance/my-commissions` 🔒 [staff] | Comissões do garçom logado |

Exemplo:

```bash
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"cliente@techfood.com","password":"cliente123"}'

curl -X POST http://localhost:3000/api/orders -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" -d '{"items":[{"menuItemId":1,"quantity":2}]}'
```

## Git e GitHub

```bash
git init && git add . && git commit -m "feat: TechFood inicial"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/techfood.git
git push -u origin main
```
