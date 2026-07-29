# Finance and Inventory Management System

This is an Account and Inventory Management System built with Next.js, React, and MongoDB. It provides a comprehensive solution for managing products, customers, orders, and transactions in a retail or small business setting.

As a developer with extensive experience in creating similar applications, this project represents the culmination of years of expertise in building Finance systems. Of course, in the beginning the project seem a little raw, but with time and hopefully with the help of the community, it will become a robust and feature-rich solution for businesses of all sizes.

This particular iteration embraces the spirit of open-source development, making it freely available for the community to use, modify, and improve upon.

## Features

- **Dashboard**: Overview of key metrics and charts
- **Products Management**: Add, edit, delete, and view products
- **Customer Management**: Manage customer information and status
- **Order Management**: Create and manage orders
- **Point of Sale (Finance)**: Quick and easy sales processing
- **User Authentication**: Secure login system

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: MongoDB (NoSQL database)
- **Authentication**: NextAuth.js
- **State Management**: React Hooks
- **UI Components**: Custom components and Shadcn UI
- **Charts**: Recharts

## Getting Started

1. Clone the reFinanceitory
2. Install dependencies:
   ```
   npm install
   ```
3. Set up your MongoDB connection and add the necessary environment variables:
   - Create a `.env.local` file in the root of your project
   - Add the following lines to the file:
     ```
     MONGODB_URL=your_mongodb_connection_string
     MONGODB_DB_NAME=dukaankhata
     NEXTAUTH_SECRET=your_secret_key
     NEXTAUTH_URL=http://localhost:3000
     # Optional: Google Analytics 4 Measurement ID
     NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
     # Optional: Google Tag Manager Container ID
     NEXT_PUBLIC_GTM_ID=GTM-XXXXXXXXXX
     ```
   - Replace `your_mongodb_connection_string` with your actual MongoDB Atlas connection string
   - (Optional) Enable FinancetHog analytics by adding
     ```
     NEXT_PUBLIC_FinanceTHOG_KEY=<FinanceTHOG_PROJECT_API_KEY>
     NEXT_PUBLIC_FinanceTHOG_HOST=https://us.i.Financethog.com
     ```
     Use your project API key from FinancetHog and set `NEXT_PUBLIC_FinanceTHOG_HOST` to your chosen FinancetHog host (US default shown above).
4. Seed the database with sample data:
   ```
   npm run seed:mongodb
   ```
5. Run the development server:
   ```
   npm run dev
   ```
6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Analytics

This project integrates **Google Analytics 4 (GA4)** and **Google Tag Manager (GTM)** for comprehensive tracking. Both are **optional** and activated only when their respective environment variables are configured.

### Configuration

In `.env.local`, set:

```bash
# GA4 Measurement ID (direct GA4 tracking via gtag.js)
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# GTM Container ID (container-based tag management)
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXXXXX
```

Both are opt-in. If either variable is omitted, that service is not initialized; **no scripts are injected and there is no performance impact**.

### How It Works

#### Automatic Page View Tracking

- Page views are automatically sent on route changes via [src/components/ga-tracker.tsx](src/components/ga-tracker.tsx) (GA4) and [src/components/gtm-tracker.tsx](src/components/gtm-tracker.tsx) (GTM).

#### User Authentication Tracking (GTM)

- [src/components/gtm-tracker.tsx](src/components/gtm-tracker.tsx) pushes session state and user ID to the dataLayer on login/logout.

#### Shared dataLayer

- Both GA4 and GTM read from `window.dataLayer`, allowing them to work together seamlessly or independently.

### Usage

#### Direct GA4 Events

Use [src/lib/gtag.ts](src/lib/gtag.ts) for GA4-only tracking:

```typescript
import { event } from "@/lib/gtag";

event({
  action: "purchase",
  value: 1999,
  params: { currency: "PKR" },
});
```

#### GTM Events

Use [src/lib/gtm.ts](src/lib/gtm.ts) for low-level dataLayer events:

```typescript
import { pushEvent } from "@/lib/gtm";

pushEvent({
  event: "custom_event",
  custom_param: "value",
});
```

#### Business Events (Recommended for Finance)

Use [src/lib/gtm-events.ts](src/lib/gtm-events.ts) for high-level business logic tracking. This layer provides semantic helpers that integrate with both GA4 and GTM:

```typescript
import {
  trackInvoiceCreated,
  trackLogin,
  trackProductSearch,
  trackCustomerAction,
  trackOrderCreated,
} from "@/lib/gtm-events";

// Track invoice creation
trackInvoiceCreated({
  id: "INV-001",
  total: 5000,
  tax: 500,
  items: [{ id: "P1", name: "Product A", quantity: 2, price: 2250 }],
});

// Track login
trackLogin();

// Track product search
trackProductSearch("shirt", 24);

// Track customer actions
trackCustomerAction("add", "CUST-123");

// Track order creation
trackOrderCreated({
  id: "ORD-456",
  total: 10000,
  itemCount: 5,
});
```

### Architecture

| Component                                                        | PurFinancee                                       |
| ---------------------------------------------------------------- | --------------------------------------------- |
| [src/lib/gtag.ts](src/lib/gtag.ts)                               | GA4 utilities for direct measurement tracking |
| [src/components/ga-tracker.tsx](src/components/ga-tracker.tsx)   | GA4 client-side page view and route tracking  |
| [src/lib/gtm.ts](src/lib/gtm.ts)                                 | GTM utilities for dataLayer event pushing     |
| [src/components/gtm-tracker.tsx](src/components/gtm-tracker.tsx) | GTM client-side page view and user tracking   |
| [src/lib/gtm-events.ts](src/lib/gtm-events.ts)                   | High-level business event helpers for Finance     |

### Best Practices

1. **Use business event helpers:** Prefer [src/lib/gtm-events.ts](src/lib/gtm-events.ts) for common actions (invoices, orders, login) to keep analytics code clean.
2. **Keep payloads lean:** Only include necessary fields in events to minimize bandwidth.
3. **GA4 + GTM together:** Leverage GA4 for direct measurement and GTM for flexible, no-code tag management.
4. **Privacy compliance:** Ensure analytics comply with GDPR, CCPA, and local regulations. Consider adding consent management.
5. **Performance:** All scripts use `strategy: "afterInteractive"` to avoid blocking page rendering.

## Project Structure

- `src/app/`: Next.js app router pages
- `src/components/`: Reusable React components
- `src/lib/`: Utility functions and MongoDB client
- `scripts/`: Database seeding scripts

## Key Pages

- `/admin`: Main dashboard
- `/admin/products`: Product management
- `/admin/customers`: Customer management
- `/admin/orders`: Order management
- `/admin/invoicing`: Invoicing interface

## Database Schema

The project uses MongoDB with the following main collections:

- `products`: Store product information
- `customers`: Customer details
- `orders`: Order information
- `order_items`: Items within each order
- `transactions`: Financial transactions
- `payment_methods`: Available payment methods
- `users`: User accounts

## Authentication

User authentication is handled through NextAuth.js with MongoDB. The login page is available at `/login`.

## Default Test Credentials

After seeding the database:

- **Email**: test@example.com
- **Password**: 12345678

## Error Handling

A basic error page is implemented at `/error` to handle and display any errors that occur during runtime.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).


