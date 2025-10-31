/**
 * API配置模块
 * 定义所有API端点和OAuth配置
 */

import { isNetlifyEnvironment } from './utils.js';

/**
 * OAuth 2.0 PKCE配置
 */
export const oauthConfig = {
    clientId: "4a05bf219b3985647d9b9a3ba610a9ce",
    redirectUri: "giffgaff://auth/callback/",
    authUrl: "https://id.giffgaff.com/oauth/authorize",
    tokenUrl: "/bff/giffgaff-token-exchange",
    scope: "read"
};

/**
 * API端点配置
 */
export function getApiEndpoints() {
    const isNetlify = isNetlifyEnvironment();
    
    return {
        mfaChallenge: isNetlify 
            ? "/bff/giffgaff-mfa-challenge" 
            : "https://id.giffgaff.com/v4/mfa/challenge/me",
        mfaValidation: isNetlify 
            ? "/bff/giffgaff-mfa-validation" 
            : "https://id.giffgaff.com/v4/mfa/validation",
        graphql: isNetlify 
            ? "/bff/giffgaff-graphql" 
            : "https://publicapi.giffgaff.com/gateway/graphql",
        cookieVerify: "/bff/verify-cookie",
        autoActivate: "/bff/auto-activate-esim",
        smsActivate: "/bff/giffgaff-sms-activate",
        qrcode: "https://qrcode.show/"
    };
}

/**
 * GraphQL查询定义
 */
export const graphqlQueries = {
    getMemberProfile: `query getMemberProfileAndSim {
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
    }`,
    
    reserveESim: `mutation reserveESim($input: ESimReservationInput!) {
        reserveESim: reserveESim(input: $input) {
            id
            memberId
            reservationStartDate
            reservationEndDate
            status
            esim {
                ssn
                activationCode
                deliveryStatus
                associatedMemberId
                __typename
            }
            __typename
        }
    }`,
    
    eSimDownloadToken: `query eSimDownloadToken($ssn: String!) {
        eSimDownloadToken(ssn: $ssn) {
            id
            host
            matchingId
            lpaString
            __typename
        }
    }`,
    
    simSwapMfaChallenge: `mutation simSwapMfaChallenge {
        simSwapMfaChallenge {
            ref
            methods {
                value
                channel
                __typename
            }
            __typename
        }
    }`,
    
    swapSim: `mutation SwapSim($activationCode: String!, $mfaSignature: String!, $mfaRef: String!) {
        swapSim(activationCode: $activationCode, mfaSignature: $mfaSignature, mfaRef: $mfaRef) {
            old {
                ssn
                activationCode
                __typename
            }
            new {
                ssn
                activationCode
                __typename
            }
            __typename
        }
    }`
};