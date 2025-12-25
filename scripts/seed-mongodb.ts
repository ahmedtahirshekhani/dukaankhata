import 'dotenv/config';
import { getCollection, COLLECTIONS, createIndexes } from '../src/lib/mongodb';
import bcrypt from 'bcryptjs';

async function seed() {
  try {
    console.log('Starting MongoDB seeding...');

    // Create indexes first
    await createIndexes();

    // Clear existing data
    console.log('Clearing existing data...');
    const transactionsCollection = await getCollection(COLLECTIONS.TRANSACTIONS);
    const orderItemsCollection = await getCollection(COLLECTIONS.ORDER_ITEMS);
    const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
    const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
    const paymentMethodsCollection = await getCollection(COLLECTIONS.PAYMENT_METHODS);
    const usersCollection = await getCollection(COLLECTIONS.USERS);

    await transactionsCollection.deleteMany({});
    await orderItemsCollection.deleteMany({});
    await ordersCollection.deleteMany({});
    await customersCollection.deleteMany({});
    await productsCollection.deleteMany({});
    await paymentMethodsCollection.deleteMany({});
    await usersCollection.deleteMany({});

    // Insert payment methods
    console.log('Inserting payment methods...');
    const paymentMethods = [
      { name: 'Credit Card' },
      { name: 'Debit Card' },
      { name: 'Cash' },
      { name: 'JazzCash' },
      { name: 'EasyPaisa' },
      { name: 'Bank Transfer' },
    ];
    const paymentMethodsResult = await paymentMethodsCollection.insertMany(paymentMethods);
    const paymentMethodIds = Object.values(paymentMethodsResult.insertedIds);

    // Insert test user
    console.log('Inserting test user...');
    const passwordHash = await bcrypt.hash('12345678', 10);
    const userResult = await usersCollection.insertOne({
      email: 'test@example.com',
      password_hash: passwordHash,
      name: 'Test User',
      company_name: 'Test Company',
      created_at: new Date(),
      updated_at: new Date(),
    });
    const userId = userResult.insertedId;

    // Insert products
    console.log('Inserting products...');
    const products = [
      { name: 'Biryani Masala', description: 'Authentic Pakistani biryani spice mix', price: 450.00, in_stock: 150, user_id: userId, category: 'spices' },
      { name: 'Chai Tea', description: 'Premium black tea for Pakistani chai', price: 320.00, in_stock: 200, user_id: userId, category: 'beverages' },
      { name: 'Naan Bread', description: 'Fresh homemade naan bread', price: 80.00, in_stock: 100, user_id: userId, category: 'bakery' },
      { name: 'Samosa (dozen)', description: 'Crispy potato samosas - 12 pieces', price: 250.00, in_stock: 50, user_id: userId, category: 'snacks' },
      { name: 'Desi Ghee (500ml)', description: 'Pure clarified butter', price: 1200.00, in_stock: 75, user_id: userId, category: 'dairy' },
      { name: 'Lassi (1L)', description: 'Traditional yogurt drink', price: 150.00, in_stock: 120, user_id: userId, category: 'beverages' },
      { name: 'Kebab Masala', description: 'Seasoning for kebabs and grilled items', price: 380.00, in_stock: 100, user_id: userId, category: 'spices' },
      { name: 'Roti Maker', description: 'Automatic chapati/roti maker', price: 2500.00, in_stock: 25, user_id: userId, category: 'appliances' },
      { name: 'Pakistani Rice (5kg)', description: 'Basmati rice premium quality', price: 1800.00, in_stock: 60, user_id: userId, category: 'groceries' },
      { name: 'Mango Lassi Mix', description: 'Ready mix for mango lassi', price: 280.00, in_stock: 80, user_id: userId, category: 'beverages' },
      { name: 'Nihari Masala', description: 'Spice mix for traditional nihari', price: 420.00, in_stock: 110, user_id: userId, category: 'spices' },
      { name: 'Kulfi Mold', description: 'Traditional kulfi freezing mold set', price: 850.00, in_stock: 40, user_id: userId, category: 'kitchen' },
      { name: 'Chapati Flour (2kg)', description: 'Fine whole wheat flour', price: 280.00, in_stock: 150, user_id: userId, category: 'groceries' },
      { name: 'Honey (500g)', description: 'Pure Pakistani honey', price: 650.00, in_stock: 90, user_id: userId, category: 'organic' },
      { name: 'Tea Strainer', description: 'Stainless steel chai strainer', price: 120.00, in_stock: 200, user_id: userId, category: 'kitchen' },
      { name: 'Dates (500g)', description: 'Premium Ajwa dates from Madinah', price: 1500.00, in_stock: 30, user_id: userId, category: 'organic' },
      { name: 'Frying Oil (5L)', description: 'High quality cooking oil', price: 980.00, in_stock: 40, user_id: userId, category: 'groceries' },
      { name: 'Turmeric Powder', description: 'Pure turmeric powder 500g', price: 350.00, in_stock: 120, user_id: userId, category: 'spices' },
      { name: 'Karahi Chicken Kit', description: 'Pre-measured spice kit for karahi', price: 280.00, in_stock: 70, user_id: userId, category: 'spices' },
      { name: 'Biryani Rice (1kg)', description: 'Long grain basmati rice', price: 480.00, in_stock: 100, user_id: userId, category: 'groceries' },
    ];
    const productsResult = await productsCollection.insertMany(products);
    const productIds = Object.values(productsResult.insertedIds);

    // Insert customers
    console.log('Inserting customers...');
    const customers = [
      { name: 'Ahmed Khan', email: 'ahmed.khan@email.com', phone: '+92-300-1234567', user_id: userId, status: 'active', created_at: new Date() },
      { name: 'Fatima Ahmed', email: 'fatima.ahmed@email.com', phone: '+92-333-2345678', user_id: userId, status: 'active', created_at: new Date() },
      { name: 'Muhammad Hassan', email: 'm.hassan@email.com', phone: '+92-321-3456789', user_id: userId, status: 'active', created_at: new Date() },
      { name: 'Aisha Malik', email: 'aisha.malik@email.com', phone: '+92-345-4567890', user_id: userId, status: 'active', created_at: new Date() },
      { name: 'Imran Ali', email: 'imran.ali@email.com', phone: '+92-300-5678901', user_id: userId, status: 'active', created_at: new Date() },
      { name: 'Rabia Khan', email: 'rabia.khan@email.com', phone: '+92-333-6789012', user_id: userId, status: 'inactive', created_at: new Date() },
      { name: 'Hassan Raza', email: 'hassan.raza@email.com', phone: '+92-321-7890123', user_id: userId, status: 'active', created_at: new Date() },
      { name: 'Zainab Hussain', email: 'zainab.h@email.com', phone: '+92-345-8901234', user_id: userId, status: 'active', created_at: new Date() },
      { name: 'Ali Nawaz', email: 'ali.nawaz@email.com', phone: '+92-300-9012345', user_id: userId, status: 'active', created_at: new Date() },
      { name: 'Hina Mirza', email: 'hina.mirza@email.com', phone: '+92-333-0123456', user_id: userId, status: 'active', created_at: new Date() },
    ];
    const customersResult = await customersCollection.insertMany(customers);
    const customerIds = Object.values(customersResult.insertedIds);

    // Insert orders
    console.log('Inserting orders...');
    const now = new Date();
    const orders = [
      { customer_id: customerIds[0], total_amount: 3450.00, user_id: userId, status: 'completed', created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) },
      { customer_id: customerIds[1], total_amount: 2890.50, user_id: userId, status: 'completed', created_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000) },
      { customer_id: customerIds[2], total_amount: 5670.00, user_id: userId, status: 'completed', created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
      { customer_id: customerIds[3], total_amount: 1950.75, user_id: userId, status: 'completed', created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) },
      { customer_id: customerIds[4], total_amount: 4320.00, user_id: userId, status: 'completed', created_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
      { customer_id: customerIds[5], total_amount: 2150.00, user_id: userId, status: 'pending', created_at: now },
      { customer_id: customerIds[6], total_amount: 3890.50, user_id: userId, status: 'completed', created_at: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000) },
      { customer_id: customerIds[7], total_amount: 5420.00, user_id: userId, status: 'completed', created_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      { customer_id: customerIds[8], total_amount: 2680.75, user_id: userId, status: 'completed', created_at: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000) },
      { customer_id: customerIds[9], total_amount: 4150.00, user_id: userId, status: 'completed', created_at: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000) },
    ];
    const ordersResult = await ordersCollection.insertMany(orders);
    const orderIds = Object.values(ordersResult.insertedIds);

    // Insert order items
    console.log('Inserting order items...');
    const orderItems = [
      { order_id: orderIds[0], product_id: productIds[2], quantity: 5, price: 80.00 },
      { order_id: orderIds[0], product_id: productIds[0], quantity: 2, price: 450.00 },
      { order_id: orderIds[0], product_id: productIds[9], quantity: 3, price: 150.00 },
      { order_id: orderIds[1], product_id: productIds[1], quantity: 4, price: 320.00 },
      { order_id: orderIds[1], product_id: productIds[3], quantity: 2, price: 250.00 },
      { order_id: orderIds[2], product_id: productIds[4], quantity: 1, price: 1200.00 },
      { order_id: orderIds[2], product_id: productIds[6], quantity: 2, price: 420.00 },
      { order_id: orderIds[2], product_id: productIds[10], quantity: 1, price: 420.00 },
      { order_id: orderIds[3], product_id: productIds[8], quantity: 1, price: 1800.00 },
      { order_id: orderIds[3], product_id: productIds[12], quantity: 1, price: 280.00 },
      { order_id: orderIds[4], product_id: productIds[14], quantity: 3, price: 120.00 },
      { order_id: orderIds[4], product_id: productIds[1], quantity: 5, price: 320.00 },
      { order_id: orderIds[4], product_id: productIds[7], quantity: 1, price: 2500.00 },
      { order_id: orderIds[5], product_id: productIds[15], quantity: 1, price: 1500.00 },
      { order_id: orderIds[5], product_id: productIds[16], quantity: 1, price: 980.00 },
    ];
    await orderItemsCollection.insertMany(orderItems);

    // Insert transactions for completed orders
    console.log('Inserting transactions...');
    const transactions = [];
    for (let i = 0; i < orders.length; i++) {
      if (orders[i].status === 'completed') {
        transactions.push({
          description: `Payment for order #${i + 1}`,
          order_id: orderIds[i],
          payment_method_id: paymentMethodIds[i % paymentMethodIds.length],
          amount: orders[i].total_amount,
          user_id: userId,
          type: 'income',
          category: 'selling',
          status: 'completed',
          created_at: orders[i].created_at,
        });
      }
    }
    await transactionsCollection.insertMany(transactions);

    console.log('MongoDB seeding completed successfully!');
    console.log(`- Test user email: test@example.com`);
    console.log(`- Test user password: 12345678`);
    console.log(`- Products: ${productIds.length}`);
    console.log(`- Customers: ${customerIds.length}`);
    console.log(`- Orders: ${orderIds.length}`);
    console.log(`- Transactions: ${transactions.length}`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding MongoDB:', error);
    process.exit(1);
  }
}

seed();
