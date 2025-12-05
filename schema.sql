-- Drop tables if they exist
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS payment_methods;
DROP TABLE IF EXISTS users;

-- Create Users table
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    company_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    in_stock INTEGER NOT NULL,
    user_id BIGINT NOT NULL REFERENCES users(id),
    category VARCHAR(50)
);

-- Create Customers table
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    user_id BIGINT NOT NULL REFERENCES users(id),
    status VARCHAR(20) CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Orders table
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    total_amount DECIMAL(10, 2) NOT NULL,
    user_id BIGINT NOT NULL REFERENCES users(id),
    status VARCHAR(20) CHECK (status IN ('pending', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create OrderItems table
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL
);

-- Create PaymentMethods table
CREATE TABLE payment_methods (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- Create Transactions table
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    description TEXT,
    order_id INTEGER REFERENCES orders(id),
    payment_method_id INTEGER REFERENCES payment_methods(id),
    amount DECIMAL(10, 2) NOT NULL,
    user_id BIGINT NOT NULL REFERENCES users(id),
    type VARCHAR(20) CHECK (type IN ('income', 'expense')),
    category VARCHAR(100),
    status VARCHAR(20) CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial payment methods
INSERT INTO payment_methods (name) VALUES ('Credit Card'), ('Debit Card'), ('Cash');