# 🛠️ Admin Panel Documentation

## Overview

The Admin Panel provides comprehensive management capabilities for the Staging Space Request Tool. It allows administrators to manage campuses, contractors, view activity logs, and configure system settings.

## Access

- **URL**: `http://localhost:3000/admin.html`
- **Access**: Click the "Admin Panel" link in the top-right corner of the main application
- **Authentication**: Currently uses localStorage (in production, integrate with Microsoft Entra ID)

## Features

### 📊 Dashboard
- **Real-time Statistics**: Total requests, active campuses, contractors, and total area
- **Visual Charts**: Monthly staging request trends using Chart.js
- **Quick Overview**: Key metrics at a glance

### 🏢 Campus Management
- **Add/Edit Campuses**: Create new campuses with coordinates and zoom levels
- **Coordinate Management**: Set precise latitude/longitude for map navigation
- **Zoom Control**: Configure appropriate zoom levels for each campus
- **Status Control**: Activate/deactivate campuses
- **Export Data**: Download campus data as CSV

**Default Campuses:**
- **Ronler Acres**: 45.5442515697061, -122.91389689455964 (Zoom: 16)
- **Aloha**: 45.493682619637106, -122.88441018345922 (Zoom: 16)
- **Houston**: 37.37607986263847, -121.97491259987373 (Zoom: 16)

### 👥 Contractor Management
- **Add/Edit Contractors**: Manage company information
- **Contact Details**: Store contact person, email, and phone
- **Status Control**: Activate/deactivate contractors
- **Export Data**: Download contractor data as CSV

**Default Contractors:**
- BuildRight Inc.
- Quality Builders
- XYZ Contractors

### 📋 Activity Log
- **Comprehensive Tracking**: All system activities and user actions
- **Filtering Options**: Filter by activity type and date range
- **Detailed Information**: User, action, details, and timestamps
- **Export Capability**: Download activity logs as CSV

**Activity Types:**
- **Staging Requests**: User-submitted staging area requests
- **Admin Changes**: Campus/contractor additions, updates, deletions
- **System Events**: Settings changes, data backups

### ⚙️ System Settings
- **Default Campus**: Set the default campus for new users
- **Maximum Staging Area**: Configure size limits (default: 100,000 sq ft)
- **Approval Workflow**: Enable/disable request approval requirements
- **Email Notifications**: Configure admin email and notification preferences
- **Data Management**: Backup and cleanup functions

## Data Storage

### Local Storage Structure
```javascript
// Campuses
localStorage.setItem('admin_campuses', JSON.stringify(campuses));

// Contractors
localStorage.setItem('admin_contractors', JSON.stringify(contractors));

// Activity Log
localStorage.setItem('admin_activity_log', JSON.stringify(activityLog));

// Settings
localStorage.setItem('admin_settings', JSON.stringify(settings));
```

### Data Integration
The admin panel automatically integrates with the main application:
- **Campus Updates**: Changes immediately reflect in the main tool
- **Contractor Updates**: Dropdown automatically updates with new contractors
- **Activity Logging**: All user actions are logged for admin review

## Power Platform Integration

### Current Implementation
- **Local Storage**: Data stored in browser localStorage
- **File Downloads**: CSV exports for external analysis
- **JSON Backups**: Complete system backups

### Production Deployment
When deploying to Power Pages, integrate with:

1. **Dataverse Tables**:
   ```sql
   -- Campuses Table
   CREATE TABLE Campuses (
       CampusId UNIQUEIDENTIFIER PRIMARY KEY,
       Name NVARCHAR(255),
       Latitude DECIMAL(10,8),
       Longitude DECIMAL(11,8),
       ZoomLevel INT,
       Status NVARCHAR(50)
   );

   -- Contractors Table
   CREATE TABLE Contractors (
       ContractorId UNIQUEIDENTIFIER PRIMARY KEY,
       CompanyName NVARCHAR(255),
       ContactPerson NVARCHAR(255),
       Email NVARCHAR(255),
       Phone NVARCHAR(50),
       Status NVARCHAR(50)
   );

   -- Activity Log Table
   CREATE TABLE ActivityLog (
       ActivityId UNIQUEIDENTIFIER PRIMARY KEY,
       Timestamp DATETIME2,
       Action NVARCHAR(255),
       User NVARCHAR(255),
       Details NVARCHAR(MAX),
       Status NVARCHAR(50)
   );
   ```

2. **Power Automate Flows**:
   - Campus/Contractor CRUD operations
   - Activity logging
   - Email notifications
   - Data synchronization

3. **Power BI Integration**:
   - Real-time dashboard updates
   - Activity analytics
   - Request tracking

## Security Considerations

### Current (Development)
- No authentication required
- Data stored in browser localStorage
- Suitable for testing and development

### Production Requirements
- **Microsoft Entra ID Integration**: User authentication and authorization
- **Role-based Access**: Admin vs. User permissions
- **Data Encryption**: Secure storage in Dataverse
- **Audit Logging**: Comprehensive activity tracking
- **Backup Procedures**: Regular data backups

## Usage Examples

### Adding a New Campus
1. Navigate to "Campuses" tab
2. Click "Add Campus"
3. Fill in:
   - Campus Name: "New Campus"
   - Latitude: 45.12345678
   - Longitude: -122.87654321
   - Zoom Level: 16
   - Status: Active
4. Click "Add Campus"

### Managing Contractors
1. Navigate to "Contractors" tab
2. Click "Add Contractor"
3. Fill in company details
4. Set status to "Active"
5. Save changes

### Viewing Activity
1. Navigate to "Activity Log" tab
2. Use filters to find specific activities
3. Export data if needed
4. Monitor user activity patterns

### System Configuration
1. Navigate to "Settings" tab
2. Configure default campus
3. Set maximum staging area
4. Configure email notifications
5. Save settings

## Troubleshooting

### Common Issues

**Data Not Syncing**
- Check localStorage in browser dev tools
- Verify admin panel is saving data correctly
- Refresh main application after admin changes

**Charts Not Loading**
- Ensure Chart.js is loaded
- Check browser console for errors
- Verify data exists in activity log

**Export Issues**
- Check browser download settings
- Ensure sufficient data exists
- Verify file permissions

### Debug Information
- Open browser developer tools
- Check Console for error messages
- Verify localStorage data structure
- Test individual functions

## Future Enhancements

### Planned Features
- **User Management**: Add/remove users and assign roles
- **Advanced Analytics**: Detailed reporting and insights
- **Workflow Management**: Custom approval processes
- **Integration APIs**: Connect with external systems
- **Mobile Support**: Responsive admin interface

### Power Platform Integration
- **Dataverse Integration**: Replace localStorage with Dataverse
- **Power Automate**: Automated workflows and notifications
- **Power BI**: Advanced analytics and reporting
- **Power Apps**: Custom admin interface
- **SharePoint**: Document management integration

## Support

For technical support or questions about the admin panel:
1. Check this documentation
2. Review browser console for errors
3. Verify data integrity in localStorage
4. Test with default data
5. Contact development team

---

**Note**: This admin panel is designed to work seamlessly with the Staging Space Request Tool and provides comprehensive management capabilities for production deployment in Microsoft Power Platform environments.
