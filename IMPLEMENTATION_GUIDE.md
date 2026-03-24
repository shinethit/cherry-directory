# Cherry Directory v2 - Implementation Guide

## အဆင့်မြှင့်တင်မှုများ အကျဉ်းချုပ် (Implementation Summary)

ဤ ရေဒီမီ ဖိုင်သည် Cherry Directory Project ၏ အဆင့်မြှင့်တင်မှုများ နှင့် ပြင်ဆင်ချက်များ အကြောင်း အသေးစိတ် ရှင်းလင်းထားပါသည်။

### Phase 1: Foundation & Stability ✅

**အကောင်အထည်ဖော်ပြီးပါပြီ:**

1. **Code Quality Tools**
   - ESLint configuration (`.eslintrc.json`) - ကုဒ်အရည်အသွေး ကြည့်ရှုခြင်း
   - Prettier configuration (`.prettierrc.json`) - ကုဒ်ပုံစံ အလိုအလျှောက်ပြင်ဆင်ခြင်း
   - npm scripts: `lint`, `lint:fix`, `format`, `format:check`

2. **Error Handling & Logging**
   - `src/lib/errorHandler.js` - Centralized error handling with Sentry integration
   - Error Boundary component for React error catching
   - Structured error logging for API and Supabase errors

3. **User Feedback System**
   - `src/lib/toast.js` - Toast notification utilities (success, error, info, warning, loading)
   - React Toastify integration for user-friendly notifications

4. **Input Validation**
   - `src/lib/validation.js` - Comprehensive validation utilities
   - Email, phone, URL, listing, fuel report, and review validation
   - Input sanitization to prevent XSS attacks

### Phase 2: Performance & UX ✅

**အကောင်အထည်ဖော်ပြီးပါပြီ:**

1. **Data Caching with React Query**
   - `src/lib/queryClient.js` - Configured React Query client
   - `src/hooks/useListings.js` - Listings data fetching with caching
   - `src/hooks/useFuelStations.js` - Fuel stations data fetching with real-time subscriptions
   - Automatic cache invalidation on mutations

2. **Image Optimization**
   - `src/lib/imageOptimization.js` - Cloudinary URL generation with transformations
   - Responsive image srcset and sizes generation
   - Lazy loading support with automatic quality and format optimization
   - `src/components/OptimizedImage.jsx` - Optimized image component with loading states

3. **Performance Features**
   - Pagination support in listing queries
   - Stale time configuration for different data types
   - Automatic refetch prevention on window focus

### Phase 3: New Features ✅

**အကောင်အထည်ဖော်ပြီးပါပြီ:**

1. **Database Bookmarks**
   - `src/hooks/useBookmarksDB.js` - Full bookmark management with database persistence
   - Add, remove, toggle bookmarks
   - Check bookmark status for listings
   - User-specific bookmark queries

2. **Enhanced Reviews System**
   - `src/hooks/useReviews.js` - Complete review management
   - Create, update, delete reviews
   - Admin review approval workflow
   - User review history tracking
   - Automatic rating calculation

3. **Notification System**
   - `src/lib/notificationService.js` - Notification creation and management
   - Real-time notification subscriptions
   - Multiple notification types (listing approved, new review, fuel status, etc.)
   - Mark as read, delete, and batch operations
   - `src/hooks/useNotifications.js` - React hooks for notification management

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create `.env.local` file with:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
VITE_SENTRY_DSN=your_sentry_dsn (optional)
```

### 3. Database Setup

Run the Supabase schema:

```sql
-- Execute supabase-schema-final.sql in Supabase SQL Editor
```

Create notifications table (if not exists):

```sql
create table if not exists notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  data jsonb default '{}',
  is_read boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table notifications enable row level security;

create policy "Users can view their own notifications" on notifications
  for select using (auth.uid() = user_id);

create policy "System can insert notifications" on notifications
  for insert with check (true);
```

### 4. Development

```bash
npm run dev
```

### 5. Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

### 6. Build for Production

```bash
npm run build
```

## Usage Examples

### Using React Query for Data Fetching

```jsx
import { useListings } from './hooks/useListings';

function ListingsPage() {
  const { data, isLoading, error } = useListings({ category_id: '123' }, 1);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data?.listings.map(listing => (
        <div key={listing.id}>{listing.name}</div>
      ))}
    </div>
  );
}
```

### Using Optimized Images

```jsx
import OptimizedImage from './components/OptimizedImage';

