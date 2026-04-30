import * as XLSX from "xlsx";

/**
 * Create a sample products Excel file for testing imports
 * This file includes realistic test data for products
 */
export function createSampleProductsExcel() {
  const sampleData = [
    {
      Name: "Smartphone Samsung Galaxy A13",
      Description: "Latest smartphone with 6.5 inch display",
      Type: "Goods",
      "Sell Price (Rs.)": 45000,
      "Cost Price (Rs.)": 35000,
      Quantity: 50,
      "Unit of Measurement": "Piece",
      Category: "Electronics",
      Branch: "Main Store",
    },
    {
      Name: "Laptop Dell Inspiron 15",
      Description: "15 inch FHD laptop with Intel i5",
      Type: "Goods",
      "Sell Price (Rs.)": 125000,
      "Cost Price (Rs.)": 95000,
      Quantity: 20,
      "Unit of Measurement": "Piece",
      Category: "Electronics",
      Branch: "Main Store",
    },
    {
      Name: "Wireless Headphones",
      Description: "Noise-cancelling wireless headphones",
      Type: "Goods",
      "Sell Price (Rs.)": 8500,
      "Cost Price (Rs.)": 5500,
      Quantity: 100,
      "Unit of Measurement": "Piece",
      Category: "Accessories",
      Branch: "Main Store",
    },
    {
      Name: "USB Cable Type-C",
      Description: "1m USB Type-C charging cable",
      Type: "Goods",
      "Sell Price (Rs.)": 800,
      "Cost Price (Rs.)": 400,
      Quantity: 500,
      "Unit of Measurement": "Piece",
      Category: "Accessories",
      Branch: "Branch 2",
    },
    {
      Name: "Consulting Service",
      Description: "Professional IT consulting per hour",
      Type: "Services",
      "Sell Price (Rs.)": 5000,
      "Cost Price (Rs.)": 2000,
      Quantity: 100,
      "Unit of Measurement": "Piece",
      Category: "Services",
      Branch: "Main Store",
    },
    {
      Name: "Office Chair Ergonomic",
      Description: "Comfortable ergonomic office chair",
      Type: "Goods",
      "Sell Price (Rs.)": 15000,
      "Cost Price (Rs.)": 9000,
      Quantity: 25,
      "Unit of Measurement": "Piece",
      Category: "Furniture",
      Branch: "Main Store",
    },
    {
      Name: "Printer HP LaserJet",
      Description: "Black and white laser printer",
      Type: "Goods",
      "Sell Price (Rs.)": 35000,
      "Cost Price (Rs.)": 26000,
      Quantity: 10,
      "Unit of Measurement": "Piece",
      Category: "Electronics",
      Branch: "Branch 2",
    },
    {
      Name: "A4 Paper Ream",
      Description: "500 sheets of A4 white paper",
      Type: "Goods",
      "Sell Price (Rs.)": 1200,
      "Cost Price (Rs.)": 800,
      Quantity: 200,
      "Unit of Measurement": "Box",
      Category: "Stationery",
      Branch: "Main Store",
    },
    {
      Name: "Pen Set Blue",
      Description: "Pack of 10 blue ballpoint pens",
      Type: "Goods",
      "Sell Price (Rs.)": 400,
      "Cost Price (Rs.)": 200,
      Quantity: 1000,
      "Unit of Measurement": "Pack",
      Category: "Stationery",
      Branch: "Branch 2",
    },
    {
      Name: "Desk Lamp LED",
      Description: "Energy-efficient LED desk lamp",
      Type: "Goods",
      "Sell Price (Rs.)": 2500,
      "Cost Price (Rs.)": 1500,
      Quantity: 40,
      "Unit of Measurement": "Piece",
      Category: "Lighting",
      Branch: "Main Store",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

  // Set column widths for better readability
  const colWidths = [
    { wch: 30 },
    { wch: 40 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 20 },
    { wch: 15 },
    { wch: 15 },
  ];
  worksheet["!cols"] = colWidths;

  // Generate and download the file
  XLSX.writeFile(workbook, "sample-products.xlsx");
}
