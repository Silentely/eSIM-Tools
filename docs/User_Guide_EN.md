# Giffgaff User Guide

> 🌐 [中文版](./User_Guide.md)

## 1. Open Giffgaff eSIM Replacement Web Page

Visit the eSIM Tools website and select the Giffgaff eSIM tool.

## 2. Select Login Method

Choose OAuth or Cookies login method (OAuth method is recommended)

![Select Login Method](image/101.jpg)

### OAuth Login

OAuth method requires obtaining the callback URL. For instructions on how to get it, please refer to the page instructions:

![Get Callback URL Instructions](image/102.jpg)

1. First, open the login page for the giffgaff website on a new tab: `https://www.giffgaff.com` and log in.
2. After logging in, switch back to the **eSIM-Tools page** (i.e., this page) and open the browser developer tools: press F12 or right-click and select “Inspect” to switch to the “Console” tab.
3. Click the “Start OAuth Login” button at the bottom; once the new window opens, switch back to this page (the eSIM-Tools page).
4. Look for the error message in the console: “Failed to launch ‘giffgaff://auth/callback/…’”. Copy the callback URL from that line.

![Get Callback URL](image/103.jpg)

5. Enter the obtained callback URL into the corresponding input box on this page and click “Process Callback”

![Enter Callback URL](image/104.jpg)

## 3. MFA Authentication

After processing the callback, you will be automatically redirected to the second step, select email/SMS verification code method to obtain MFA authentication:

![MFA Authentication](image/105.jpg)

Enter the obtained verification code and click "Verify":

![Enter Verification Code](image/106.jpg)

## 4. Get Member Information

After successful verification, you will be automatically redirected to the third step, the get Giffgaff member information page:

![Get Member Information](image/107.jpg)

Click "Get Member Information" to go to the fourth step of converting/activating eSIM:

![Convert/Activate eSIM](image/114.jpg)

## 5. Select and Activate eSIM

Step 4 offers three activation methods. Choose the one that fits your situation:

### Method 1: SMS Verification Code Activation (Recommended)

Select SMS verification code activation and enter the SMS verification code, the system will automatically complete the eSIM replacement and generate QR code and LPA information:

![Verification Code Page](image/115.jpg)

### Method 2: Fetch eSIM Directly (For New-Purchase Users)

> ⚠️ This feature could not be fully tested by the author due to eligibility constraints. If you encounter issues, please open the browser console (F12 → Console), copy the full log, and submit it via [GitHub Issues](https://github.com/Silentely/eSIM-Tools/issues).

If you have already paid £10 in the official Giffgaff app but did not receive an eSIM, use this method:
1. Click the "Fetch eSIM directly" card
2. Click the "Fetch my eSIM" button
3. The system will fetch the existing eSIM on your account and generate a QR code
4. If multiple downloadable eSIMs are found on your account, a selection list will appear — pick the one you need and click confirm

This method requires no SMS verification code and skips the `reserveESim` / `swapSim` flow — it directly retrieves the QR code.

### Method 3: Manual Activation (Paused)

Manual activation has been paused by Giffgaff. Please use one of the methods above.

After successful exchange, you will be redirected to the fifth step showing QR code and LPA information:

![eSIM Information](image/116.jpg)
![eSIM Information 1](image/117.jpg)

## 6. Use Native eSIM Phone to Complete Scanning

1. Open your phone's **Settings** → **Cellular** / **Mobile Network**
2. Select **Add eSIM** / **Scan QR Code**
3. Scan the QR code displayed on the page
4. Confirm installation and wait for eSIM activation to complete
5. Once activated, you will see the new number in your cellular network settings

---

## Appendix: Video Tutorial

> ⚠️ The video tutorial has not been updated. For information on how to obtain the OAuth callback URL, please refer to the text tutorial above.

<video controls preload="metadata" width="100%" style="max-width: 800px; height: auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
  <source src="https://github.com/user-attachments/assets/306dacb4-0a06-4930-bf35-3711d0f63720" type="video/mp4">
  Your browser does not support video playback. Please <a href="https://github.com/user-attachments/assets/306dacb4-0a06-4930-bf35-3711d0f63720">download the video</a> to watch it locally.
</video>

[giffgaff.webm](https://github.com/user-attachments/assets/d4fbd0ff-b8bc-4477-a0c4-45698fe4802c)
