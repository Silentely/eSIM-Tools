# Simyo NL eSIM Application Tool

A complete eSIM application web tool built based on the Simyo ESIM V2.postman_collection.json Postman script.

## 🚀 Project Overview

This is a web application designed specifically for Simyo NL (Netherlands) users that allows users to apply for and manage Simyo eSIM directly through a browser, without using mobile apps or complex API tools.

### Core Features
- ✅ Simyo Account Authentication Login
- ✅ eSIM Configuration Information Retrieval
- ✅ eSIM QR Code Generation and Display
- ✅ Device Replacement Support
- ✅ Installation Confirmation Function
- ✅ Responsive Design, Mobile Device Support
- ✅ Complete Error Handling and User Experience Optimization

## 📁 File Description

### Main Files
- **`simyo_complete_esim.html`** - Complete Simyo eSIM Application Tool (Production Version)
- **`test_simyo_esim.html`** - Comprehensive Test Page (Development/Test Version)
- **`Simyo ESIM V2.postman_collection.json`** - Original Postman Script (Reference Document)
- **`simyo.html`** - Original Simplified Version (Reference)

## 🔧 Technical Architecture

### Frontend Technology Stack
- **HTML5** - Semantic Structure
- **CSS3** - Responsive Design, Bootstrap 5.3.0, Simyo Brand Colors
- **JavaScript (ES6+)** - Modern JavaScript Features
- **Font Awesome 6.0.0** - Icon Library

### API Integration
- **Simyo Sessions API** - User Authentication and Session Management
- **Simyo eSIM API** - eSIM Configuration Retrieval and Management
- **QR Code API** - QR Code Generation Service

### Key API Endpoints
```javascript
const apiEndpoints = {
    login: "https://appapi.simyo.nl/simyoapi/api/v1/sessions",
    getEsim: "https://appapi.simyo.nl/simyoapi/api/v1/esim/get-by-customer",
    confirmInstall: "https://appapi.simyo.nl/simyoapi/api/v1/esim/reorder-profile-installed",
    qrcode: "https://qrcode.show/"
};
```

## 🚦 Usage Process

### Initial Registration and eSIM Installation

#### Step 1: Account Login
1. Enter your Simyo phone number (06 prefix, 10 digits)
2. Enter your Simyo account password
3. Click "Login Account" for authentication

#### Step 2: Get eSIM Information
1. Click "Get eSIM"
2. The system will retrieve your eSIM configuration information from the Simyo server
3. Display detailed information such as activation code, status, and associated number

#### Step 3: Generate eSIM QR Code
1. Click "Generate QR Code"
2. The system will create an LPA format activation code
3. Generate a QR code for device scanning installation
4. You can copy the LPA string or download the QR code image

#### Step 4: Confirm Installation (Optional)
1. Only needed when the app cannot log in or when changing devices
2. Click "Confirm Installation" to verify eSIM status

### Device Replacement Process

This tool now supports the complete device replacement process, including verification code processing:

#### Method 1: Complete Device Replacement Using This Tool (Recommended)

1. **Login Account**
   - Login with your Simyo phone number and password

2. **Select Device Replacement**
   - After successful login, select the "Replace Device" option

3. **Complete Device Replacement Process**
   - **Step 2.1: Apply for New eSIM** - Notify the Simyo system that you want to replace your device
   - **Step 2.2: Send Verification Code (Optional)** - Execute this step if you can receive SMS
   - **Step 2.3: Confirm Verification Code** - Enter the 6-digit verification code received

4. **Get eSIM Configuration**
   - After successful verification, automatically proceed to the eSIM retrieval step
   - Generate a new QR code for the new device

5. **Install eSIM on New Device**
   - Scan the generated QR code on the new device
   - Or manually enter the LPA activation code

6. **Confirm Installation**
   - Use the "Confirm Installation" function to verify eSIM status
   - Signal will be restored quickly after successful confirmation

#### Method 2: Combined with APP Usage (Traditional Method)

1. **Apply for Device Replacement/eSIM in Simyo APP**
   - Open the official Simyo APP
   - Select "Replace Device" or "Apply for eSIM"
   - Fill in the received verification code
   - **Stay on the next interface, do not continue operating**

2. **Use This Tool to Generate QR Code**
   - Re-login to your Simyo account
   - Select "Get eSIM Directly"
   - Generate a new QR code

3. **Install eSIM on New Device**
   - Scan the generated QR code on the new device
   - Or manually enter the LPA activation code
   - Enable the installed Simyo configuration

4. **Confirm Installation (Recommended)**
   - Use the "Confirm Installation" function of this tool
   - Signal will be restored quickly after successful confirmation

#### Verification Code Acquisition Instructions

