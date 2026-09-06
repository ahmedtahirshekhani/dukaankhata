export const DEFAULT_REMINDER_TEMPLATE = 
`Assalam-o-Alaikum {customer_name},

Aap ki taraf *{shop_name}* ka baqaya Udhaar balance *Rs. {balance}* hai.

Aap is link par click karke Online / EasyPaisa / JazzCash se pay kar sakte hain:
{payment_link}

Shukriya!
*{shop_name}*`;

export function compileReminderMessage(
  template: string | null | undefined,
  params: {
    customerName: string;
    shopName: string;
    dueBalance: number;
    paymentUrl: string;
  }
): string {
  const baseTemplate = template && template.trim() !== "" ? template : DEFAULT_REMINDER_TEMPLATE;
  const { customerName, shopName, dueBalance, paymentUrl } = params;

  return baseTemplate
    .replaceAll("{customer_name}", customerName)
    .replaceAll("{shop_name}", shopName)
    .replaceAll("{balance}", dueBalance.toLocaleString())
    .replaceAll("{payment_link}", paymentUrl);
}
