const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

function generateRandomString(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for ( let i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

// Generate dataset for "Parties" (Customers/Vendors)
const partiesData = [];
for (let i = 0; i < 100; i++) {
    partiesData.push({
        ClientName: `Client ${i + 1}`,
        Phone: `0300${randomInt(1000000, 9999999)}`,
        Company: `Company ${generateRandomString(5)}`,
        Address: `Address Line ${randomInt(1, 100)}`,
        OutStanding: randomInt(-5000, 5000)
    });
}

// Generate dataset for "Products"
const productsData = [];
for (let i = 0; i < 100; i++) {
    const cost = randomInt(50, 500);
    productsData.push({
        ItemName: `Product ${generateRandomString(4)}`,
        SalePrice: cost + randomInt(20, 100),
        CostPrice: cost,
        QuantityInHand: randomInt(0, 1000),
        Barcode: `SKU-${randomInt(1000, 9999)}`,
        Category: `Category ${randomInt(1, 10)}`
    });
}

// Generate dataset for "Transactions" (Invoices)
const transactionsData = [];
for (let i = 0; i < 100; i++) {
    const qty = randomInt(1, 10);
    const price = randomInt(50, 500);
    transactionsData.push({
        InvoiceNumber: `INV-${randomInt(1000, 9999)}`,
        Customer: `Client ${randomInt(1, 50)}`,
        Date: new Date(Date.now() - randomInt(0, 10000000000)).toISOString().split('T')[0],
        Item: `Product ${generateRandomString(4)}`,
        Qty: qty,
        Rate: price,
        DiscountAmount: randomInt(0, 10),
        TotalAmount: (qty * price) - 10,
        SubTotal: qty * price,
        Shipping: randomInt(0, 50)
    });
}

// Generate dataset for "Payments"
const paymentsData = [];
for (let i = 0; i < 100; i++) {
    paymentsData.push({
        Party: `Client ${randomInt(1, 100)}`,
        Amount: randomInt(100, 5000),
        Method: randomInt(0, 1) === 0 ? "Cash" : "Bank",
        PaymentDate: new Date(Date.now() - randomInt(0, 10000000000)).toISOString().split('T')[0],
        TxnType: randomInt(0, 1) === 0 ? "payment-in" : "payment-out"
    });
}

// Generate dataset for "Expenses"
const expensesData = [];
for (let i = 0; i < 100; i++) {
    const qty = randomInt(1, 5);
    const rate = randomInt(100, 1000);
    expensesData.push({
        ExpNumber: `EXP-${randomInt(1000, 9999)}`,
        Date: new Date(Date.now() - randomInt(0, 10000000000)).toISOString().split('T')[0],
        ExpCategory: `Category ${randomInt(1, 5)}`,
        Name: `Item ${generateRandomString(3)}`,
        Quantity: qty,
        Price: rate,
        Total: qty * rate
    });
}

// Generate dataset for "Staff"
const staffData = [];
for (let i = 0; i < 50; i++) {
    staffData.push({
        FullName: `Staff ${i + 1}`,
        EmailAddress: `staff${i + 1}@example.com`,
        JobRole: randomInt(0, 1) === 0 ? "Admin" : "Cashier"
    });
}

// Create a new workbook
const wb = XLSX.utils.book_new();

// Add sheets to workbook
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(partiesData), "Clients");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productsData), "Inventory");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(transactionsData), "SalesData");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paymentsData), "CashFlow");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expensesData), "CompanyExpenses");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(staffData), "Employees");

// Write to file
const outputPath = path.join("C:\\Users\\Wajiz.pk\\.gemini\\antigravity-ide\\brain\\e4264c65-5fd3-407a-8d99-38110804716f\\scratch", "SampleData_MultiModule_100Rows.xlsx");
XLSX.writeFile(wb, outputPath);

console.log(`Generated sample data at: ${outputPath}`);
