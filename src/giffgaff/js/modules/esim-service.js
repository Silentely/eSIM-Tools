/**
 * eSIM服务模块
 * 负责eSIM相关的所有操作
 */

import { stateManager } from './state-manager.js';
import { getApiEndpoints, graphqlQueries } from './api-config.js';
import { mfaHandler } from './mfa-handler.js';
import { t } from '../../../js/modules/i18n.js';

export class ESimService {
    constructor() {
        this.apiEndpoints = getApiEndpoints();
    }

    /**
     * 获取会员信息
     */
    async getMemberInfo() {
        try {
            const state = stateManager.getState();

            if (!state.accessToken) {
                throw new Error(t('giffgaff.esim.errors.missingAccessToken'));
            }

            if (!state.emailSignature) {
                throw new Error(t('giffgaff.esim.errors.missingMfaSignature'));
            }

            const response = await fetch(this.apiEndpoints.graphql, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accessToken: state.accessToken,
                    mfaSignature: state.emailSignature,
                    cookie: stateManager.getCookie() || undefined,
                    query: graphqlQueries.getMemberProfile,
                    operationName: 'getMemberProfileAndSim'
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(t('giffgaff.esim.errors.requestFailed', {
                    status: response.status,
                    message: errorText
                }));
            }

            const data = await response.json();

            if (data.errors) {
                const errorObj = data.errors[0];
                const errorMessage = (errorObj && errorObj.message) || (errorObj && errorObj.error) || JSON.stringify(errorObj);
                throw new Error(errorMessage);
            }

            // 保存会员信息
            stateManager.setState({
                memberId: data.data.memberProfile.id,
                memberName: data.data.memberProfile.memberName,
                phoneNumber: data.data.sim.phoneNumber
            });

            return {
                success: true,
                data: data.data,
                message: t('giffgaff.app.status.memberFetched')
            };
        } catch (error) {
            console.error(t('giffgaff.esim.log.memberFailed'), error);
            throw error;
        }
    }

    /**
     * 预订eSIM
     */
    async reserveESim() {
        try {
            const state = stateManager.getState();

            const response = await fetch(this.apiEndpoints.graphql, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accessToken: state.accessToken,
                    mfaSignature: state.emailSignature,
                    cookie: stateManager.getCookie() || undefined,
                    query: graphqlQueries.reserveESim,
                    variables: {
                        input: {
                            memberId: state.memberId,
                            userIntent: "SWITCH"
                        }
                    },
                    operationName: 'reserveESim'
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(t('giffgaff.esim.errors.requestFailed', {
                    status: response.status,
                    message: errorText
                }));
            }

            const data = await response.json();

            if (data.errors) {
                const errorObj = data.errors[0];
                const errorMessage = (errorObj && errorObj.message) || (errorObj && errorObj.error) || JSON.stringify(errorObj);
                throw new Error(errorMessage);
            }

            // 保存eSIM信息
            stateManager.setState({
                esimSSN: data.data.reserveESim.esim.ssn,
                esimActivationCode: data.data.reserveESim.esim.activationCode,
                esimDeliveryStatus: data.data.reserveESim.esim.deliveryStatus
            });

            return {
                success: true,
                data: data.data.reserveESim,
                message: t('giffgaff.app.status.reserveSuccess', {
                    status: data.data.reserveESim.esim.deliveryStatus
                })
            };
        } catch (error) {
            console.error(t('giffgaff.esim.log.reserveFailed'), error);
            throw error;
        }
    }

