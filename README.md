# 🏗️ Staging Space Request Tool

A modern web-based drawing tool for construction contractors to request staging space through Microsoft Power Platform integration. Built with Leaflet.js for geospatial drawing and designed to work seamlessly with Power Pages, Power Automate, and Power BI. Configured specifically for the Intel Ronler Acres Campus in Hillsboro, Oregon, starting at Gordon Moore Park.

## 📋 Features

- **Interactive Drawing**: Draw rectangles and polygons on a site layout map
- **Form Validation**: Comprehensive form validation with real-time feedback
- **Power Platform Integration**: Seamless integration with Power Automate and SharePoint
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Power Platform-inspired design with smooth animations
- **TopoJSON Export**: Exports drawn shapes in TopoJSON format compatible with Power BI, maintaining the original construction campus data structure
- **Email Notifications**: Automatic email confirmations and notifications

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Power Pages   │───▶│  Power Automate  │───▶│   SharePoint    │
│   (Frontend)    │    │   (Backend)      │    │   (Storage)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Leaflet.js    │    │   Email Flow     │    │   Power BI      │
│   (Drawing)     │    │   (Notifications)│    │   (Visualization)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### 1. Local Development Setup

1. **Clone or download** the project files to your local machine
2. **Open** `index.html` in a web browser
3. **Test** the drawing functionality and form validation

### 2. Power Platform Integration

#### Step 1: Create Power Automate Flow

1. **Go to** [Power Automate](https://flow.microsoft.com)
2. **Create** a new flow with HTTP trigger
3. **Import** the flow configuration from `power-automate-flow.json`
4. **Configure** the following connections:
   - SharePoint connection
   - Office 365 Outlook connection
5. **Update** the SharePoint site URL and document library paths
6. **Save** and **test** the flow

#### Step 2: Set Up SharePoint Storage

1. **Create** a SharePoint document library (if not exists)
2. **Upload** an initial `staging-requests.json` file:

```json
{
  "requests": [],
  "lastUpdated": "2024-01-01T00:00:00Z"
}
```

#### Step 3: Configure Power Pages

1. **Create** a new Power Pages site
2. **Upload** the HTML, CSS, and JS files
3. **Configure** the Power Automate webhook URL in `script.js`
4. **Set up** authentication and permissions

#### Step 4: Power BI Integration

1. **Create** a new Power BI report
2. **Connect** to the SharePoint JSON file
3. **Use** the Shape Map visual to display staging areas
4. **Configure** refresh settings

## 📁 File Structure

```
staging-space-tool/
├── index.html              # Main HTML file
├── styles.css              # CSS styling
├── script.js               # JavaScript functionality
├── power-automate-flow.json # Power Automate configuration
├── README.md               # This file
└── sample-site-layout.json # Sample site layout (optional)
```

## ⚙️ Configuration

### Map Configuration

The application is pre-configured for the Intel Ronler Acres Campus in Hillsboro, Oregon, starting at Gordon Moore Park. To customize for your site, update the map settings in `script.js`:

```javascript
const CONFIG = {
    defaultCenter: [45.5285, -122.9350], // Intel Gordon Moore Park coordinates
    defaultZoom: 20,
    powerAutomateEndpoint: 'YOUR_POWER_AUTOMATE_WEBHOOK_URL',
    siteLayoutGeoJSON: {
        // Your site layout GeoJSON data
    }
};
```

### Site Layout Setup

1. **Create** a GeoJSON file with your site layout
2. **Include** buildings, parking areas, and other relevant features
3. **Update** the `siteLayoutGeoJSON` in the configuration

Example site layout:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Main Building",
        "type": "building"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [longitude1, latitude1],
          [longitude2, latitude2],
          [longitude3, latitude3],
          [longitude1, latitude1]
        ]]
      }
    }
  ]
}
```

## 🔧 Customization

### Adding New Form Fields

1. **Add** the HTML field in `index.html`
2. **Update** the validation in `script.js`
3. **Modify** the Power Automate flow schema
4. **Update** the email templates

### Customizing the Map

1. **Change** the tile layer URL for different map styles
2. **Modify** the drawing tool colors and styles
3. **Add** custom markers or overlays
4. **Implement** additional map controls

### Styling Changes

1. **Modify** `styles.css` for visual changes
2. **Update** color scheme to match your brand
3. **Adjust** responsive breakpoints
4. **Customize** animations and transitions

## 📊 Power BI Integration

### TopoJSON Export Functionality

The application exports staging requests in **TopoJSON format** that maintains compatibility with your existing Power BI setup:

- **Preserves Original Structure**: Loads and merges with the original `construction-campus .json` file
- **Maintains Building Data**: Keeps all existing building geometries and properties intact
- **Adds Staging Requests**: Appends new staging requests as a separate "Staging Requests" object collection
- **Power BI Compatible**: Uses the same coordinate system and transform as the original file

#### Export Process

1. **Load Original**: Reads the `construction-campus .json` file
2. **Merge Data**: Adds new staging requests while preserving existing structure
3. **Download File**: Automatically downloads the merged TopoJSON file
4. **Power BI Ready**: File can be directly imported into Power BI for visualization

#### File Structure

```json
{
  "type": "Topology",
  "arcs": [...],
  "transform": {...},
  "objects": {
    "Test Split V2": {
      "type": "GeometryCollection",
      "geometries": [...]
    },
    "Staging Requests": {
      "type": "GeometryCollection", 
      "geometries": [
        {
          "type": "Polygon",
          "properties": {
            "Building ID": "REQ-1234567890-abc123",
            "Company Name": "ABC Construction",
            "Contact Name": "John Doe",
            "Project Phase": "Foundation",
            "SQ_FT": 5000,
            "Status": "Pending",
            "Request Type": "Staging Area"
          },
          "arcs": [[0]]
        }
      ]
    }
  }
}
```

### Shape Map Setup

1. **Import** the TopoJSON data source (maintains original construction campus structure)
2. **Add** a Shape Map visual
3. **Configure** the location field using TopoJSON coordinates
4. **Set up** color coding based on request status
5. **Use** the "Staging Requests" object collection for new requests

### Sample Power BI Query

```m
let
    Source = Json.Document(Web.Contents("YOUR_SHAREPOINT_TOPOJSON_URL")),
    stagingRequests = Source[objects][Staging Requests][geometries],
    #"Converted to Table" = Table.FromList(stagingRequests, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    #"Expanded Column1" = Table.ExpandRecordColumn(#"Converted to Table", "Column1", {"properties", "type", "arcs"}),
    #"Expanded properties" = Table.ExpandRecordColumn(#"Expanded Column1", "properties", {"Company Name", "Contact Name", "Project Phase", "SQ_FT", "Start Date", "End Date", "Status", "Request Type"})
