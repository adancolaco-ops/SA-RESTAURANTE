const { z } = require('zod');

const password = z.string().min(6, 'A senha deve ter ao menos 6 caracteres').max(72);
const email = z.string().trim().toLowerCase().email('E-mail inválido');
const role = z.enum(['admin', 'employee', 'client']);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato AAAA-MM-DD');
const people = z.coerce.number().int().min(1, 'Mínimo 1 pessoa').max(8, 'Máximo 8 pessoas');
const id = z.coerce.number().int().positive();

const registerSchema = z.object({ name: z.string().trim().min(2, 'Nome muito curto').max(80), email, password });
const loginSchema = z.object({ email, password: z.string().min(1, 'Informe a senha') });
const userCreateSchema = registerSchema.extend({ role });
const userUpdateSchema = z.object({ name: z.string().trim().min(2).max(80).optional(), role: role.optional(), active: z.boolean().optional() });

const menuSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).default(''),
  price: z.coerce.number().positive('Preço deve ser positivo').max(10000),
  category: z.string().trim().min(2).max(40),
  available: z.boolean().default(true),
});
const menuUpdateSchema = menuSchema.partial();

const availabilityQuery = z.object({ date: dateStr, people: people.default(2) });
const reservationSchema = z.object({ date: dateStr, time: z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido'), people });
const reservationStatusSchema = z.object({ status: z.enum(['confirmed', 'completed', 'cancelled']) });
const reservationListQuery = z.object({ date: dateStr.optional() });

const orderSchema = z.object({
  items: z.array(z.object({ menuItemId: id, quantity: z.coerce.number().int().min(1).max(20) })).min(1, 'Informe ao menos um item'),
  reservationId: id.optional(),
  clientId: id.optional(), // usado apenas por funcionários (pedido de balcão)
});
const orderStatusSchema = z.object({ status: z.enum(['preparing', 'ready', 'delivered', 'cancelled']) });
const orderListQuery = z.object({ status: z.enum(['pending', 'preparing', 'ready', 'delivered', 'cancelled']).optional() });

const expenseSchema = z.object({ description: z.string().trim().min(3).max(120), amount: z.coerce.number().positive().max(1000000) });
const idParam = z.object({ id });

module.exports = {
  registerSchema, loginSchema, userCreateSchema, userUpdateSchema, menuSchema, menuUpdateSchema,
  availabilityQuery, reservationSchema, reservationStatusSchema, reservationListQuery,
  orderSchema, orderStatusSchema, orderListQuery, expenseSchema, idParam,
};