    /**
     * 交换SIM卡
     */
    async swapSim(activationCode, mfaSignature, mfaRef) {
        try {
            const state = stateManager.getState();
            const normalizedMfaRef = typeof mfaRef === 'string' ? mfaRef.trim() : '';
            const requestHeaders = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.accessToken}`,
                'X-MFA-Signature': mfaSignature,
                'X-CF-Turnstile': window.__cfTurnstileToken || ''
            };

            if (normalizedMfaRef) {
                requestHeaders['X-MFA-Ref'] = normalizedMfaRef;
                requestHeaders['X-MFA-Challenge-Ref'] = normalizedMfaRef;
            }

            const response = await fetch(this.apiEndpoints.graphql, {
                method: 'POST',
                headers: requestHeaders,
                body: JSON.stringify({
                    accessToken: state.accessToken,
                    mfaSignature: mfaSignature,
                    cookie: stateManager.getCookie() || undefined,
                    turnstileToken: window.__cfTurnstileToken || '',
                    operationName: "SwapSim",
                    variables: {
                        activationCode,
                        mfaSignature,
                        mfaRef: normalizedMfaRef
                    },
                    query: graphqlQueries.swapSim,
                    mfaRef: normalizedMfaRef || undefined
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(t('giffgaff.esim.errors.swapFailed', {
                    status: response.status,
                    message: errText
                }));
            }

            const swapData = await response.json();

            if (swapData.errors) {
                const errorObj = swapData.errors[0];
                const errorMessage = (errorObj && errorObj.message) || (errorObj && errorObj.error) || t('giffgaff.esim.errors.swapGeneric');
                throw new Error(errorMessage);
            }

            const newSim = swapData && swapData.data && swapData.data.swapSim && swapData.data.swapSim.new;
            if (!newSim || !newSim.ssn) {
                throw new Error(t('giffgaff.esim.errors.swapMissingSim'));
            }

            // 更新状态
            stateManager.setState({
                esimSSN: newSim.ssn,
                esimActivationCode: newSim.activationCode || state.esimActivationCode,
                esimDeliveryStatus: 'ACTIVE'
            });

            return {
                success: true,
                data: swapData.data.swapSim,
                message: t('giffgaff.esim.status.swapSuccess')
            };
        } catch (error) {
            console.error(t('giffgaff.esim.log.swapFailed'), error);
            throw error;
        }
    }

    /**
     * 获取eSIM下载Token（issue #66: 增强错误信息，附加 status code）
     */
    async getESimDownloadToken(ssn) {
        try {
            const state = stateManager.getState();

            const response = await fetch(this.apiEndpoints.graphql, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accessToken: state.accessToken,
                    mfaSignature: state.emailSignature,
                    cookie: stateManager.getCookie() || undefined,
                    query: graphqlQueries.eSimDownloadToken,
                    variables: { ssn },
                    operationName: 'eSimDownloadToken'
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                // 区分上游 401（token 过期）和业务 422（SSN 不存在）等错误，给出友好提示
                const parsed = this._tryParseError(errorText);
                const error = new Error(this._friendlyGraphqlError(response.status, parsed));
                error.status = response.status; // 附加 status code 便于上层判断
                throw error;
            }

            const data = await response.json();

            if (data.errors) {
                const errorObj = data.errors[0];
                const errorMessage = (errorObj && errorObj.message) || (errorObj && errorObj.error) || JSON.stringify(errorObj);
                throw new Error(errorMessage);
            }

            const lpaString = data.data.eSimDownloadToken.lpaString;

            return {
                success: true,
                lpaString,
                data: data.data.eSimDownloadToken,
                message: t('giffgaff.app.status.tokenFetchedSuccess')
            };
        } catch (error) {
            console.error(t('giffgaff.esim.log.downloadFailed'), error);
            throw error;
        }
    }

    /**
     * 自动激活eSIM（通过网页）
     */
    async autoActivateESim(activationCode) {
        try {
            const webCookie = stateManager.getCookie();
            if (!webCookie) {
                throw new Error(t('giffgaff.esim.errors.cookieRequired'));
            }

            const state = stateManager.getState();

            const response = await fetch(this.apiEndpoints.autoActivate, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    activationCode,
                    cookie: webCookie,
                    accessToken: state.accessToken || undefined
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(t('giffgaff.esim.errors.autoActivateFailed', {
                    status: response.status,
                    message: errorText
                }));
            }

            const result = await response.json();

            if (result.success) {
                // 更新eSIM状态
                stateManager.set('esimDeliveryStatus', 'ACTIVE');
                const needsManualConfirm =
                    Boolean(result && result.needsManualConfirm) ||
                    (typeof (result && result.message) === 'string' &&
                        (result.message.includes('手动') ||
                         result.message.toLowerCase().includes('manual')));
                return {
                    success: true,
                    needsManualConfirm,
                    message: needsManualConfirm
                        ? t('giffgaff.esim.status.autoActivateManual')
                        : t('giffgaff.esim.status.autoActivateSuccess'),
                    rawMessage: result.message
                };
            } else {
                throw new Error(result.message || t('giffgaff.esim.errors.activateGeneric'));
            }
        } catch (error) {
            console.error(t('giffgaff.esim.log.autoActivateFailed'), error);
            throw error;
        }
    }

    /**
     * 完整的短信激活流程（含 ref 失效自动恢复）
     * 当 SMS 验证码校验返回 410（ref 过期）时，自动重新发送验证码，
     * 并抛出可恢复错误让 UI 引导用户输入新验证码
     */
    async smsActivateFlow(smsCode) {
        try {
            // 1. 验证短信验证码
            let mfaResult;
            try {
                mfaResult = await this.validateMFACodeForSwap(smsCode);
            } catch (err) {
                if (err.statusCode === 410) {
                    // ref 过期：发送新 challenge，要求用户输入新验证码
                    console.warn(t('giffgaff.esim.log.refExpiredRetrying'));
                    await mfaHandler.sendSimSwapMFAChallenge();
                    const refreshErr = new Error(t('giffgaff.esim.errors.refExpired'));
                    refreshErr.code = 'REF_REFRESHED_NEEDS_NEW_CODE';
                    throw refreshErr;
                }
                // 400（验证码错误）或其他错误直接抛出
                throw err;
            }

            const swapMfaRef = (mfaResult.ref || stateManager.get('emailCodeRef') || '').trim();
            if (!swapMfaRef) {
                throw new Error(t('giffgaff.mfa.errors.missingRef'));
            }

            // 2. 预订eSIM
            const reserveResult = await this.reserveESim();

            // 3. 执行SIM交换
            const swapResult = await this.swapSim(
                reserveResult.data.esim.activationCode,
                mfaResult.signature,
                swapMfaRef
            );

            // 4. 获取LPA（轮询）
            const lpaResult = await this.waitAndGetLPA(swapResult.data.new.ssn);
            stateManager.set('lpaString', lpaResult.lpaString);

            return {
                success: true,
                message: t('giffgaff.esim.status.smsFlowComplete')
            };
        } catch (error) {
            console.error(t('giffgaff.esim.log.smsFlowFailed'), error);
            throw error;
        }
    }

    /**
     * 等待并获取LPA
     */
    async waitAndGetLPA(ssn, maxRetries = 10) {
        // 等待系统处理
        await new Promise(r => setTimeout(r, 5000));

        for (let i = 0; i < maxRetries; i++) {
            try {
                const result = await this.getESimDownloadToken(ssn);
                if (result.lpaString) {
                    return result;
                }
            } catch (error) {
                console.warn(t('giffgaff.esim.log.lpaAttemptFailed', {
                    attempt: i + 1,
                    total: maxRetries
                }), error);
            }
            await new Promise(r => setTimeout(r, 4000));
        }

        throw new Error(t('giffgaff.esim.errors.lpaTimeout'));
    }

    /**
     * 直接拉取账户上已存在的 eSIM 列表（已支付但 App 未下发的场景）
     */
    async fetchExistingESims() {
        const state = stateManager.getState();
        if (!state.accessToken) {
            throw new Error(t('giffgaff.directFetch.errors.missingToken'));
        }

        const response = await fetch(this.apiEndpoints.graphql, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accessToken: state.accessToken,
                cookie: stateManager.getCookie() || undefined,
                query: graphqlQueries.getESims,
                variables: { deliveryStatus: 'DOWNLOADABLE' },
                operationName: 'getESims'
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(t('giffgaff.directFetch.errors.generic', {
                message: `${response.status} - ${errorText}`
            }));
        }

        const data = await response.json();
        if (data.errors) {
            const errorObj = data.errors[0];
            throw new Error((errorObj && errorObj.message) || (errorObj && errorObj.error) || JSON.stringify(errorObj));
        }

        return (data && data.data && data.data.eSims) || [];
    }

    /**
     * 直取 eSIM 完整流程：拉取列表 → 选定 SSN → 获取 LPA
     * @param {string|null} preselectedSsn - 已选定的 SSN（多选场景）
     */
    async directFetchFlow(preselectedSsn = null) {
        const list = await this.fetchExistingESims();

        if (list.length === 0) {
            const err = new Error(t('giffgaff.directFetch.errors.empty'));
            err.code = 'EMPTY_LIST';
            throw err;
        }

        if (list.length > 1 && !preselectedSsn) {
            const err = new Error(t('giffgaff.directFetch.errors.multipleNeedPick'));
            err.code = 'MULTIPLE_ESIMS';
            err.candidates = list.map(e => e.ssn);
            throw err;
        }

        if (preselectedSsn && !list.some(e => e.ssn === preselectedSsn)) {
            const err = new Error(t('giffgaff.directFetch.errors.generic', { message: 'Invalid SSN selection' }));
            err.code = 'INVALID_SSN';
            throw err;
        }

        const ssn = preselectedSsn || list[0].ssn;
        const tokenResult = await this.getESimDownloadToken(ssn);

        stateManager.setState({
            esimSSN: ssn,
            esimDeliveryStatus: 'DOWNLOADABLE',
            lpaString: tokenResult.lpaString,
            directFetchMode: true
        });

        return { success: true, ssn, lpaString: tokenResult.lpaString };
    }

    /**
     * 尝试解析 JSON 格式的错误响应体
     * @param {string} text - 原始响应文本
     * @returns {Object|null} 解析后的错误对象，解析失败返回 null
     */
    _tryParseError(text) {
        try {
            const parsed = JSON.parse(text);
            // 兼容 GraphQL 错误格式 { errors: [{ message: '...' }] }
            if (parsed && typeof parsed === 'object' && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
                const firstError = parsed.errors[0] || {};
                const message = (firstError && firstError.message) || (typeof firstError === 'string' ? firstError : null);
                if (message) {
                    return { ...parsed, message };
                }
            }
            return parsed.error || parsed.message ? parsed : null;
        } catch {
            return null;
        }
    }

    /**
     * 将上游 HTTP 错误转换为用户友好的中文提示
     * @param {number} status - HTTP 状态码
     * @param {Object|null} parsed - 解析后的错误对象
     * @returns {string} 友好的错误提示
     */
    _friendlyGraphqlError(status, parsed) {
        const msg = (parsed && parsed.message) || (parsed && parsed.error) || '';

        // 401: token 过期
        if (status === 401) {
            // 后端已尝试用 cookie 刷新但仍失败，提示重新登录
            if (/AxiosError|invalid_token|unauthorized/i.test(msg)) {
                return t('giffgaff.esim.errors.tokenExpired');
            }
            return t('giffgaff.esim.errors.authFailed');
        }

        // 422: 业务校验错误（SSN 不存在等）
        if (status === 422) {
            if (/SSN.*ICCID.*not exist|SSN.*不存在/i.test(msg)) {
                return t('giffgaff.esim.errors.ssnNotFound');
            }
            return t('giffgaff.esim.errors.upstreamBusinessError', { message: msg });
        }

        // 其他错误保留原始信息
        return t('giffgaff.esim.errors.requestFailed', { status, message: msg || status });
    }

    /**
     * 为SIM交换验证MFA验证码
     */
    async validateMFACodeForSwap(code) {
        const state = stateManager.getState();
        const ref = (state.emailCodeRef || '').trim();

        if (!ref) {
            throw new Error(t('giffgaff.mfa.errors.missingRef'));
        }

        const response = await fetch(this.apiEndpoints.mfaValidation, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': state.accessToken ? `Bearer ${state.accessToken}` : undefined,
                'X-CF-Turnstile': window.__cfTurnstileToken || ''
            },
            body: JSON.stringify({
                accessToken: state.accessToken,
                cookie: stateManager.getCookie() || undefined,
                ref,
                code,
                turnstileToken: window.__cfTurnstileToken || ''
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            // 携带 statusCode 供上层 retry 逻辑判断错误类型
            const err = new Error(t('giffgaff.esim.errors.validationFailed', {
                status: response.status,
                message: errText
            }));
            err.statusCode = response.status;
            throw err;
        }

        const data = await response.json();
        const signature = data.signature || '';
        if (!signature) {
            throw new Error(t('giffgaff.mfa.errors.missingSignature'));
        }
        stateManager.set('emailSignature', signature);

        return { success: true, signature, ref };
    }
}

// 创建单例实例
export const esimService = new ESimService();
