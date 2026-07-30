# Administrator Manual

## User Management

### Inviting Users

1. Go to Settings > User Management
2. Click "+ Invite User"
3. Enter email address
4. Select role (see Role Descriptions below)
5. User receives invitation email

### Role Descriptions

| Role | Description | Permissions |
|------|-------------|-------------|
| Super Admin | Platform-wide access | All operations |
| Company Admin | Full company management | Read, Write, Approve, Admin, Export |
| Site Admin | Site-level operations | Read, Write, Approve, Export |
| Reviewer | Review and approve records | Read, Approve, Export |
| Auditor | Audit and verify data | Read, Audit, Export |
| Viewer | Read-only access | Read only |
| Consultant | External advisor access | Read, Export |

### Deactivating Users

1. Go to Settings > User Management
2. Click "Edit Role" on the user
3. Change status to "Inactive"
4. User will be logged out on next request

## Organization Setup

### Adding Sites

1. Go to Settings > Company Profile
2. Click "Manage Sites"
3. Add site name, address, and grid region
4. Sites appear in emission record forms

### Managing Facilities

Each site can have multiple facilities:
- Boiler house
- Vehicle depot
- Electrical room
- Refrigeration unit
- Production lines
- Equipment

## Emission Factor Management

### Selecting Provider Version

1. Go to Settings > Emission Factor Version
2. Select active provider
3. Click "Apply to All Calculations"
4. Future calculations use the new version

### Custom Emission Factors

For company-specific factors:
1. Contact platform administrator
2. Provide factor documentation
3. Custom factors are added to the library

## System Configuration

### API Keys

1. Go to Settings > API Keys
2. Generate new API key
3. Set permissions and expiration
4. Use key in external integrations

### Backup Procedures

Database backups are handled by Supabase:
- Automatic daily backups (Pro plan)
- Point-in-time recovery (7 days)
- Manual backup: `npx supabase db dump > backup.sql`

### Audit Log Review

The audit log records all system changes:
1. Navigate to Audit Log
2. Filter by date, user, or table
3. Expand entries to see before/after values
4. Export for compliance documentation

## Troubleshooting

### Common Issues

- **User cannot see data**: Check role permissions and company assignment
- **Calculations seem wrong**: Verify emission factor version selection
- **Reports generation fails**: Check data completeness for the selected period
- **Login issues**: Verify email in Supabase Auth dashboard