in
    #"Expanded properties"
```

## 🔐 Security Considerations

### Authentication

- **Use** Microsoft Entra ID (Azure AD) authentication
- **Restrict** access to authorized users only
- **Implement** role-based permissions

### Data Protection

- **Encrypt** sensitive data in transit and at rest
- **Validate** all input data
- **Implement** rate limiting
- **Log** all access and changes

### Network Security

- **Use** HTTPS for all communications
- **Configure** CORS policies appropriately
- **Implement** API key authentication for Power Automate

## 🐛 Troubleshooting

### Common Issues

1. **Map not loading**
   - Check internet connection
   - Verify Leaflet.js CDN links
   - Check browser console for errors

2. **Drawing not working**
   - Ensure Leaflet.draw plugin is loaded
   - Check for JavaScript errors
   - Verify map initialization

3. **Power Automate errors**
   - Check webhook URL configuration
   - Verify SharePoint permissions
   - Review flow run history

4. **Power BI not updating**
   - Check data source refresh settings
   - Verify JSON file permissions
   - Test data source connection

### Debug Mode

Enable debug logging by adding this to `script.js`:

```javascript
const DEBUG = true;

function debugLog(message, data) {
    if (DEBUG) {
        console.log(`[DEBUG] ${message}`, data);
    }
}
```

## 📞 Support

For technical support or questions:

1. **Check** the troubleshooting section above
2. **Review** browser console for error messages
3. **Test** individual components separately
4. **Verify** Power Platform permissions and connections

## 🔄 Version History

- **v1.0.0** - Initial release with basic drawing and form functionality
- **v1.1.0** - Added Power Automate integration
- **v1.2.0** - Enhanced UI and responsive design
- **v1.3.0** - Added Power BI integration support

## 📄 License

This project is provided as-is for educational and commercial use. Please ensure compliance with Microsoft Power Platform terms of service.

## 🤝 Contributing

To contribute to this project:

1. **Fork** the repository
2. **Create** a feature branch
3. **Make** your changes
4. **Test** thoroughly
5. **Submit** a pull request

---

**Built with ❤️ for the construction industry**
