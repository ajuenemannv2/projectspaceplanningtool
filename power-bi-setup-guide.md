# 📊 Power BI Setup Guide

This guide will help you set up Power BI to visualize staging space requests from your construction site tool.

## 🎯 Overview

Power BI will connect to the JSON file stored in SharePoint and create visualizations showing:
- Current staging space requests
- Request status and timeline
- Spatial distribution of requests
- Company and project phase breakdowns

## 📋 Prerequisites

- Power BI Desktop installed
- Access to SharePoint site where JSON file is stored
- Basic understanding of Power BI interface

## 🚀 Step-by-Step Setup

### Step 1: Create New Power BI Report

1. **Open** Power BI Desktop
2. **Click** "Get data" from the Home ribbon
3. **Select** "Web" from the data sources
4. **Enter** your SharePoint JSON file URL:
   ```
   https://your-tenant.sharepoint.com/sites/your-site/_api/web/GetFileByServerRelativeUrl('/sites/your-site/Shared%20Documents/staging-requests.json')/$value
   ```
5. **Click** "OK"

### Step 2: Transform the Data

1. **In** Power Query Editor, you'll see the raw JSON
2. **Click** the expand button next to "requests" column
3. **Select** all columns and click "OK"
4. **Rename** columns for clarity:
   - `companyName` → "Company"
   - `contactName` → "Contact"
   - `projectPhase` → "Project Phase"
   - `requestedArea` → "Area (sq ft)"
   - `startDate` → "Start Date"
   - `endDate` → "End Date"
   - `submittedAt` → "Submitted"

### Step 3: Add Shape Map Visual

1. **Click** "Shape Map" from the Visualizations pane
2. **Drag** the following fields:
   - **Location**: Create a calculated column for coordinates
   - **Color saturation**: "Area (sq ft)"
   - **Tooltip**: "Company", "Project Phase", "Area (sq ft)"

### Step 4: Create Calculated Columns

#### Coordinates Column
```m
Coordinates = 
VAR lat = [geometry.coordinates.1]
VAR lng = [geometry.coordinates.0]
RETURN lat & "," & lng
```

#### Status Column
```m
Status = 
VAR startDate = [Start Date]
VAR endDate = [End Date]
VAR today = TODAY()
RETURN
SWITCH(
    TRUE(),
    today < startDate, "Pending",
    today >= startDate && today <= endDate, "Active",
    today > endDate, "Completed",
    "Unknown"
)
```

#### Duration Column
```m
Duration (Days) = 
VAR startDate = [Start Date]
VAR endDate = [End Date]
RETURN DATEDIFF(startDate, endDate, DAY)
```

### Step 5: Create Additional Visualizations

#### 1. Request Timeline
- **Visual**: Line chart
- **Axis**: Submitted (date)
- **Values**: Count of requests
- **Legend**: Project Phase

#### 2. Company Breakdown
- **Visual**: Pie chart
- **Values**: Count of requests
- **Legend**: Company

#### 3. Area Distribution
- **Visual**: Bar chart
- **Axis**: Project Phase
- **Values**: Sum of Area (sq ft)

#### 4. Status Summary
- **Visual**: Card
- **Fields**: 
  - Total Requests
  - Active Requests
  - Total Area Requested

### Step 6: Create Dashboard Layout

Arrange your visualizations in a logical order:

```
┌─────────────────┬─────────────────┬─────────────────┐
│   Status Cards  │   Shape Map     │   Timeline      │
├─────────────────┼─────────────────┼─────────────────┤
│ Company Chart   │ Area Chart      │ Filters Panel   │
└─────────────────┴─────────────────┴─────────────────┘
```

## 🎨 Customization Options

### Color Schemes

1. **Go to** View → Themes
2. **Select** or create a custom theme
3. **Use** construction-appropriate colors:
   - Blue: Pending requests
   - Green: Active requests
   - Red: Completed requests
   - Orange: Overdue requests

### Conditional Formatting

