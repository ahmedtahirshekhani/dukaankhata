# Landing Page Components

This directory contains all the components for the DukaanKhata landing page.

## 📁 Files

### `index.tsx`

Main landing page container component that orchestrates all sub-components.

**Props:** None  
**State:**

- `waitlistModalOpen` - Controls modal visibility

**Children:**

- LandingHeader
- LandingHero
- LandingFooter
- WaitlistModal

---

### `landing-header.tsx`

Sticky header with logo, navigation, and action buttons.

**Props:**

- `onJoinClick: () => void` - Callback when Join Waitlist button is clicked

**Features:**

- Responsive navigation
- Mobile hamburger menu
- Language switcher
- Dashboard link
- Join Waitlist button
- Sticky positioning with backdrop blur

**Responsive Breakpoints:**

- Mobile: < 768px (shows hamburger menu)
- Desktop: ≥ 768px (shows full navigation)

---

### `landing-hero.tsx`

Main hero section with features, benefits, and call-to-action.

**Props:**

- `onJoinClick: () => void` - Callback when Join Waitlist button is clicked

**Sections:**

1. **Hero Banner** - Headline, description, and CTA buttons
2. **Features Section** - 3 feature cards with icons
3. **Benefits Section** - 6 key benefits with checkmarks
4. **CTA Section** - Final call-to-action

**Features:**

- Gradient backgrounds
- Icon cards
- Responsive grid layouts
- Multiple CTA buttons
- Social proof badges

---

### `landing-footer.tsx`

Professional footer with links and social media.

**Props:** None

**Sections:**

- Brand information
- Product links (Features, Pricing, Security)
- Company links (About, Blog, Contact)
- Legal links (Privacy Policy, Terms)
- Social media links
- Copyright information

**Features:**

- Responsive grid layout
- Link grouping
- Social media icons
- Brand identity

---

### `waitlist-modal.tsx`

Modal dialog with waitlist signup form.

**Props:**

- `open: boolean` - Controls modal visibility
- `onOpenChange: (open: boolean) => void` - Callback for open/close

**Form Fields:**

| Field           | Type     | Required    | Behavior                              |
| --------------- | -------- | ----------- | ------------------------------------- |
| Name            | text     | Yes         | Text input                            |
| WhatsApp Number | tel      | Yes         | Phone input with helper text          |
| Company Name    | text     | No          | Text input                            |
| Company Address | text     | No          | Text input                            |
| Category        | select   | No          | Dropdown with 8 options               |
| Description     | textarea | Conditional | Appears only when "Other" is selected |

**Categories:**

- Retail Store
- Restaurant
- Bakery
- Pharmacy
- Supermarket
- Boutique
- Hardware Store
- Other (triggers description field)

**Features:**

- Real-time validation
- Error messages
- Loading spinner
- Success confirmation
- Form auto-reset
- Dynamic field visibility
- Animated transitions

---

## 🎯 Component Usage

### Import

```typescript
import { LandingPage } from "@/components/landing";
```

### Render

```tsx
<LandingPage />
```

The component handles all state and child component management internally.

---

## 🎨 Styling

All components use:

- **Tailwind CSS** - For responsive styling
- **shadcn/ui components** - For consistent UI elements
- **lucide-react icons** - For visual elements
- **CSS animations** - For smooth transitions

### Responsive Design

- Mobile-first approach
- Tailwind breakpoints: `sm`, `md`, `lg`
- Touch-friendly interfaces
- Optimized images and layouts

---

## 🔧 Customization

### Change Hero Text

Edit `landing-hero.tsx`:

```typescript
// Line ~40
<h1 className="text-4xl font-bold">Your text here</h1>
```

### Add/Remove Features

Edit `landing-hero.tsx` features array (line ~12-24)

### Modify Categories

Edit `waitlist-modal.tsx` CATEGORIES constant (line ~21-30)

### Update Footer Links

Edit `landing-footer.tsx` links object (line ~6-18)

---

## 📱 Responsive Behavior

### Header

- **Desktop:** Full horizontal navigation
- **Tablet:** Abbreviated navigation
- **Mobile:** Hamburger menu

### Hero Section

- **Desktop:** 2-column grid
- **Tablet:** Stacked layout
- **Mobile:** Single column with center alignment

### Features

- **Desktop:** 3-column grid
- **Tablet:** 2-column grid
- **Mobile:** Single column

### Benefits

- **Desktop:** 2-column grid
- **Tablet:** 2-column grid
- **Mobile:** Single column

### Modal

- **Desktop:** Max width 500px centered
- **Tablet:** Responsive width
- **Mobile:** Full width with padding

---

## 🧪 Testing

### Component Testing

```bash
# Check for TypeScript errors
npm run lint

# Run dev server
npm run dev
```

### Manual Testing

1. Open `http://localhost:3000`
2. Test responsive design (resize window)
3. Test mobile menu (< 768px)
4. Test waitlist modal
5. Test form validation
6. Test dynamic fields
7. Test language switcher
8. Test dashboard link

---

## 🔐 Props & Types

### LandingPage

```typescript
interface LandingPageProps {}
// No props required
```

### LandingHeader

```typescript
interface LandingHeaderProps {
  onJoinClick: () => void;
}
```

### LandingHero

```typescript
interface LandingHeroProps {
  onJoinClick: () => void;
}
```

### LandingFooter

```typescript
interface LandingFooterProps {}
// No props required
```

### WaitlistModal

```typescript
interface WaitlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

---

## 📊 Form Data Structure

```typescript
interface WaitlistFormData {
  name: string;
  whatsappNumber: string;
  companyName: string;
  companyAddress: string;
  category: string;
  description: string;
}
```

---

## 🚀 Future Enhancements

### Phase 1 - API Integration

- [ ] Replace mock API with real endpoint
- [ ] Add email notification
- [ ] Store in database

### Phase 2 - Translations

- [ ] Add form labels to i18n files
- [ ] Translate success messages
- [ ] Translate validation messages

### Phase 3 - Analytics

- [ ] Track modal opens
- [ ] Track form submissions
- [ ] Track button clicks

### Phase 4 - Admin

- [ ] Create waitlist submissions page
- [ ] Add email export functionality
- [ ] Add submission analytics

---

## 🆘 Troubleshooting

### Modal Won't Open

- Check `open` prop is controlled properly
- Verify `onOpenChange` callback is connected
- Check browser console for errors

### Form Validation Not Working

- Verify field names match validation logic
- Check `validateForm()` function
- Ensure required fields are marked correctly

### Styles Not Applied

- Clear Next.js cache: `rm -rf .next`
- Restart dev server
- Check Tailwind CSS config

### Mobile Menu Not Working

- Check `mobileMenuOpen` state
- Verify `md:hidden` classes are in place
- Test at screen width < 768px

---

## 📝 Notes

- Form currently uses mock API (1 second delay)
- To implement real API, replace delay with fetch call
- All components are client-side (`"use client"`)
- No server-side rendering required
- Fully compatible with Next.js 14+

---

## 📞 Support

For detailed information, see:

- `LANDING_PAGE_IMPLEMENTATION.md` - Technical guide
- `LANDING_PAGE_QUICK_START.md` - Quick reference
- `LANDING_PAGE_SUMMARY.md` - Complete summary

---

**Last Updated:** January 11, 2026
