# Work Environment Troubleshooting Guide

## 🚨 Common Issues & Solutions

### **1. Port Already in Use (EADDRINUSE)**

**Problem:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solutions:**
```bash
# Find what's using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or use a different port
set PORT=3001
node server.js
```

### **2. File Path Issues**

**Problem:** Files not found or wrong paths

**Solutions:**
- Ensure all files are in the same directory
- Check file permissions
- Use absolute paths in deployment-config.js
- Verify file names match exactly (case-sensitive)

### **3. Node.js Not Found**

**Problem:** `'node' is not recognized as an internal or external command`

**Solutions:**
- Install Node.js from https://nodejs.org/
- Add Node.js to PATH environment variable
- Restart Command Prompt after installation
- Verify installation: `node --version`

### **4. Firewall Blocking Access**

**Problem:** Can't access application from other computers

**Solutions:**
- Open Windows Firewall
- Add inbound rule for port 3000
- Allow Node.js through firewall
- Check corporate firewall policies

### **5. Permission Denied**

**Problem:** `EACCES: permission denied`

**Solutions:**
- Run Command Prompt as Administrator
- Check file/folder permissions
- Ensure write access to project directory
- Create data/logs directories manually

### **6. CORS Issues**

**Problem:** Cross-origin requests blocked

**Solutions:**
- Update allowedOrigins in deployment-config.js
- Add your work domain to the list
- Configure corporate proxy settings
- Use relative URLs instead of absolute

### **7. Missing Dependencies**

**Problem:** Module not found errors

**Solutions:**
```bash
# Install dependencies
npm install

# Clear npm cache
npm cache clean --force

# Reinstall node_modules
rm -rf node_modules
npm install
```

### **8. Corporate Proxy Issues**

**Problem:** Can't download external resources (Leaflet, etc.)

**Solutions:**
- Configure npm proxy settings
- Use corporate proxy for external requests
- Download resources locally
- Contact IT for proxy configuration

## 🔧 Environment-Specific Fixes

### **Windows Work Environment**

1. **Path Separators:**
   ```javascript
   // Use path.join() instead of hardcoded paths
   const filePath = path.join(__dirname, 'data', 'file.json');
   ```

2. **File Permissions:**
   ```bash
   # Grant full control to project folder
   icacls "C:\path\to\project" /grant Everyone:F
   ```

3. **Service Installation:**
   ```bash
   # Install as Windows service
   npm install -g node-windows
   node-windows install
   ```

### **Corporate Network Issues**

1. **DNS Resolution:**
   ```bash
   # Check DNS
   nslookup localhost
   ipconfig /flushdns
   ```

2. **Network Connectivity:**
   ```bash
   # Test connectivity
   ping localhost
   telnet localhost 3000
   ```

3. **Proxy Configuration:**
   ```bash
   # Set npm proxy
   npm config set proxy http://proxy.company.com:8080
   npm config set https-proxy http://proxy.company.com:8080
   ```

## 📋 Pre-Deployment Checklist

### **Before Moving to Work Computer:**

- [ ] All files copied to work computer
- [ ] Node.js installed (version 18+)
- [ ] npm installed and working
- [ ] Project directory created
- [ ] File permissions set correctly
- [ ] Firewall rules configured
- [ ] Proxy settings configured (if needed)
- [ ] Environment variables set
- [ ] Required ports available
- [ ] Corporate policies reviewed

### **After Moving to Work Computer:**

- [ ] Run setup-work-environment.bat
- [ ] Test local access (http://localhost:3000)
- [ ] Test network access (http://[IP]:3000)
- [ ] Verify all functionality works
- [ ] Check admin panel access
- [ ] Test file uploads/downloads
- [ ] Verify TopoJSON export
- [ ] Test form submission
- [ ] Check error logging
- [ ] Document any issues

## 🆘 Emergency Recovery

### **If Application Won't Start:**

1. **Check logs:**
   ```bash
   # Look for error messages
   node server.js 2>&1 | tee error.log
   ```

2. **Reset environment:**
   ```bash
   # Clear all temporary files
   del /s *.tmp
   del /s *.log
   ```

3. **Restore from backup:**
   ```bash
   # If you have a backup
   xcopy backup\* . /E /Y
   ```

4. **Contact IT Support:**
   - Provide error logs
   - Describe what you were doing
   - Include system information

## 📞 Support Information

### **For Technical Issues:**
- Check this troubleshooting guide first
- Review error logs in the `logs` directory
- Test with minimal configuration
- Document exact error messages

### **For Corporate Issues:**
- Contact your IT department
- Request firewall/proxy configuration
- Ask about Node.js installation policies
- Inquire about port usage policies

### **For Application Issues:**
- Check browser console for JavaScript errors
- Verify all required files are present
- Test with different browsers
- Clear browser cache and cookies

## 🔄 Maintenance

### **Regular Tasks:**
- Monitor log files for errors
- Backup configuration data
- Update Node.js when needed
- Review security settings
- Test functionality after updates

### **Performance Monitoring:**
- Check memory usage
- Monitor CPU usage
- Review response times
- Track user activity
- Monitor file system space