1. **Select** a visualization
2. **Go to** Format pane
3. **Enable** conditional formatting
4. **Set** rules based on:
   - Request status
   - Area size
   - Project phase

### Tooltips

1. **Select** a visualization
2. **Go to** Format → Tooltip
3. **Add** custom tooltip with:
   - Company name
   - Contact information
   - Request details
   - Duration

## 🔄 Data Refresh Setup

### Automatic Refresh

1. **Publish** report to Power BI Service
2. **Go to** Settings → Data source credentials
3. **Configure** refresh schedule:
   - **Frequency**: Every 15 minutes
   - **Time zone**: Your local timezone
   - **Days**: Monday-Friday

### Manual Refresh

1. **Click** "Refresh" in Power BI Desktop
2. **Or** use "Refresh all" for all data sources

## 📱 Mobile Optimization

### Responsive Design

1. **Go to** View → Mobile layout
2. **Arrange** visualizations for mobile screens
3. **Test** on different device sizes
4. **Optimize** text sizes and spacing

### Mobile App

1. **Download** Power BI mobile app
2. **Sign in** with your account
3. **Access** your published report
4. **Enable** offline viewing if needed

## 🔐 Security Considerations

### Row-Level Security (RLS)

1. **Go to** Modeling → Manage roles
2. **Create** roles based on:
   - Company access
   - Project phase access
   - Geographic regions

### Data Privacy

1. **Go to** File → Options → Privacy
2. **Set** privacy levels for data sources
3. **Configure** data classification

## 📊 Advanced Features

### Drill-Through Reports

1. **Create** detailed report pages
2. **Set up** drill-through relationships
3. **Configure** drill-through filters

### Bookmarks

1. **Create** bookmarks for different views
2. **Set up** bookmark navigation
3. **Use** for different user roles

### Q&A Feature

1. **Enable** Q&A in Power BI Service
2. **Train** the Q&A engine
3. **Test** natural language queries

## 🐛 Troubleshooting

### Common Issues

1. **Data not loading**
   - Check SharePoint permissions
   - Verify JSON file format
   - Test URL accessibility

2. **Shape map not working**
   - Verify coordinate format
   - Check for valid GeoJSON
   - Ensure proper data types

3. **Refresh errors**
   - Check data source credentials
   - Verify network connectivity
   - Review error logs

### Performance Optimization

1. **Remove** unnecessary columns
2. **Use** calculated columns sparingly
3. **Optimize** data model relationships
4. **Enable** incremental refresh if possible

## 📈 Sample Queries

### DAX Measures

```dax
// Total Requests
Total Requests = COUNTROWS('Staging Requests')

// Active Requests
Active Requests = 
CALCULATE(
    COUNTROWS('Staging Requests'),
    'Staging Requests'[Status] = "Active"
)

// Average Request Size
Average Area = AVERAGE('Staging Requests'[Area (sq ft)])

// Requests by Phase
Requests by Phase = 
CALCULATE(
    COUNTROWS('Staging Requests'),
    ALLEXCEPT('Staging Requests', 'Staging Requests'[Project Phase])
)
```

### Power Query Transformations

```m
// Extract coordinates from geometry
let
    Source = Json.Document(Web.Contents("YOUR_JSON_URL")),
    requests = Source[requests],
    #"Converted to Table" = Table.FromList(requests, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    #"Expanded Column1" = Table.ExpandRecordColumn(#"Converted to Table", "Column1", {"companyName", "projectPhase", "requestedArea", "geometry", "submittedAt"}),
    #"Added Custom" = Table.AddColumn(#"Expanded Column1", "Coordinates", each [geometry][coordinates][0] & "," & [geometry][coordinates][1])
in
    #"Added Custom"
```

## 📞 Support Resources

- [Power BI Documentation](https://docs.microsoft.com/en-us/power-bi/)
- [Power BI Community](https://community.powerbi.com/)
- [Shape Map Visual Documentation](https://docs.microsoft.com/en-us/power-bi/visuals/power-bi-map-tips-and-tricks)

---

**Need help?** Check the troubleshooting section or contact your Power BI administrator.