function ListingCard({ listing }) {
  return (
    <div>
      <OptimizedImage
        publicId={listing.logo_url}
        alt={listing.name}
        imageType="card"
        className="w-full h-48 rounded-lg"
      />
      <h3>{listing.name}</h3>
    </div>
  );
}
```

### Using Toast Notifications

```jsx
import { showSuccess, showError } from './lib/toast';

async function handleSave() {
  try {
    await saveData();
    showSuccess('အချက်အလက် သိမ်းဆည်းခဲ့သည်။');
  } catch (error) {
    showError('အမှားအယွင်း ဖြစ်ပေါ်ခဲ့သည်။');
  }
}
```

### Using Bookmarks

```jsx
import { useToggleBookmark, useIsBookmarked } from './hooks/useBookmarksDB';

function ListingDetail({ listingId }) {
  const { data: isBookmarked } = useIsBookmarked(listingId);
  const toggleBookmark = useToggleBookmark();

  return (
    <button
      onClick={() => toggleBookmark.mutate({ targetId: listingId })}
      className={isBookmarked ? 'text-red-500' : 'text-gray-500'}
    >
      ❤️ Bookmark
    </button>
  );
}
```

### Using Reviews

```jsx
import { useReviews, useCreateReview } from './hooks/useReviews';

function ReviewSection({ listingId }) {
  const { data: reviews } = useReviews(listingId);
  const createReview = useCreateReview(listingId);

  const handleSubmitReview = async (rating, comment) => {
    await createReview.mutateAsync({ rating, comment });
  };

  return (
    <div>
      {reviews?.map(review => (
        <div key={review.id}>{review.comment}</div>
      ))}
    </div>
  );
}
```

### Using Notifications

```jsx
import { useNotifications, useNotificationSubscription } from './hooks/useNotifications';

function NotificationCenter() {
  const { data: notifications } = useNotifications();
  useNotificationSubscription(); // Subscribe to real-time updates

  return (
    <div>
      {notifications?.map(notification => (
        <div key={notification.id}>{notification.message}</div>
      ))}
    </div>
  );
}
```

## Key Features

### ✨ Error Handling
- Centralized error handling with Sentry integration
- React Error Boundary for component errors
- User-friendly error messages in Burmese

### ⚡ Performance
- React Query for intelligent caching
- Image optimization with Cloudinary
- Lazy loading and responsive images
- Pagination for large datasets

### 🔐 Security
- Input validation and sanitization
- XSS prevention
- Supabase Row Level Security (RLS)
- Error logging without exposing sensitive data

### 🎨 User Experience
- Toast notifications for user feedback
- Loading states and skeleton screens
- Responsive design with Tailwind CSS
- Real-time updates with Supabase subscriptions

### 📱 Features
- Bookmarks with database persistence
- Enhanced review system with admin approval
- Real-time notifications
- Fuel status tracking with live updates

## File Structure

```
src/
├── lib/
│   ├── errorHandler.js          # Error handling and Sentry integration
│   ├── toast.js                 # Toast notification utilities
│   ├── validation.js            # Input validation utilities
│   ├── imageOptimization.js     # Image optimization utilities
│   ├── queryClient.js           # React Query configuration
│   ├── notificationService.js   # Notification management
│   └── supabase.js              # Supabase client
├── hooks/
│   ├── useListings.js           # Listings data fetching
│   ├── useFuelStations.js       # Fuel stations data fetching
│   ├── useBookmarksDB.js        # Bookmarks management
│   ├── useReviews.js            # Reviews management
│   └── useNotifications.js      # Notifications management
├── components/
│   ├── OptimizedImage.jsx       # Optimized image component
│   └── ... (other components)
└── pages/
    └── ... (page components)
```

## Next Steps

1. **Testing**: Add Jest and React Testing Library for unit tests
2. **E2E Testing**: Add Cypress or Playwright for end-to-end tests
3. **Admin Dashboard**: Create comprehensive admin panel
4. **Analytics**: Integrate analytics for tracking user behavior
5. **Performance Monitoring**: Set up performance monitoring with Web Vitals
6. **CI/CD**: Set up GitHub Actions for automated testing and deployment

## Support

For issues or questions, please refer to:
- Supabase Documentation: https://supabase.com/docs
- React Query Documentation: https://tanstack.com/query/latest
- Tailwind CSS Documentation: https://tailwindcss.com/docs
- Cloudinary Documentation: https://cloudinary.com/documentation

---

**Version**: 2.0.0  
**Last Updated**: March 24, 2026  
**Author**: Manus AI
