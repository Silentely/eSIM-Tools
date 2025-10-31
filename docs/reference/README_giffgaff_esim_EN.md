# Giffgaff eSIM Application Tool
> QR code provider: Prefer `https://qrcode.show/`, and keep `quickchart.io` and `chart.googleapis.com` as alternatives.
A complete eSIM application web tool built based on the Giffgaff-swap-esim.json Postman script.

## 🚀 Project Overview

This is a complete web application that allows users to apply for and obtain Giffgaff eSIM directly through a browser, without using mobile apps or complex API tools.

### Core Features
- ✅ OAuth 2.0 PKCE Authentication Process
- ✅ Email Verification Code (MFA) Verification
- ✅ GraphQL API Full Integration
- ✅ eSIM Reservation and Manual Activation Guidance
- ✅ eSIM Download Code Generation and QR Code Display
- ✅ Responsive Design, Mobile Device Support
- ✅ Complete Error Handling and User Experience Optimization

## 📁 File Description

### Main Files
- **`giffgaff_complete_esim.html`** - Complete eSIM Application Tool (Production Version)
- **`test_giffgaff_esim.html`** - Comprehensive Test Page (Development/Test Version)
- **`Giffgaff-swap-esim.json`** - Original Postman Script (Reference Document)
- **`giffgaff.html`**** - Original Simplified Version (Reference)

### Reference Files
- **`simyo.html`** - Simyo eSIM Tool (Other Operator Reference)
- **`Simyo ESIM V2.postman_collection.json`** - Simyo API Script

## 🔧 Technical Architecture

### Frontend Technology Stack
- **HTML5** - Semantic Structure
- **CSS3** - Responsive Design, Bootstrap 5.3.0
- **JavaScript (ES6+)** - Modern JavaScript Features
- **Font Awesome 6.0.0** - Icon Library

### API Integration
- **OAuth 2.0 PKCE** - Secure Authentication Process
- **Giffgaff ID API** - User Authentication and MFA
- **Giffgaff GraphQL API** - Business Logic Processing
- **QR Code API** - QR Code Generation Service

### Key API Endpoints
```javascript
const apiEndpoints = {
    mfaChallenge: "https://id.giffgaff.com/v4/mfa/challenge/me",
    mfaValidation: "https://id.giffgaff.com/v4/mfa/validation", 
    graphql: "https://publicapi.giffgaff.com/gateway/graphql",
    qrcode: "https://qrcode.show/"
};
```

## 🚦 Usage Process

### Step 1: OAuth Login
1. Click "Start OAuth Login"
2. Complete Giffgaff account login on the pop-up page
3. Copy the callback URL and paste it into the input box
4. Click "Process Callback" to get the access token

### Step 2: Email Verification
1. Click "Send Email Verification Code"
2. Check your email for the 6-digit verification code
3. Enter the verification code and click "Verify Email Verification Code"

### Step 3: Get Member Information
1. Click "Get Member Information"
2. The system will display your Giffgaff account details

### Step 4: Apply for eSIM
1. Click "Reserve eSIM" to get a new eSIM (status: RESERVED)
2. **Important: Keep the page open, do not close or refresh**
3. Copy the displayed activation code
4. Go to [Giffgaff Activation Page](https://www.giffgaff.com/activate) to manually activate the eSIM
5. On the activation page, enter the activation code and click "Activate your SIM"
6. Verify the information is correct and click "Yes, I want to replace my SIM"
7. After successful activation, return to this tool and click "I have completed manual activation, continue to next step"

### Step 5: Get QR Code
1. Click "Get eSIM Token"
2. The system will generate the LPA string and QR code
3. Save the QR code image or copy the LPA string to an eSIM-enabled device

## ⚠️ Important Notes

### Security Warning
- **Physical SIM Card Will Be Invalid** - After performing SIM swap, the original physical SIM card will no longer work
- **Save Information Immediately** - eSIM information cannot be retrieved again after the page is closed
- **Personal Use Only** - Do not share your OAuth token or eSIM information

### System Requirements
- **Modern Browser** - Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **HTTPS Environment** - Due to security restrictions, some features require HTTPS
- **JavaScript Enabled** - JavaScript must be enabled to work properly

### Compatibility
- ✅ Desktop (Windows, macOS, Linux)
- ✅ Mobile (iOS, Android)
- ✅ Tablet Devices
- ⚠️ Some older browsers may not be supported

## 🧪 Testing

Use `test_giffgaff_esim.html` for functional testing:

### Test Categories
1. **Unit Tests** - OAuth functions, URL parsing, state management, UI components
2. **Integration Tests** - OAuth process, MFA verification, GraphQL API, eSIM processing
3. **End-to-End Tests** - Complete process, error handling, responsive design
4. **Performance Tests** - API response time, memory usage monitoring

### Running Tests
1. Open `test_giffgaff_esim.html`
2. Configure mock data (optional)
3. Click "Run All Tests" or select specific test categories
4. View test results and detailed logs

## 📝 Development Instructions

### Core Component Architecture
```javascript
// Global State Management
const appState = {
    accessToken: "",      // OAuth access token
    codeVerifier: "",     // PKCE code verifier
    emailCodeRef: "",     // Email verification reference
    emailSignature: "",   // MFA signature
    memberId: "",         // Member ID
    esimSSN: "",         // eSIM serial number
    lpaString: "",        // LPA download string
    currentStep: 1        // Current step
};
```

### Main Function Description
- `generateCodeVerifier()` - Generate PKCE code verifier
- `generateCodeChallenge()` - Generate PKCE code challenge
- `showSection(stepNumber)` - Show specified step
- `showStatus(element, message, type)` - Show status information
- `generateQRCode(data)` - Generate QR code

### GraphQL Query Example
```graphql
# Get Member Information
query getMemberProfileAndSim {
    memberProfile {
        id
        memberName
        __typename
    }
    sim {
        phoneNumber
        status
        __typename
    }
}

# Reserve eSIM
mutation reserveESim($input: ESimReservationInput!) {
    reserveESim: reserveESim(input: $input) {
        id
        esim {
            ssn
            activationCode
            __typename
        }
        __typename
    }
}
```

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

## 📄 License

This project is developed based on the original Postman script for learning and personal use only. Please comply with Giffgaff's terms of service and API usage policy.

## 🙋‍♂️ Support

If you have questions or suggestions, please:
1. First use the test page to verify functionality
2. Check browser console error messages
3. Confirm network connection and API availability
4. Refer to Giffgaff official documentation

---

**Disclaimer**: This tool is developed solely for user convenience. Please ensure you understand the risks and consequences of eSIM conversion before use. The developer is not responsible for any losses caused by using this tool.