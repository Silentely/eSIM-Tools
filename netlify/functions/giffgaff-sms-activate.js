/**
 * Netlify Function: Giffgaff SMS Activate (end-to-end)
 * 输入短信验证码后,后台自动完成：MFA校验 → 预订eSIM（如需）→ 网页激活 → 轮询获取LPA
 */

const axios = require('axios');
const { withAuth, validateInput, AuthError } = require('./_shared/middleware');

// 输入验证schema
const smsActivateSchema = {
  ref: {
    required: true,
    type: 'string',
    minLength: 10
  },
  code: {
    required: true,
    type: 'string',
    minLength: 4,
    maxLength: 10
  }
};

exports.handler = withAuth(async (event, context, { auth, body }) => {
  // 输入验证
  validateInput(smsActivateSchema, body);

  const {
    ref,
    code,
    accessToken,
    cookie,
    memberId,
    ssn,
    activationCode
  } = body;

  // 站点URL用于内部调用其他函数
  const lower = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [String(k).toLowerCase(), v]));
  const host = lower['x-forwarded-host'] || lower['host'] || '';
  const proto = lower['x-forwarded-proto'] || 'https';
  const baseUrl = host ? `${proto}://${host}` : String(process.env.URL || '').replace(/\/$/, '');

  // 统一创建 GraphQL 客户端
  const createGraphql = (token, extraHeaders = {}) => (body) => axios.post(
    'https://publicapi.giffgaff.com/gateway/graphql',
    { ...body, mfaRef: ref },
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': token ? `Bearer ${token}` : undefined,
        'Origin': 'https://www.giffgaff.com',
        'Referer': 'https://www.giffgaff.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'x-gg-app-os': process.env.GG_APP_OS || 'iOS',
        'x-gg-app-os-version': process.env.GG_APP_OS_VERSION || '18.2',
        'x-gg-app-build-number': process.env.GG_APP_BUILD_NUMBER || '1321',
        'x-gg-app-device-manufacturer': process.env.GG_APP_DEVICE_MANUFACTURER || 'Apple',
        'x-gg-app-device-model': process.env.GG_APP_DEVICE_MODEL || 'iPhone SE',
        ...extraHeaders
      },
      timeout: 30000
    }
  );

  // 1) 获取 CSRF Token
  let csrfToken = null;
  if (cookie) {
    try {
      const csrfResp = await axios.get('https://id.giffgaff.com/auth/csrf', {
        headers: {
          'Accept': 'application/json',
          'Cookie': cookie,
          'User-Agent': 'giffgaff/1321 CFNetwork/1568.300.101 Darwin/24.2.0'
        },
        timeout: 15000
      });
      csrfToken = csrfResp.data?.token || null;
    } catch (e) {
      // CSRF获取失败不中断流程
    }
  }

  // 2) 校验短信验证码,获取签名
  const buildV4Headers = (token, ck) => ({
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'giffgaff/1321 CFNetwork/1568.300.101 Darwin/24.2.0',
    'Origin': 'https://www.giffgaff.com',
    'Referer': 'https://www.giffgaff.com/',
    ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(ck ? { 'Cookie': ck } : {})
  });

  // 从 cookie 中提取 XSRF-TOKEN
  let xxsrf = null;
  if (cookie) {
    const m = String(cookie).match(/XSRF-TOKEN=([^;]+)/);
    if (m) xxsrf = decodeURIComponent(m[1]);
  }

  const buildV3Headers = (ck) => ({
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0',
    'Origin': 'https://id.giffgaff.com',
    'Referer': 'https://id.giffgaff.com/auth/login/challenge',
    'Device': 'web',
    ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    ...(xxsrf ? { 'x-xsrf-token': xxsrf } : {}),
    ...(ck ? { 'Cookie': ck } : {})
  });

  let validationResp;
  try {
    validationResp = await axios.post(
      'https://id.giffgaff.com/v4/mfa/validation',
      { ref, code },
      { headers: buildV4Headers(accessToken, cookie), timeout: 30000 }
    );
  } catch (err) {
    const status = err.response?.status;
    const detail = err.response?.data;
    const tokenExpired = status === 401;

    if (tokenExpired && cookie) {
      try {
        // 回退到 Web v3 验证
        validationResp = await axios.post(
          'https://id.giffgaff.com/auth/v3/mfa/validation',
          { ref, code },
          { headers: buildV3Headers(cookie), timeout: 30000 }
        );
      } catch (err2) {
        const s2 = err2.response?.status || 500;
        throw new AuthError('MFA Validation Failed', s2);
      }
    } else {
      const s = status || 500;
      throw new AuthError('MFA Validation Failed', s);
    }
  }

  const mfaSignature = validationResp.data?.signature;
  if (!mfaSignature) {
    throw new AuthError('未获取到MFA签名', 500);
  }

  // 3) 若无 ssn/activationCode,则获取 memberId → 预订 eSIM
  let currentMemberId = memberId || null;
  let currentSSN = ssn || null;
  let currentActivationCode = activationCode || null;

  const gql = createGraphql(accessToken);

  if (!currentMemberId) {
    const q = {
      query: `query getMemberProfileAndSim { memberProfile { id } sim { status } }`,
      variables: {},
      operationName: 'getMemberProfileAndSim'
    };
    const r = await gql(q);
    currentMemberId = r.data?.data?.memberProfile?.id || null;
    if (!currentMemberId) {
      throw new AuthError('无法获取会员ID', 400);
    }
  }

  if (!currentSSN || !currentActivationCode) {
    const reserveBody = {
      query: `mutation reserveESim($input: ESimReservationInput!) { reserveESim: reserveESim(input: $input) { id memberId status esim { ssn activationCode deliveryStatus __typename } __typename } }`,
      variables: { input: { memberId: currentMemberId, userIntent: 'SWITCH' } },
      operationName: 'reserveESim'
    };

    const r = await createGraphql(accessToken, { 'X-MFA-Signature': mfaSignature })(reserveBody);
    const reservation = r.data?.data?.reserveESim;
    if (!reservation?.esim) {
      throw new AuthError('eSIM预订失败', 500);
    }
    currentSSN = reservation.esim.ssn;
    currentActivationCode = reservation.esim.activationCode;
  }

  // 4) 执行 swapSim
  let swapRef = null;
  try {
    // 先发起 simSwapMfaChallenge
    try {
      const chBody = { query: `mutation simSwapMfaChallenge { simSwapMfaChallenge { ref methods { value channel __typename } __typename } }`, variables: {}, operationName: 'simSwapMfaChallenge' };
      const ch = await createGraphql(accessToken)({ ...chBody });
      swapRef = ch.data?.data?.simSwapMfaChallenge?.ref || null;
    } catch (_) {}

    const swapBody = {
      query: `mutation SwapSim($activationCode: String!, $mfaSignature: String!) { swapSim(activationCode: $activationCode, mfaSignature: $mfaSignature) { old { ssn activationCode __typename } new { ssn activationCode __typename } __typename } }`,
      variables: { activationCode: currentActivationCode, mfaSignature },
      operationName: 'SwapSim'
    };
    const rs = await createGraphql(accessToken)({ ...swapBody, mfaRef: swapRef || ref });
    const sw = rs.data?.data?.swapSim;
    if (sw?.new?.ssn) {
      currentSSN = sw.new.ssn;
      currentActivationCode = sw.new.activationCode || currentActivationCode;
    }
  } catch (e) {
    // 允许继续轮询
  }

  // 5) 轮询获取 LPA
  const downloadQuery = {
    query: `query eSimDownloadToken($ssn: String!) { eSimDownloadToken(ssn: $ssn) { id host matchingId lpaString __typename } }`,
    variables: { ssn: currentSSN },
    operationName: 'eSimDownloadToken'
  };

  const deadline = Date.now() + 120000;
  let lastData = null;
  while (Date.now() < deadline) {
    try {
      const r = await gql(downloadQuery);
      lastData = r.data?.data?.eSimDownloadToken || null;
      if (lastData?.lpaString) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            lpaString: lastData.lpaString,
            token: lastData,
            ssn: currentSSN,
            activationCode: currentActivationCode
          })
        };
      }
    } catch (e) {
      // 忽略短暂错误,继续轮询
    }
    await new Promise(r => setTimeout(r, 4000));
  }

  return {
    statusCode: 202,
    body: JSON.stringify({
      success: false,
      message: '激活已提交,但暂未获取到LPA,请稍后在"获取eSIM Token"重试。'
    })
  };
}, { validateSchema: smsActivateSchema });
