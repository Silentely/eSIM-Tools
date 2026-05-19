# Giffgaff eSIM Tool - Technical Reference

> A complete eSIM device change web tool built based on the Giffgaff-swap-esim.json Postman script.

## 📁 File Description

### Main Files
- **`giffgaff_modular.html`** - eSIM Device Change Tool (Production Version, Modular Architecture)
- **`tests/test_giffgaff_esim.html`** - Comprehensive Test Page (Development/Test Version)
- **`Giffgaff-swap-esim.json`** - Original Postman Script (Reference Document)
- **`giffgaff.html`** - Original Simplified Version (Reference)

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
- **QR Code API** - QR Code Generation Service (Prefer `https://qrcode.show/`, alternatives: `quickchart.io` and `chart.googleapis.com`)

### Key API Endpoints
```javascript
const apiEndpoints = {
    mfaChallenge: "https://id.giffgaff.com/v4/mfa/challenge/me",
    mfaValidation: "https://id.giffgaff.com/v4/mfa/validation",
    graphql: "https://publicapi.giffgaff.com/gateway/graphql",
    qrcode: "https://qrcode.show/"
};
```

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

---

**Document Version:** 1.1.0
**Last Updated:** 2026-05-18
**Maintainer:** eSIM Tools Team
