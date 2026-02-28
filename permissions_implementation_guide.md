# Permissions Implementation Guide

This document outlines the standard procedure for implementing page-level access control within the Ticket Tracker application. Follow these steps whenever a new protected page is added.

## Architecture Overview

The system uses a **Granular Permission Model** where:
1.  **Backend**: Stores permissions as a JSON object in the `users` table (`permissions` column).
2.  **AuthContext**: Manages the logged-in user state and provides a `refreshUser()` method to sync with the DB.
3.  **RootLayout**: Acts as the security gatekeeper, handling sidebar visibility and URL redirection.

---

## Steps to Register a New Page

### 1. Define the Navigation Entry
In `frontend/Nibss Tracker UI/src/app/components/RootLayout.tsx`, locate the `navItems` array. Add your new page with a unique `id`. This `id` is the key used for permission checks.

```tsx
const navItems = [
    // ... existing items
    { 
        path: '/new-page-url', 
        id: 'new-page-id', // <--- This is the permission key
        label: 'New Page Label', 
        icon: YourIcon 
    },
];
```

### 2. Register for Admin Management
In `frontend/Nibss Tracker UI/src/app/pages/UserManagement.tsx`, add the same `id` and label to the `AVAILABLE_PAGES` array. This makes it appear in the permission editor toggles.

```tsx
const AVAILABLE_PAGES = [
    // ... existing items
    { id: 'new-page-id', label: 'New Page Name', icon: YourIcon }
];
```

### 3. Verification & Redirection
The security logic is already centralized in `RootLayout.tsx`. It automatically:
- Filters the **Sidebar links** using `hasPermission(item.id)`.
- **Redirects** unauthorized URL access back to the Dashboard using a `useEffect` hook.

**Note**: If your page should be **implicitly** accessible to Admins (like the User Management page), add a special case to the `hasPermission` function in `RootLayout.tsx`:

```tsx
const hasPermission = (itemId: string) => {
    const isAdmin = user.role === 'Admin' || user.permissions?.admin;
    
    // Example: Grant implicit access to Admins
    if (itemId === 'new-page-id') return isAdmin; 

    // Standard check
    return !!user.permissions?.pages?.includes(itemId);
};
```

### 4. Ensuring Real-time Updates
When creating pages that modify user settings or permissions, always use the `refreshUser` method from `useAuth()` to ensure the UI updates instantly without a page reload.

---

## Best Practices
- **Unique IDs**: Always use Kebab-case for page IDs (e.g., `incident-tracker`, not `incidentTracker`).
- **Granularity**: Keep permissions specific to pages. Avoid "bundling" multiple distinct features under one ID unless they are logically inseparable.
- **Fail-Safe**: The `hasPermission` function defaults to `false` (restrictive). Never return `true` as a default.
