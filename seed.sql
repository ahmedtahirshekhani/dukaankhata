-- Seed file with dummy Pakistani data for FinOpenPOS

-- Delete existing data
DELETE FROM transactions;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM customers;
DELETE FROM products;
DELETE FROM payment_methods;

-- Reset sequences
ALTER SEQUENCE payment_methods_id_seq RESTART WITH 1;
ALTER SEQUENCE products_id_seq RESTART WITH 1;
ALTER SEQUENCE customers_id_seq RESTART WITH 1;
ALTER SEQUENCE orders_id_seq RESTART WITH 1;
ALTER SEQUENCE order_items_id_seq RESTART WITH 1;
ALTER SEQUENCE transactions_id_seq RESTART WITH 1;

-- Insert payment methods
INSERT INTO payment_methods (name) VALUES 
  ('Credit Card'),
  ('Debit Card'),
  ('Cash'),
  ('JazzCash'),
  ('EasyPaisa'),
  ('Bank Transfer');

-- Insert products (Pakistani items)
INSERT INTO products (name, description, price, in_stock, user_uid, category) VALUES
  ('Biryani Masala', 'Authentic Pakistani biryani spice mix', 450.00, 150, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'spices'),
  ('Chai Tea', 'Premium black tea for Pakistani chai', 320.00, 200, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'beverages'),
  ('Naan Bread', 'Fresh homemade naan bread', 80.00, 100, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'bakery'),
  ('Samosa (dozen)', 'Crispy potato samosas - 12 pieces', 250.00, 50, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'snacks'),
  ('Desi Ghee (500ml)', 'Pure clarified butter', 1200.00, 75, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'dairy'),
  ('Lassi (1L)', 'Traditional yogurt drink', 150.00, 120, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'beverages'),
  ('Kebab Masala', 'Seasoning for kebabs and grilled items', 380.00, 100, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'spices'),
  ('Roti Maker', 'Automatic chapati/roti maker', 2500.00, 25, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'appliances'),
  ('Pakistani Rice (5kg)', 'Basmati rice premium quality', 1800.00, 60, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'groceries'),
  ('Mango Lassi Mix', 'Ready mix for mango lassi', 280.00, 80, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'beverages'),
  ('Nihari Masala', 'Spice mix for traditional nihari', 420.00, 110, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'spices'),
  ('Kulfi Mold', 'Traditional kulfi freezing mold set', 850.00, 40, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'kitchen'),
  ('Chapati Flour (2kg)', 'Fine whole wheat flour', 280.00, 150, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'groceries'),
  ('Honey (500g)', 'Pure Pakistani honey', 650.00, 90, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'organic'),
  ('Tea Strainer', 'Stainless steel chai strainer', 120.00, 200, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'kitchen'),
  ('Dates (500g)', 'Premium Ajwa dates from Madinah', 1500.00, 30, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'organic'),
  ('Frying Oil (5L)', 'High quality cooking oil', 980.00, 40, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'groceries'),
  ('Turmeric Powder', 'Pure turmeric powder 500g', 350.00, 120, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'spices'),
  ('Karahi Chicken Kit', 'Pre-measured spice kit for karahi', 280.00, 70, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'spices'),
  ('Biryani Rice (1kg)', 'Long grain basmati rice', 480.00, 100, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'groceries');

-- Insert customers (Pakistani names and data)
INSERT INTO customers (name, email, phone, user_uid, status, created_at) VALUES
  ('Ahmed Khan', 'ahmed.khan@email.com', '+92-300-1234567', 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'active', NOW()),
  ('Fatima Ahmed', 'fatima.ahmed@email.com', '+92-333-2345678', 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'active', NOW()),
  ('Muhammad Hassan', 'm.hassan@email.com', '+92-321-3456789', 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'active', NOW()),
  ('Aisha Malik', 'aisha.malik@email.com', '+92-345-4567890', 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'active', NOW()),
  ('Imran Ali', 'imran.ali@email.com', '+92-300-5678901', 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'active', NOW()),
  ('Rabia Khan', 'rabia.khan@email.com', '+92-333-6789012', 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'inactive', NOW()),
  ('Hassan Raza', 'hassan.raza@email.com', '+92-321-7890123', 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'active', NOW()),
  ('Zainab Hussain', 'zainab.h@email.com', '+92-345-8901234', 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'active', NOW()),
  ('Ali Nawaz', 'ali.nawaz@email.com', '+92-300-9012345', 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'active', NOW()),
  ('Hina Mirza', 'hina.mirza@email.com', '+92-333-0123456', 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'active', NOW());

-- Insert orders
INSERT INTO orders (customer_id, total_amount, user_uid, status, created_at) VALUES
  (1, 3450.00, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'completed', NOW() - INTERVAL '5 days'),
  (2, 2890.50, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'completed', NOW() - INTERVAL '4 days'),
  (3, 5670.00, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'completed', NOW() - INTERVAL '3 days'),
  (4, 1950.75, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'completed', NOW() - INTERVAL '2 days'),
  (5, 4320.00, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'completed', NOW() - INTERVAL '1 day'),
  (6, 2150.00, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'pending', NOW()),
  (7, 3890.50, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'completed', NOW() - INTERVAL '6 days'),
  (8, 5420.00, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'completed', NOW() - INTERVAL '7 days'),
  (9, 2680.75, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'completed', NOW() - INTERVAL '8 days'),
  (10, 4150.00, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'completed', NOW() - INTERVAL '9 days');

