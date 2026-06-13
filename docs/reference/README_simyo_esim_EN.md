# Simyo NL eSIM Tool - Technical Reference

> A complete eSIM device change web tool built based on the Simyo ESIM V2.postman_collection.json Postman script.

## 📁 File Description

### Main Files
- **`src/simyo/simyo_modular.html`** - Simyo eSIM Device Change Tool (Production Version, Modular Architecture)
- **`tests/test_simyo_esim.html`** - Comprehensive Test Page (Development/Test Version)

## 🔧 Technical Architecture

### Frontend Technology Stack
- **HTML5** - Semantic Structure
- **CSS3** - Responsive Design, Bootstrap 5.3.0, Simyo Brand Colors
- **JavaScript (ES6+)** - Modern JavaScript Features
- **Font Awesome 6.0.0** - Icon Library

### API Integration
- **Simyo Sessions API** - User Authentication and Session Management
- **Simyo eSIM API** - eSIM Configuration Retrieval and Management
- **QR Code Generation** - Local CDN-based generation using qrcode.js library with 3-tier fallback: Local generation → Backend Netlify Function (`/bff/qrcode-generate`) → LPA string display with usage instructions

### Key API Endpoints
```javascript
const apiEndpoints = {
    login: "https://appapi.simyo.nl/simyoapi/api/v1/sessions",
    getEsim: "https://appapi.simyo.nl/simyoapi/api/v1/esim/get-by-customer",
    confirmInstall: "https://appapi.simyo.nl/simyoapi/api/v1/esim/reorder-profile-installed"
};
```

## 💰 Number Preservation Service

Simyo offers number preservation service with details:

- **Payee**: ING BANK N.V.
- **IBAN**: `NL19INGB0007811670`
- **Amount**: 10 Euro minimum
- **Remarks**: Your Simyo number (complete number starting with 06)

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
- `generateQRCode(data)` - Generate eSIM QR code using `qrcode-generator.js` module with 3-tier fallback mechanism: local CDN generation (qrcode.js) → backend Netlify Function (`/bff/qrcode-generate`) → LPA string display with usage instructions. Eliminates dependency on external QR code services.

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
| **Number Preservation** | 10 Euro minimum | According to normal plan |

---

**Document Version:** 1.1.0
**Last Updated:** 2026-05-18
**Maintainer:** eSIM Tools Team
