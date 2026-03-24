# Admin Panel & Access Control Setup Guide

## Overview

This guide explains the new Admin Panel, Access Control system, and Edit Suggestions feature implemented in Cherry Directory v3.

## Features

### 1. **Comprehensive Admin Dashboard**
A centralized dashboard for managing all aspects of the application:
- **Listings Management**: Approve, reject, edit, or delete listings
- **User Management**: Manage user roles (User, Moderator, Admin)
- **Edit Suggestions**: Review and approve/reject user-suggested edits
- **Fuel Stations Management**: Toggle fuel stations active/inactive status
- **Analytics**: View key statistics and metrics

### 2. **Access Control System**
Restricts who can edit listings and other data:
- **Direct Edit**: Only the listing owner, submitter, or admin/moderator can edit listings directly
- **Suggest Edit**: Regular users can suggest edits that require admin/moderator approval
- **Audit Logging**: All admin actions are logged for transparency and accountability

### 3. **Edit Suggestions Workflow**
Users can suggest edits without having direct edit permissions:
1. User submits an edit suggestion with proposed changes
2. Admin/Moderator reviews the suggestion
3. Admin can approve (applies changes) or reject (with reason)
4. Edit history is maintained in the audit log

## Database Setup

### Run the Access Control Schema

Execute the SQL script in Supabase to set up the new tables and policies:

```sql
-- In Supabase SQL Editor, run:
-- supabase-schema-access-control.sql
```

This creates:
- `edit_suggestions` table - stores user-suggested edits
- `admin_audit_log` table - logs all admin actions
- Updated RLS policies for listings
- Helper functions for logging

## Using the Admin Dashboard

### Accessing the Admin Panel

1. Log in as an Admin or Moderator user
2. Navigate to `/admin` route
3. You'll see the comprehensive Admin Dashboard

### Managing Listings

**Approve/Reject Pending Listings:**
1. Go to "Listings" tab
2. Filter by "Pending" status
3. Click ✓ to approve or ✗ to reject
4. Action is automatically logged

**Delete Listings:**
1. Click the trash icon on any listing
2. Confirm deletion
3. Listing is permanently removed

### Managing Users

**Change User Roles:**
1. Go to "Users" tab
2. Select a user
3. Use the dropdown to change role:
   - `user` - Regular user
   - `moderator` - Can moderate content
   - `admin` - Full administrative access
4. Changes apply immediately

### Reviewing Edit Suggestions

**Approve Suggestions:**
1. Go to "Suggestions" tab
2. Review proposed changes
3. Click ✓ to approve
4. Changes are applied to the listing

**Reject Suggestions:**
1. Click ✗ to reject
2. Suggestion is marked as rejected
3. User is notified (future feature)

### Managing Fuel Stations

**Toggle Fuel Station Status:**
1. Go to "Fuel Stations" tab
2. Click the eye icon to show/hide a station
3. Status changes immediately

## Implementing Edit Suggestions in Components

### In Listing Detail Page

```jsx
import { useEditSuggestions } from '../hooks/useEditSuggestions';

function ListingDetailPage() {
  const { suggestListingEdit } = useEditSuggestions();
  const { profile } = useAuth();

  const handleSuggestEdit = async (changes) => {
    const result = await suggestListingEdit(listingId, changes, profile.id);
    if (result.success) {
      showToast('success', 'Edit suggestion submitted for review');
    }
  };

  return (
    <button onClick={() => handleSuggestEdit({ name: 'New Name' })}>
      Suggest Edit
    </button>
  );
}
```

### Checking Edit Permissions

```jsx
function EditListingPage() {
  const { profile } = useAuth();
  const listing = useListingDetail(id);

  const canEditDirectly = 
    profile.id === listing.submitted_by ||
    profile.id === listing.owner_id ||
    ['admin', 'moderator'].includes(profile.role);

  return (
    <>
      {canEditDirectly ? (
        <EditForm onSubmit={handleDirectEdit} />
      ) : (
        <SuggestEditForm onSubmit={handleSuggestEdit} />
      )}
    </>
  );
}
```

## Audit Logging

All admin actions are automatically logged in the `admin_audit_log` table:

- Listing approvals/rejections
- User role changes
- Listing deletions
- Edit suggestion approvals/rejections

### Viewing Audit Logs

```jsx
const { data: logs } = await supabase
  .from('admin_audit_log')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(100);
```

## Security Considerations

### Row Level Security (RLS)

- Edit suggestions are only visible to the suggester or admins
- Audit logs are only visible to admins/moderators
- Listings can only be updated by authorized users
- All database operations respect RLS policies

### Best Practices

1. **Regular Audits**: Review audit logs regularly for suspicious activity
2. **Role Management**: Carefully assign admin/moderator roles
3. **Approval Process**: Always review suggestions before approving
4. **User Feedback**: Notify users when their suggestions are approved/rejected

## Future Enhancements

- [ ] Email notifications for suggestion approvals/rejections
- [ ] Bulk operations (approve multiple listings at once)
- [ ] Advanced filtering and search in Admin Panel
- [ ] Custom admin roles with granular permissions
- [ ] Scheduled tasks (auto-expire old listings, etc.)
- [ ] Admin activity dashboard with charts and graphs
- [ ] User behavior analytics

## Troubleshooting

### Admin Dashboard Not Loading

1. Check that you're logged in as admin/moderator
2. Verify the `AdminDashboard` component is imported in App.jsx
3. Check browser console for errors

### Edit Suggestions Not Appearing

1. Verify `edit_suggestions` table exists in Supabase
2. Check that RLS policies are correctly set
3. Ensure user has permission to create suggestions

### Audit Logs Not Recording

1. Verify `admin_audit_log` table exists
2. Check that the `log_admin_action` function is created
3. Ensure triggers are enabled on listings table

## Support

For issues or questions, please refer to the main README.md or contact the development team.