-- Insert order items
INSERT INTO order_items (order_id, product_id, quantity, price) VALUES
  (1, 3, 5, 80.00),
  (1, 1, 2, 450.00),
  (1, 10, 3, 150.00),
  (2, 2, 4, 320.00),
  (2, 4, 2, 250.00),
  (3, 5, 1, 1200.00),
  (3, 7, 2, 420.00),
  (3, 11, 1, 420.00),
  (4, 9, 1, 1800.00),
  (4, 13, 1, 280.00),
  (5, 15, 3, 120.00),
  (5, 2, 5, 320.00),
  (5, 8, 1, 2500.00),
  (6, 16, 1, 1500.00),
  (6, 17, 1, 980.00),
  (7, 1, 3, 450.00),
  (7, 4, 4, 250.00),
  (7, 18, 2, 350.00),
  (8, 5, 2, 1200.00),
  (8, 10, 4, 150.00),
  (9, 12, 2, 850.00),
  (9, 20, 1, 480.00),
  (10, 3, 8, 80.00),
  (10, 6, 2, 150.00),
  (10, 14, 1, 650.00);

-- Insert transactions
INSERT INTO transactions (description, order_id, payment_method_id, amount, user_uid, type, category, status, created_at) VALUES
  ('Order #1 - Biryani and Naan supplies', 1, 1, 3450.00, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'income', 'sales', 'completed', NOW() - INTERVAL '5 days'),
  ('Order #2 - Chai and Samosa ingredients', 2, 2, 2890.50, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'income', 'sales', 'completed', NOW() - INTERVAL '4 days'),
  ('Order #3 - Bulk Ghee purchase', 3, 3, 5670.00, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'income', 'sales', 'completed', NOW() - INTERVAL '3 days'),
  ('Order #4 - Rice and flour order', 4, 4, 1950.75, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'income', 'sales', 'completed', NOW() - INTERVAL '2 days'),
  ('Order #5 - Mixed groceries', 5, 5, 4320.00, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'income', 'sales', 'completed', NOW() - INTERVAL '1 day'),
  ('Order #6 - Dates and honey', 6, 6, 2150.00, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'income', 'sales', 'pending', NOW()),
  ('Rent payment - Shop rent', NULL, 3, 15000.00, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'expense', 'rent', 'completed', NOW() - INTERVAL '10 days'),
  ('Electricity bill - Monthly', NULL, 6, 3500.00, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'expense', 'utilities', 'completed', NOW() - INTERVAL '9 days'),
  ('Water supply - Monthly', NULL, 3, 800.00, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'expense', 'utilities', 'completed', NOW() - INTERVAL '8 days'),
  ('Staff salary - Salesman 1', NULL, 6, 25000.00, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'expense', 'salary', 'completed', NOW() - INTERVAL '7 days'),
  ('Staff salary - Salesman 2', NULL, 6, 25000.00, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'expense', 'salary', 'completed', NOW() - INTERVAL '7 days'),
  ('Supplier payment - Spices', NULL, 6, 12000.00, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'expense', 'suppliers', 'completed', NOW() - INTERVAL '6 days'),
  ('Marketing - Social media ads', NULL, 1, 5000.00, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'expense', 'marketing', 'completed', NOW() - INTERVAL '5 days'),
  ('Equipment repair - Roti maker', NULL, 3, 2000.00, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'expense', 'maintenance', 'completed', NOW() - INTERVAL '4 days'),
  ('Internet bill', NULL, 6, 1500.00, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'expense', 'utilities', 'completed', NOW() - INTERVAL '3 days'),
  ('Cleaning supplies', NULL, 3, 800.00, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'expense', 'supplies', 'completed', NOW() - INTERVAL '2 days'),
  ('Order #7 - Bulk spice order', 7, 1, 3890.50, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'income', 'sales', 'completed', NOW() - INTERVAL '6 days'),
  ('Order #8 - Large ghee order', 8, 2, 5420.00, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'income', 'sales', 'completed', NOW() - INTERVAL '7 days'),
  ('Order #9 - Kitchen tools', 9, 3, 2680.75, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'income', 'sales', 'completed', NOW() - INTERVAL '8 days'),
  ('Order #10 - Bakery supplies', 10, 5, 4150.00, 'fbd7d719-e434-4521-b7b7-bf2759e990e7', 'income', 'sales', 'completed', NOW() - INTERVAL '9 days');

-- Verify data insertion
SELECT COUNT(*) as "Total Products" FROM products;
SELECT COUNT(*) as "Total Customers" FROM customers;
SELECT COUNT(*) as "Total Orders" FROM orders;
SELECT COUNT(*) as "Total Order Items" FROM order_items;
SELECT COUNT(*) as "Total Transactions" FROM transactions;
SELECT SUM(amount) as "Total Revenue" FROM transactions WHERE type = 'income';
SELECT SUM(amount) as "Total Expenses" FROM transactions WHERE type = 'expense';
