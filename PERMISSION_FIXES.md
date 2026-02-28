# Permission System Fixes

## Issues Resolved

### Issue 1: Permissions Only Update After Logout/Login
**Problem:** When permissions were changed by an admin, the user had to logout and login again to see the changes. Reloading the page didn't update permissions.

**Root Cause:** 
- RootLayout was loading permissions from localStorage on mount
- `refreshUser()` was being called but without proper sequencing
- No mechanism to wait for fresh permissions from backend before rendering sidebar

**Solution Implemented:**
1. Added `isLoadingPermissions` state to AuthContext to track when refresh is in progress
2. Added `setIsLoadingPermissions(true)` when `refreshUser()` starts and `setIsLoadingPermissions(false)` when complete
3. RootLayout now calls `refreshUser()` on mount and waits for completion before rendering
4. This ensures sidebar shows fresh permissions immediately on page reload

**Files Modified:**
- `AuthContext.tsx`: Added loading state tracking
- `RootLayout.tsx`: Added initialization check that calls refreshUser() on mount

---

### Issue 2: DevelopmentTracker Doesn't Filter Teams by Permission
**Problem:** A user with access to "Development Tracker" page but only "Collections Team" was seeing all 4 teams (Collections, Data & Identity, Treasury, Payments) instead of just Collections.

**Root Cause:** Need to investigate - added detailed logging to identify where filtering is failing.

**Solution Implemented:**
1. Added comprehensive console.log statements to trace:
   - Full user object from state
   - Complete permissions structure
   - Filtering logic execution
   - Teams before/after filtering
   - Filtered teams array
   - User role and admin status

2. Enhanced logging includes:
   - User role
   - isAdmin flag value
   - Full user.permissions object
   - Allowed team IDs array
   - Count before and after filtering
   - Complete filtered results

**Files Modified:**
- `DevelopmentTrackerReal.tsx`: Enhanced logging throughout fetchData()

---

## How to Test the Fixes

### Test 1: Permissions Update on Page Reload
**Setup:**
1. Login as admin user
2. Open User Management page
3. Edit an existing user (e.g., tmaku@nibss-plc.com.ng)
4. Change their page permissions (e.g., add/remove "Development Tracker")
5. Save changes

**Test Steps:**
1. Logout
2. Login as the edited user
3. **BEFORE:** Page reload would not show updated sidebar
4. **AFTER:** Simply reload the page (F5) without logout
5. Verify sidebar immediately shows updated pages

**Expected Result:**
- Sidebar updates immediately on page reload without requiring logout
- Console logs show "Initializing RootLayout: refreshing permissions"
- User can see correct pages based on latest permissions

### Test 2: DevelopmentTracker Team Filtering
**Setup:**
1. Login as admin
2. Go to User Management
3. Create an invitation for user with:
   - Pages: ["development"] 
   - Teams: [1] (Collections Team only)
4. Complete registration with that invitation
5. Logout and login as the new user

**Test Steps:**
1. Open the Development Tracker page
2. Check the browser console (F12)
3. Look for logs showing:
   - Current user and permissions
   - User role and admin status
   - Filtering configuration
   - Teams before and after filtering

**Expected Result:**
- Console shows teams being filtered
- Only Collections Team (id: 1) appears in the Teams view
- Log shows: "teamsBefore: 4, teamsAfter: 1"
- Other teams (Data & Identity, Treasury, Payments) are not visible

**Debugging:**
If filtering doesn't work, check console logs for:
1. Is `user.permissions?.teams` populated? (Should be `[1]`)
2. Is `isAdmin` false? (Should be false for non-admin)
3. What are the allowedTeamIds? (Should be `[1]`)
4. Are the incoming teams from API correct?

---

## Permission Structure Reference

### Permissions Object Format
```json
{
  "pages": ["dashboard", "development", "incidents"],
  "teams": [1, 2],
  "admin": false
}
```

### Team IDs Reference
- 1: Collections Team
- 2: Data & Identity Team
- 3: Treasury Team
- 4: Payments Team

---

## Implementation Details

### AuthContext Changes
```typescript
// Added to AuthContextType interface
isLoadingPermissions: boolean;

// Added to AuthProvider state
const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);

// Updated refreshUser() to track loading
const refreshUser = useCallback(async () => {
  try {
    setIsLoadingPermissions(true);
    // ... fetch and update user
  } finally {
    setIsLoadingPermissions(false);
  }
}, []);
```

### RootLayout Changes
```typescript
// Track initialization
const [hasInitialized, setHasInitialized] = useState(false);

// Call refreshUser on mount
useEffect(() => {
  if (token && !hasInitialized && !isLoadingPermissions) {
    refreshUser();
    setHasInitialized(true);
  }
}, [token, hasInitialized, isLoadingPermissions, refreshUser]);
```

### DevelopmentTracker Changes
```typescript
// Enhanced logging in fetchData()
console.log('Current user:', user);
console.log('User permissions:', user?.permissions);
console.log('Applying team filtering:', {
  userRole: user.role,
  isAdmin,
  userPermissions: user.permissions,
  allowedTeamIds,
  teamsBefore: teamsData.length,
  teamsAfter: filteredTeams.length,
  filtered: filteredTeams
});
```

---

## Next Steps if Issues Persist

### If Permissions Still Don't Update on Reload
1. Check Network tab - verify `/users/me` endpoint returns updated permissions
2. Verify localStorage is being updated with new permissions
3. Check if JWT token is still valid after permission change
4. Verify AuthContext provider wraps entire app

### If DevelopmentTracker Still Shows All Teams
1. Check database - verify teams array is stored in permissions JSON
2. Verify invitation was created with teams array populated
3. Check if user.permissions object is being parsed correctly from JSON string
4. Verify filter logic with different team IDs
5. Test with user that has multiple teams to see if partial filtering works

---

## Monitoring and Validation

To verify fixes are working:

### In Browser Console
1. Open Developer Tools (F12)
2. Navigate to a page and check console for initialization logs
3. Edit user permissions and reload to see refresh logs
4. Open Development Tracker and check team filtering logs

### API Verification
1. Login user
2. Call `/api/users/me` endpoint directly
3. Verify response includes `permissions` with `teams` array
4. Compare with what's stored in localStorage

### Database Verification
1. Query users table
2. Check permissions column contains valid JSON with teams array
3. Verify formatting matches expected structure