- **If you can receive SMS**: Execute step 2.1 and then immediately execute step 2.2, the verification code will be sent to your phone
- **If you cannot receive SMS**: Only execute step 2.1, then contact Simyo customer service for "verification code when replacing eSIM device"
  - Customer service may require: number, name, birthday, address, postal code
  - Please prepare this information in advance, which can be found in the Simyo APP

## 💰 Number Preservation Service

Simyo offers low-cost number preservation service with details:

- **Payee**: ING BANK N.V.
- **IBAN**: `NL19INGB0007811670`
- **Amount**: 0.01 Euro
- **Remarks**: Your Simyo number (complete number starting with 06)

## ⚠️ Important Notes

### Usage Precautions
- **Netherlands Numbers Only** - Only for Simyo NL (Netherlands) users
- **Phone Number Format** - Must be 10-digit number starting with 06
- **eSIM Device Requirements** - Ensure your device supports eSIM functionality
- **Network Connection** - Stable network connection required for API calls

### Device Replacement Special Notes
- Please follow the process strictly when replacing devices
- Do not continue operating in the APP after applying, immediately use this tool
- Non-native eSIM devices need to send `install` and `enabled` notifications

### System Requirements
- **Modern Browser** - Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **HTTPS Environment** - Due to security restrictions, some features require HTTPS
- **JavaScript Enabled** - JavaScript must be enabled to work properly

## 🧪 Testing

Use `test_simyo_esim.html` for functional testing:

### Test Categories
1. **Unit Tests** - Phone number validation, API header generation, LPA format, UI components
2. **Integration Tests** - Login process, eSIM retrieval, QR code generation, installation confirmation
3. **End-to-End Tests** - Complete process, error handling, device replacement scenarios
4. **Performance Tests** - API response time, memory usage monitoring

### Running Tests
1. Open `test_simyo_esim.html`
2. Configure mock data (optional)
3. Click "Run All Tests" or select specific test categories
4. View test results and detailed logs

## 📝 Development Instructions

### Core Component Architecture
```javascript
// Global State Management
const appState = {
    sessionToken: "",      // Simyo session token
    activationCode: "",    // eSIM activation code
    phoneNumber: "",       // User phone number
    password: "",          // User password
    currentStep: 1         // Current step
};
```

### Main Function Description
- `mockValidatePhoneNumber()` - Validate Dutch phone number format
- `createHeaders()` - Generate Simyo API request headers
- `showSection(stepNumber)` - Show specified step
- `showStatus(element, message, type)` - Show status information
- `generateQRCode(data)` - Generate eSIM QR code

### API Call Example
```javascript
// Login Simyo Account
const response = await fetch('https://appapi.simyo.nl/simyoapi/api/v1/sessions', {
    method: 'POST',
    headers: createHeaders(false),
    body: JSON.stringify({
        phoneNumber: '0613123712',
        password: 'your_password'
    })
});

// Get eSIM Information
const esimResponse = await fetch('https://appapi.simyo.nl/simyoapi/api/v1/esim/get-by-customer', {
    method: 'GET',
    headers: createHeaders(true) // Include session token
});
```

## 🔄 Differences from Giffgaff Tool

| Feature | Simyo eSIM | Giffgaff eSIM |
|------|------------|---------------|
| **Authentication Method** | Username/password login | OAuth 2.0 PKCE |
| **MFA Verification** | No additional verification | Email verification code |
| **API Complexity** | Relatively simple | GraphQL + REST |
| **Number of Steps** | 4-step process | 5-step process |
| **Device Replacement** | Dedicated process support | Through SIM swap |
| **Number Preservation** | 0.01 Euro | According to normal plan |

## 🤝 Contribution Guidelines

### Development Environment Setup
1. Clone or download project files
2. Run using local HTTP server (HTTPS recommended)
3. Configure test data and API endpoints

### Code Standards
- Use modern JavaScript syntax (ES6+)
- Follow semantic HTML structure
- Maintain CSS modularity and responsive design
- Add detailed error handling and user feedback

### Testing Requirements
- New features must include corresponding test cases
- Ensure all existing tests pass
- Performance tests to ensure reasonable response times

## 🔗 Related Resources

- [Simyo Official Website](https://www.simyo.nl/)
- [eSIM Technical Description](https://en.wikipedia.org/wiki/ESIM)
- [Dutch Mobile Number Format](https://en.wikipedia.org/wiki/Telephone_numbers_in_the_Netherlands)

## 📄 License

This project is developed based on the original Simyo Postman script for learning and personal use only. Please comply with Simyo's terms of service and API usage policy.

## 🙋‍♂️ Support

If you have questions or suggestions, please:
1. First use the test page to verify functionality
2. Check browser console error messages
3. Confirm network connection and API availability
4. Refer to Simyo official documentation

---

**Disclaimer**: This tool is developed solely for user convenience. Please ensure you understand the risks and consequences of eSIM conversion before use. The developer is not responsible for any losses caused by using this tool. Please ensure you have the right to use the related Simyo account and services.